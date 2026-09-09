/**
 * Equally spaced member centres along a width. An outside-face datum insets
 * each end by half that member's width. Keep historical centreline rounding
 * when no inset is requested; outside-face spacing preserves exact end faces.
 */
export function equalMemberCentrePositions(lengthMm: number, count: number, edgeInsetMm = 0): number[] {
  if (count < 2) return [edgeInsetMm, lengthMm - edgeInsetMm];
  const spacingMm = (lengthMm - 2 * edgeInsetMm) / (count - 1);
  return Array.from({ length: count }, (_, index) => edgeInsetMm === 0
    ? Math.round(spacingMm * index)
    : edgeInsetMm + spacingMm * index);
}
