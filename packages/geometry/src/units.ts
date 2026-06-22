function roundMillimetres(value: number): number {
  return Math.round(value);
}

export function metresToMillimetres(value: number): number {
  return roundMillimetres(value * 1000);
}

export function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parsePositiveNumber(value: unknown): number | null {
  const parsed = parseFiniteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function parseNonNegativeNumber(value: unknown): number | null {
  const parsed = parseFiniteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

export function parseNonNegativeInteger(value: unknown): number | null {
  const parsed = parseFiniteNumber(value);
  if (parsed === null || parsed < 0) return null;
  return Math.round(parsed);
}
