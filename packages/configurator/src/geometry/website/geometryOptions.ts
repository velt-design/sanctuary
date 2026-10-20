import { CUSTOMER_DIMENSION_BOUNDS } from '../../core';

/** Optional staff concept datum. It is not a fabrication post-cut schedule. */
export type PreviewGeometryOptions = { supportDatumMm?: number; roofDatumBasis?: 'attached' };
export function previewSupportDatum(options?: PreviewGeometryOptions): number {
  const value = options?.supportDatumMm ?? 2400;
  const bounds = CUSTOMER_DIMENSION_BOUNDS.clearHeightMm;
  if (!Number.isFinite(value) || value < bounds.minimum || value > bounds.maximum) {
    throw new Error(`Support datum must be ${bounds.minimum}–${bounds.maximum} mm.`);
  }
  return value;
}
