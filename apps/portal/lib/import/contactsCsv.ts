import type { Contact } from '@/lib/types/contact';

type ContactsCsvRow = {
  displayName: string;
  email: string;
  phone: string;
  sourceRowNumber: number; // 1-based in the original file
  raw: Record<string, string>;
  errors: string[];
};

type ContactsCsvParseResult = {
  headerRowNumber: number;
  headers: string[];
  rows: ContactsCsvRow[];
  warnings: string[];
};

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function normaliseHeader(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normaliseEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function normalisePhone(value: unknown): string {
  if (typeof value !== 'string') return '';
  let s = value.trim();
  if (!s) return '';
  s = s.replace(/[^\d+]/g, '');

  const plusCount = (s.match(/\+/g) ?? []).length;
  if (plusCount > 1) s = '+' + s.replace(/\+/g, '');
  if (plusCount === 1 && !s.startsWith('+')) s = s.replace(/\+/g, '');

  return s;
}

function isValidEmail(email: string): boolean {
  const e = normaliseEmail(email);
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function parseCsv(text: string): string[][] {
  const input = stripBom(String(text ?? '')).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const flushField = () => {
    row.push(field);
    field = '';
  };

  const flushRow = () => {
    // Trim trailing empty fields that come from trailing commas.
    while (row.length && row[row.length - 1] === '') row.pop();
    // Ignore fully empty rows.
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      if (inQuotes) {
        const next = input[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        // Only treat as opening quote when the field is empty (common CSV behaviour).
        if (field === '') inQuotes = true;
        else field += ch;
      }
      continue;
    }

    if (!inQuotes && ch === ',') {
      flushField();
      continue;
    }

    if (!inQuotes && ch === '\n') {
      flushField();
      flushRow();
      continue;
    }

    field += ch;
  }

  flushField();
  flushRow();
  return rows;
}

function pickHeaderRow(rows: string[][]): { headerRowIndex: number; headers: string[] } {
  const candidates = [
    'name',
    'client name',
    'full name',
    'contact',
    'email',
    'email address',
    'phone',
    'phone number',
    'mobile',
    'mobile number',
  ];

  let bestIdx = -1;
  let bestScore = 0;
  let bestHeaders: string[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const norm = r.map(normaliseHeader);
    const score = norm.reduce((acc, h) => (candidates.includes(h) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestHeaders = r;
    }
  }

  if (bestIdx < 0 || bestScore < 2) {
    // Fall back to first row.
    return { headerRowIndex: 0, headers: rows[0] ?? [] };
  }

  return { headerRowIndex: bestIdx, headers: bestHeaders };
}

function pickColumnIndex(headers: string[], names: string[]): number | null {
  const normalised = headers.map(normaliseHeader);
  for (const name of names) {
    const idx = normalised.indexOf(normaliseHeader(name));
    if (idx >= 0) return idx;
  }
  return null;
}

function cell(row: string[], idx: number | null): string {
  if (idx === null) return '';
  return String(row[idx] ?? '').trim();
}

export function parseContactsCsv(text: string): ContactsCsvParseResult {
  const warnings: string[] = [];
  const rows = parseCsv(text);
  if (!rows.length) {
    return { headerRowNumber: 1, headers: [], rows: [], warnings: ['CSV appears empty.'] };
  }

  const { headerRowIndex, headers } = pickHeaderRow(rows);
  const headerRowNumber = headerRowIndex + 1;

  const nameIdx = pickColumnIndex(headers, ['client name', 'name', 'full name', 'contact']);
  const emailIdx = pickColumnIndex(headers, ['email address', 'email', 'e-mail']);
  const phoneIdx = pickColumnIndex(headers, ['phone number', 'mobile number', 'mobile', 'phone']);

  if (nameIdx === null) warnings.push('No name column detected (expected e.g. "Client name").');
  if (emailIdx === null) warnings.push('No email column detected (expected e.g. "Email Address").');
  if (phoneIdx === null) warnings.push('No phone column detected (expected e.g. "Phone number").');

  const out: ContactsCsvRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const r = rows[i];
    const sourceRowNumber = i + 1;

    const displayNameRaw = cell(r, nameIdx);
    const emailRaw = cell(r, emailIdx);
    const phoneRaw = cell(r, phoneIdx);

    const email = normaliseEmail(emailRaw);
    const phone = normalisePhone(phoneRaw);

    const displayName =
      displayNameRaw.trim() ||
      (isValidEmail(email) ? email : '') ||
      (phone ? phone : '');

    const rawMap: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const key = String(h ?? '').trim() || `col_${idx + 1}`;
      rawMap[key] = String(r[idx] ?? '').trim();
    });

    const errors: string[] = [];
    if (!displayName) errors.push('Missing name/email/phone.');
    if (emailRaw.trim() && !isValidEmail(email)) errors.push('Invalid email.');

    out.push({
      displayName,
      email,
      phone,
      sourceRowNumber,
      raw: rawMap,
      errors,
    });
  }

  return { headerRowNumber, headers, rows: out, warnings };
}

