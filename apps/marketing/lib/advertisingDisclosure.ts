// Bundled with the notice the visitor sees. Never infer this from server time:
// a tab loaded before the disclosure release can submit after the release cutoff.
export const ADVERTISING_DISCLOSURE_VERSION = '2026-10-sale-measurement-v1';
export function normalizeAdvertisingDisclosure(value: unknown): string | null {
  return value === ADVERTISING_DISCLOSURE_VERSION ? value : null;
}
