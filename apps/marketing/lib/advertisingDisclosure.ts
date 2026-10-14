// Bundled with the notice the visitor sees. Never infer this from server time:
// a tab loaded before the disclosure release can submit after the release cutoff.
export const ADVERTISING_DISCLOSURE_VERSION = '2026-10-sale-measurement-v2';
export function normalizeAdvertisingDisclosure(value: unknown): string | null {
  // Preserve what an older open tab actually displayed; never upgrade it on receipt.
  return value === ADVERTISING_DISCLOSURE_VERSION || value === '2026-10-sale-measurement-v1' ? value : null;
}
