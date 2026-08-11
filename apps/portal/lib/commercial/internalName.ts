export const COMMERCIAL_INTERNAL_NAME_MAX_LENGTH = 120;

export function normalizeCommercialInternalName(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

export function validateCommercialInternalName(value: unknown):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  if (value != null && typeof value !== 'string') {
    return { ok: false, error: 'Internal name must be text' };
  }
  const normalized = normalizeCommercialInternalName(value);
  if (normalized && normalized.length > COMMERCIAL_INTERNAL_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Internal name must be ${COMMERCIAL_INTERNAL_NAME_MAX_LENGTH} characters or fewer`,
    };
  }
  return { ok: true, value: normalized };
}

export function copiedCommercialInternalName(name: string | null | undefined, fallback: string): string {
  const source = normalizeCommercialInternalName(name) ?? fallback;
  const prefix = 'Copy of ';
  return `${prefix}${source}`.slice(0, COMMERCIAL_INTERNAL_NAME_MAX_LENGTH).trim();
}
