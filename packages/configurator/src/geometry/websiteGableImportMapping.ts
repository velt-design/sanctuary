/** Convert submitted finished ridge-run dimensions to canonical gable end-rafter
 * centres. Placement is a new workspace origin, never a surveyed house relation.
 * This does not select structural profiles, height, pitch or commercial rates. */
export function mapWebsiteGableImportGeometry(input: {
  widthMm: number; projectionMm: number; orientation: 'parallel' | 'away'; rafterWidthMm: number;
}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 4 || !['widthMm', 'projectionMm', 'orientation', 'rafterWidthMm'].every(key => Object.hasOwn(input, key))
    || ![input.widthMm, input.projectionMm].every(n => Number.isSafeInteger(n) && n > 0)
    || input.rafterWidthMm !== 50 || !['parallel', 'away'].includes(input.orientation)) throw Error('Explicit whole-millimetre dimensions, ridge direction and supported 50 mm rafter width are required.');
  const away = input.orientation === 'away';
  const runMm = away ? input.projectionMm : input.widthMm;
  const spanMm = away ? input.widthMm : input.projectionMm;
  const lengthMm = runMm - input.rafterWidthMm;
  if (lengthMm <= 0) throw Error('The finished ridge run must exceed the selected rafter width.');
  const metres = (mm: number): string => {
    const exact = BigInt(mm), thousand = BigInt(1000), remainder = String(exact % thousand).padStart(3, '0').replace(/0+$/, '');
    const raw = `${exact / thousand}${remainder ? `.${remainder}` : ''}`;
    // Match the canonical owner's whole-mm source roundtrip, never repair it.
    const value = Number(raw), resolvedMm = Math.round(value * 1000);
    if (resolvedMm !== mm || value !== resolvedMm / 1000) throw Error('Dimensions cannot be represented without loss.');
    return raw;
  };
  const lengthM = metres(lengthMm), projectionM = metres(spanMm);
  return {
    dimensions: { lengthM: String(lengthM), projectionM: String(projectionM) },
    position: { originXMm: String(away ? spanMm : input.rafterWidthMm / 2), originYMm: String(away ? input.rafterWidthMm / 2 : 0), rotationDeg: away ? '90' : '0' },
  };
}
