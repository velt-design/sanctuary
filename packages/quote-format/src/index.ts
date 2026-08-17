export type QuoteLineDescription = {
  heading: string;
  bullets: string[];
  entries: QuoteLineDescriptionEntry[];
};

export type QuoteLineDescriptionEntry = {
  kind: 'section' | 'bullet';
  text: string;
};

export type FormatQuoteTermsOptions = {
  sentAt?: string | null;
};

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^[-\u2013\u2014\s]+$/,
  /\bundefined\b/i,
  /\bnull\b/i,
  /\bdefault\b/i,
  /[\u2013\u2014-]\s*mm\s*x\s*[\u2013\u2014-]\s*mm/i,
  /\benter\b/i,
];

const CONNECTION_KEY_LABELS: Record<string, string> = {
  house: 'House connection',
  posts: 'Post fixings',
};

const CONNECTION_VALUE_LABELS: Record<string, string> = {
  soffit: 'Soffit brackets',
  deck_bracket: 'Deck brackets',
};

const PERGOLA_BULLET_PRIORITY = [
  'included',
  'project delivery',
  'configuration',
  'roof form',
  'style',
  'overall size',
  'size',
  'roof covering',
  'roof',
  'frame finish',
  'colour',
  'roof pitch',
  'pitch',
  'support posts',
  'posts',
  'connection to home',
  'house connection',
  'post foundations and fixings',
  'post fixings',
  'quote discount',
] as const;
const PERGOLA_BULLET_INDEX = new Map<string, number>(PERGOLA_BULLET_PRIORITY.map((key, idx) => [key, idx]));
const DRAFT_TERMS_PATTERN = /this quote is valid for 30 days from the issue date\.?/i;
const DESCRIPTION_SECTION_PATTERNS: RegExp[] = [
  /^shared specification$/i,
  /^shared across all roof sections$/i,
  /^module\s+\d+(?:\s*:\s*.+)?$/i,
  /^roof section\s+\d+(?:\s*:\s*.+)?$/i,
  /^included infills$/i,
];
const IDENTIFIER_TOKEN_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i;

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function sanitizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isPlaceholder(trimmed)) return null;
  const compact = trimmed.replace(/\s+/g, ' ');
  if (isPlaceholder(compact)) return null;
  return compact;
}

function toTitleCaseToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

function ensureTrailingColon(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Item:';
  return trimmed.endsWith(':') ? trimmed : `${trimmed}:`;
}

function formatHeadingValue(value: string): string {
  const clean = sanitizeText(value) ?? value.trim();
  if (!clean) return value;
  if (clean === clean.toLowerCase() || /[_-]/.test(clean)) {
    return toTitleCaseToken(clean);
  }
  return clean;
}

function mapTokenValue(value: string): string {
  const lower = value.toLowerCase();
  if (CONNECTION_VALUE_LABELS[lower]) return CONNECTION_VALUE_LABELS[lower];
  if (IDENTIFIER_TOKEN_PATTERN.test(value)) return toTitleCaseToken(value);
  return value;
}

function mapTokenKey(value: string): string {
  const lower = value.toLowerCase();
  if (CONNECTION_KEY_LABELS[lower]) return CONNECTION_KEY_LABELS[lower];
  if (IDENTIFIER_TOKEN_PATTERN.test(value)) return toTitleCaseToken(value);
  return value;
}

function normalizeSizeValue(value: string): string {
  const withTimes = value.replace(/\s[xX]\s/g, ' × ');
  return withTimes.replace(/\s{2,}/g, ' ').trim();
}

function sortPergolaBullets(bullets: string[]): string[] {
  if (bullets.length <= 1) return bullets;
  const buckets: string[][] = Array.from({ length: PERGOLA_BULLET_PRIORITY.length + 1 }, () => []);

  bullets.forEach((bullet) => {
    const match = bullet.match(/^([^:]+):/);
    const key = match ? match[1].trim().toLowerCase() : null;
    const index = key ? PERGOLA_BULLET_INDEX.get(key) : undefined;
    if (typeof index === 'number') {
      buckets[index].push(bullet);
    } else {
      buckets[PERGOLA_BULLET_PRIORITY.length].push(bullet);
    }
  });

  return buckets.flat();
}

function expandConnections(raw: string): string[] {
  const pairs = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const lines: string[] = [];
  pairs.forEach((pair) => {
    const [rawKey, rawValue] = pair.split('=').map((part) => part.trim());
    if (!rawKey || !rawValue) return;
    const keyLabel = mapTokenKey(rawKey);
    const valueClean = sanitizeText(rawValue);
    if (!valueClean) return;
    const valueLabel = mapTokenValue(valueClean);
    if (!sanitizeText(valueLabel)) return;
    lines.push(`${keyLabel}: ${valueLabel}`);
  });

  return lines;
}

function sanitizeBulletLine(raw: string): string[] {
  const stripped = raw.replace(/^[-•]\s*/, '').trim();
  if (!stripped) return [];
  if (isPlaceholder(stripped)) return [];

  const connectionMatch = stripped.match(/^Connections\s*:\s*(.+)$/i);
  if (connectionMatch) {
    return expandConnections(connectionMatch[1]);
  }

  const kvMatch = stripped.match(/^([^:]+):\s*(.+)$/);
  if (kvMatch) {
    const key = sanitizeText(kvMatch[1]);
    const value = sanitizeText(kvMatch[2]);
    if (!key || !value) return [];
    let valueLabel = mapTokenValue(value);
    if (!sanitizeText(valueLabel)) return [];
    if (/^(?:size|overall size)$/i.test(key)) {
      valueLabel = normalizeSizeValue(valueLabel);
    }
    return [`${key}: ${valueLabel}`];
  }

  const clean = sanitizeText(stripped);
  return clean ? [clean] : [];
}

