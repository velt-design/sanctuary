export type QuoteLineDescription = {
  heading: string;
  bullets: string[];
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

const PERGOLA_BULLET_PRIORITY = ['size', 'roof', 'colour', 'posts', 'house connection', 'post fixings'] as const;
const PERGOLA_BULLET_INDEX = new Map<string, number>(PERGOLA_BULLET_PRIORITY.map((key, idx) => [key, idx]));
const DRAFT_TERMS_PATTERN = /this quote is valid for 30 days from the issue date\.?/i;

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
  if (/[_-]/.test(value)) return toTitleCaseToken(value);
  return value;
}

function mapTokenKey(value: string): string {
  const lower = value.toLowerCase();
  if (CONNECTION_KEY_LABELS[lower]) return CONNECTION_KEY_LABELS[lower];
  if (/[_-]/.test(value)) return toTitleCaseToken(value);
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
    if (/^size$/i.test(key)) {
      valueLabel = normalizeSizeValue(valueLabel);
    }
    return [`${key}: ${valueLabel}`];
  }

  const clean = sanitizeText(stripped);
  return clean ? [clean] : [];
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

  const bullets: string[] = [];
  lines.slice(1).forEach((line) => {
    const expanded = sanitizeBulletLine(line);
    expanded.forEach((bullet) => {
      const clean = sanitizeText(bullet);
      if (clean) bullets.push(clean);
    });
  });

  let styleValue: string | null = null;
  let styleIndex = -1;
  let locationValue: string | null = null;
  let locationIndex = -1;

  bullets.forEach((bullet, idx) => {
    const styleMatch = bullet.match(/^Style:\s*(.+)$/i);
    if (styleMatch && styleIndex === -1) {
      styleValue = styleMatch[1].trim();
      styleIndex = idx;
      return;
    }
    const locationMatch = bullet.match(/^(Location|Position|Placement):\s*(.+)$/i);
    if (locationMatch && locationIndex === -1) {
      locationValue = locationMatch[2].trim();
      locationIndex = idx;
    }
  });

  let heading = title;
  let usedStyle = false;
  let usedLocation = false;

  const lowerTitle = title.toLowerCase();
  const isPergola = lowerTitle.includes('pergola');
  if (lowerTitle.includes('electrical')) {
    heading = 'Electrical and Lighting';
  } else if (lowerTitle.includes('blind')) {
    if (locationValue) {
      heading = `${formatHeadingValue(locationValue)} Blind`;
      usedLocation = true;
    }
  } else if (lowerTitle.includes('pergola')) {
    const baseTitle = title.replace(/module/gi, '').replace(/\s+/g, ' ').trim();
    if (styleValue) {
      const style = formatHeadingValue(styleValue);
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
  if (usedStyle && styleIndex >= 0) drop.add(styleIndex);
  if (usedLocation && locationIndex >= 0) drop.add(locationIndex);

  const filteredBullets = bullets.filter((_, idx) => !drop.has(idx));
  const orderedBullets = isPergola ? sortPergolaBullets(filteredBullets) : filteredBullets;

  return { heading, bullets: orderedBullets };
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
