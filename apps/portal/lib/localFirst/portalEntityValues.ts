/** Shared scalar readers for local-first cache and quote preparation owners. */
type AnyRecord = Record<string, unknown>;

export function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : null;
}

export function parseVersionLabel(label: string): number | null {
  const match = String(label ?? '').trim().match(/^V(\d+)$/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}
