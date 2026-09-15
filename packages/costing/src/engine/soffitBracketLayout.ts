export const SOFFIT_BRACKET_SPACING_MM_MAX = 1500;

/** Existing costing quantity rule; attachment length is normalized positive mm. */
export function calculateSoffitBracketCountV1(attachmentLengthMm: number): number {
  return Math.ceil(attachmentLengthMm / SOFFIT_BRACKET_SPACING_MM_MAX) + 1;
}
