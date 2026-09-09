/** Owner-selected marketing dimensions, not an engineering sizing rule. */
export function representativeGableRules(widthMm: number, projectionMm: number, orientation: 'parallel' | 'away') {
  const span = orientation === 'away' ? widthMm : projectionMm;
  const ridgeRun = orientation === 'away' ? projectionMm : widthMm;
  const large = widthMm * projectionMm > 20_000_000;
  return { span, postSize: large ? 150 : 90, inwardTieWidth: span < 4000 ? 50 : 100,
    kingDepth: span < 4000 ? 100 : 150, kingIsPost: span >= 5000,
    ridgeBays: Math.ceil(ridgeRun / 4000), flashingWingMm: 150 };
}
export type RepresentativeGableRules = ReturnType<typeof representativeGableRules>;
