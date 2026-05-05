import 'server-only';

export function nowIso(): string {
  return new Date().toISOString();
}

function toDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value.slice(0, 10);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  if (!Number.isFinite(d.getTime())) return dateIso;
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnly(d.toISOString());
}

export function firstTrimmedString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const message = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
  if (message) return message;
  const alt = typeof (error as any)?.error === 'string' ? String((error as any).error) : '';
  return alt || fallback;
}

export function missingTableError(error: any): boolean {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  return (
    code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('relation') ||
    message.includes('function')
  );
}

export function schemaMissingError(): Error {
  return new Error('Quote schema not installed. Apply migrations and restart.');
}