type ImportDecision = {
  row: ContactsCsvRow;
  action: 'create' | 'skip' | 'merge' | 'invalid';
  match?: { by: 'email' | 'phone'; existingId: string };
  reason?: string;
};

export function planContactsImport(
  parsed: ContactsCsvRow[],
  existing: Contact[],
  opts: { mergeBlanks: boolean },
): { decisions: ImportDecision[]; stats: { total: number; invalid: number; create: number; skip: number; merge: number } } {
  const byEmail = new Map<string, Contact>();
  const byPhone = new Map<string, Contact>();
  for (const c of existing) {
    const e = normaliseEmail(c.email);
    const p = normalisePhone(c.phone);
    if (e) byEmail.set(e, c);
    if (p) byPhone.set(p, c);
  }

  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();

  const decisions: ImportDecision[] = [];
  let invalid = 0;
  let create = 0;
  let skip = 0;
  let merge = 0;

  for (const row of parsed) {
    if (row.errors.length) {
      decisions.push({ row, action: 'invalid' });
      invalid += 1;
      continue;
    }

    const email = normaliseEmail(row.email);
    const phone = normalisePhone(row.phone);

    if (email && seenEmail.has(email)) {
      decisions.push({ row, action: 'skip', reason: 'Duplicate email in CSV.' });
      skip += 1;
      continue;
    }
    if (phone && seenPhone.has(phone)) {
      decisions.push({ row, action: 'skip', reason: 'Duplicate phone in CSV.' });
      skip += 1;
      continue;
    }

    const matchEmail = email ? byEmail.get(email) : undefined;
    const matchPhone = !matchEmail && phone ? byPhone.get(phone) : undefined;
    const match = matchEmail ?? matchPhone;

    if (!match) {
      decisions.push({ row, action: 'create' });
      create += 1;
      if (email) seenEmail.add(email);
      if (phone) seenPhone.add(phone);
      continue;
    }

    const matchBy = matchEmail ? 'email' : 'phone';

    if (!opts.mergeBlanks) {
      decisions.push({ row, action: 'skip', match: { by: matchBy, existingId: match.id } });
      skip += 1;
      if (email) seenEmail.add(email);
      if (phone) seenPhone.add(phone);
      continue;
    }

    const canMerge =
      (email && !normaliseEmail(match.email)) ||
      (phone && !normalisePhone(match.phone)) ||
      (row.displayName.trim() && !match.displayName.trim());

    if (!canMerge) {
      decisions.push({ row, action: 'skip', match: { by: matchBy, existingId: match.id } });
      skip += 1;
      if (email) seenEmail.add(email);
      if (phone) seenPhone.add(phone);
      continue;
    }

    decisions.push({ row, action: 'merge', match: { by: matchBy, existingId: match.id } });
    merge += 1;
    if (email) seenEmail.add(email);
    if (phone) seenPhone.add(phone);
  }

  return {
    decisions,
    stats: { total: parsed.length, invalid, create, skip, merge },
  };
}
