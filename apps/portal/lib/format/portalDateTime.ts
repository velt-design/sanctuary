import { PORTAL_LOCALE, PORTAL_TIME_ZONE } from './portalDateConstants';

const YMD_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: PORTAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(PORTAL_LOCALE, {
  timeZone: PORTAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

const DATE_FORMATTER = new Intl.DateTimeFormat(PORTAL_LOCALE, {
  timeZone: PORTAL_TIME_ZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const TIME_FORMATTER = new Intl.DateTimeFormat(PORTAL_LOCALE, {
  timeZone: PORTAL_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});


type PortalFormatOptions = {
  fallback?: string;
};

function coerceDate(value: Date | string | number | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? null : value;
  }
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function buildYmd(date: Date): string {
  const parts = YMD_FORMATTER.formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function portalTodayYmd(now: Date | string | number = new Date()): string {
  const date = coerceDate(now);
  return date ? buildYmd(date) : buildYmd(new Date());
}

export function formatPortalDateTime(value: Date | string | number | null | undefined, options: PortalFormatOptions = {}): string {
  const { fallback = '—' } = options;
  if (value == null || value === '') return fallback;
  const date = coerceDate(value);
  if (!date) return typeof value === 'string' ? value : fallback;
  return DATE_TIME_FORMATTER.format(date);
}

export function formatPortalDate(value: Date | string | number | null | undefined, options: PortalFormatOptions = {}): string {
  const { fallback = '—' } = options;
  if (value == null || value === '') return fallback;
  const date = coerceDate(value);
  if (!date) return typeof value === 'string' ? value : fallback;
  return DATE_FORMATTER.format(date);
}

export function formatPortalTime(value: Date | string | number | null | undefined, options: PortalFormatOptions = {}): string {
  const { fallback = '—' } = options;
  if (value == null || value === '') return fallback;
  const date = coerceDate(value);
  if (!date) return typeof value === 'string' ? value : fallback;
  return TIME_FORMATTER.format(date);
}

export { PORTAL_LOCALE, PORTAL_TIME_ZONE };
