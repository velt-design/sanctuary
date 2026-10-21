/** Shared existing opening-shape arithmetic. Strict callers validate raw values
 * before use; calculator compatibility retains permissive parsing/defaults. */
type InfillMonoSlopeModeInput = 'heights' | 'pitch';
type InfillMonoSlopeAnchorInput = 'left' | 'right';
export type MonoSlopeShapeInput = { widthM: string; heightLowM: string; heightHighM: string; slopeMode?: InfillMonoSlopeModeInput; slopeAnchor?: InfillMonoSlopeAnchorInput; slopeDeg?: string };
function toNumber(value: string): number { const number = Number.parseFloat(value); return Number.isFinite(number) ? number : Number.NaN; }
export function normalizeMonoSlopeMode(value: unknown): InfillMonoSlopeModeInput {
  return value === 'pitch' ? 'pitch' : 'heights';
}

export function normalizeMonoSlopeAnchor(value: unknown): InfillMonoSlopeAnchorInput {
  return value === 'right' ? 'right' : 'left';
}

type ResolvedMonoSlopeShape = {
  leftHeightM: number;
  rightHeightM: number;
  slopeMode: InfillMonoSlopeModeInput;
  slopeAnchor: InfillMonoSlopeAnchorInput;
  slopeDeg: number | null;
  leftInputValid: boolean;
  rightInputValid: boolean;
  anchorInputValid: boolean;
  pitchValid: boolean;
};

export function resolveMonoSlopeShape(shape: MonoSlopeShapeInput): ResolvedMonoSlopeShape {
  const widthRaw = toNumber(shape.widthM);
  const widthValid = Number.isFinite(widthRaw) && widthRaw >= 0;
  const widthM = widthValid ? Math.max(0, widthRaw) : 0;
  const leftRaw = toNumber(shape.heightLowM);
  const rightRaw = toNumber(shape.heightHighM);
  const leftInputValid = Number.isFinite(leftRaw) && leftRaw >= 0;
  const rightInputValid = Number.isFinite(rightRaw) && rightRaw >= 0;
  const leftHeightM = leftInputValid ? Math.max(0, leftRaw) : 0;
  const rightHeightM = rightInputValid ? Math.max(0, rightRaw) : 0;
  const slopeMode = normalizeMonoSlopeMode(shape.slopeMode);
  const slopeAnchor = normalizeMonoSlopeAnchor(shape.slopeAnchor);
  const slopeRaw = toNumber(shape.slopeDeg ?? '');
  const pitchValid = Number.isFinite(slopeRaw) && slopeRaw >= 0 && slopeRaw < 90;

  if (slopeMode === 'pitch' && pitchValid && widthValid && widthM > 0) {
    const riseM = Math.tan((slopeRaw * Math.PI) / 180) * widthM;
    if (slopeAnchor === 'left') {
      return {
        leftHeightM,
        rightHeightM: Math.max(0, leftHeightM + riseM),
        slopeMode,
        slopeAnchor,
        slopeDeg: slopeRaw,
        leftInputValid,
        rightInputValid,
        anchorInputValid: leftInputValid,
        pitchValid,
      };
    }

    return {
      leftHeightM: Math.max(0, rightHeightM + riseM),
      rightHeightM,
      slopeMode,
      slopeAnchor,
      slopeDeg: slopeRaw,
      leftInputValid,
      rightInputValid,
      anchorInputValid: rightInputValid,
      pitchValid,
    };
  }

  let derivedSlopeDeg: number | null = null;
  if (widthValid && widthM > 0) {
    derivedSlopeDeg = (Math.atan(Math.abs(rightHeightM - leftHeightM) / widthM) * 180) / Math.PI;
  }

  return {
    leftHeightM,
    rightHeightM,
    slopeMode,
    slopeAnchor,
    slopeDeg: pitchValid ? slopeRaw : derivedSlopeDeg,
    leftInputValid,
    rightInputValid,
    anchorInputValid: slopeAnchor === 'left' ? leftInputValid : rightInputValid,
    pitchValid,
  };
}