function isDescriptionSection(raw: string): boolean {
  const stripped = raw.replace(/^[-•]\s*/, '').trim();
  if (!stripped) return false;
  return DESCRIPTION_SECTION_PATTERNS.some((pattern) => pattern.test(stripped));
}

function sanitizeDescriptionLine(raw: string): QuoteLineDescriptionEntry[] {
  if (isDescriptionSection(raw)) {
    const stripped = raw.replace(/^[-•]\s*/, '').trim();
    const clean = sanitizeText(stripped);
    return clean ? [{ kind: 'section', text: clean }] : [];
  }

  return sanitizeBulletLine(raw).map((text) => ({ kind: 'bullet' as const, text }));
}

function sortPergolaEntries(entries: QuoteLineDescriptionEntry[]): QuoteLineDescriptionEntry[] {
  if (entries.length <= 1) return entries;
  if (entries.some((entry) => entry.kind === 'section')) return entries;
  return sortPergolaBullets(entries.map((entry) => entry.text)).map((text) => ({ kind: 'bullet', text }));
}

function adjustTermsForDraft(terms: string[], sentAt?: string | null): string[] {
  if (sentAt) return terms;
  return terms.map((line) =>
    line.replace(DRAFT_TERMS_PATTERN, 'This quote will be valid for 30 days from the issue date.'),
  );
}

export function formatQuoteLineDescription(raw: string, index: number): QuoteLineDescription {
  const lines = String(raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rawTitle = lines[0] ?? `Item ${index + 1}`;
  const title = sanitizeText(rawTitle) ?? `Item ${index + 1}`;

  const entries: QuoteLineDescriptionEntry[] = [];
  lines.slice(1).forEach((line) => {
    const expanded = sanitizeDescriptionLine(line);
    expanded.forEach((entry) => {
      const clean = sanitizeText(entry.text);
      if (clean) entries.push({ ...entry, text: clean });
    });
  });

  const styleValues: string[] = [];
  const styleIndexes = new Set<number>();
  let locationValue: string | null = null;
  let locationIndex = -1;

  entries.forEach((entry, idx) => {
    if (entry.kind !== 'bullet') return;

    const styleMatch = entry.text.match(/^(?:Style|Roof form):\s*(.+)$/i);
    if (styleMatch) {
      styleValues.push(styleMatch[1].trim());
      styleIndexes.add(idx);
      return;
    }
    const locationMatch = entry.text.match(/^(Location|Position|Placement):\s*(.+)$/i);
    if (locationMatch && locationIndex === -1) {
      locationValue = locationMatch[2].trim();
      locationIndex = idx;
    }
  });

  let heading = title;
  let usedStyle = false;
  let usedLocation = false;
  const uniqueStyles = Array.from(new Set(styleValues.map((value) => value.toLowerCase()))).map((lower) => {
    const original = styleValues.find((value) => value.toLowerCase() === lower);
    return original ?? lower;
  });

  const lowerTitle = title.toLowerCase();
  const isPergola = lowerTitle.includes('pergola');
  const baseTitle = title.replace(/\bmodule\b/gi, '').replace(/\s+/g, ' ').trim();
  const titleLooksGenericPergola = baseTitle === '' || /^pergola$/i.test(baseTitle) || /^pergola module$/i.test(title);
  if (lowerTitle.includes('electrical')) {
    heading = 'Electrical and Lighting';
  } else if (lowerTitle.includes('blind')) {
    if (locationValue) {
      heading = `${formatHeadingValue(locationValue)} Blind`;
      usedLocation = true;
    }
  } else if (lowerTitle.includes('pergola')) {
    if (uniqueStyles.length === 1 && (titleLooksGenericPergola || /^pergola module/i.test(title) || /^pergola$/i.test(baseTitle))) {
      const style = formatHeadingValue(uniqueStyles[0]!);
      if (/pergola/i.test(style)) {
        heading = style;
      } else {
        heading = `${style} Pergola`;
      }
      usedStyle = true;
    } else {
      heading = baseTitle || 'Pergola';
    }
  }

  heading = ensureTrailingColon(heading);

  const drop = new Set<number>();
  if (usedStyle) {
    styleIndexes.forEach((idx) => drop.add(idx));
  }
  if (usedLocation && locationIndex >= 0) drop.add(locationIndex);

  const filteredEntries = entries.filter((_, idx) => !drop.has(idx));
  const orderedEntries = isPergola ? sortPergolaEntries(filteredEntries) : filteredEntries;
  const orderedBullets = orderedEntries.filter((entry) => entry.kind === 'bullet').map((entry) => entry.text);

  return { heading, bullets: orderedBullets, entries: orderedEntries };
}

export function formatQuoteTermsText(raw: string | null | undefined, options: FormatQuoteTermsOptions = {}): string[] {
  const terms = String(raw ?? '')
    .split('\n')
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .map((line) => sanitizeText(line))
    .filter((line): line is string => Boolean(line));
  return adjustTermsForDraft(terms, options.sentAt);
}

export function formatQuoteIntroText(raw: string | null | undefined): string | null {
  return sanitizeText(raw);
}
