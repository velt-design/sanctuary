import { toCents } from './utils';

type EstimateLike = {
  inputs?: unknown;
  outputs?: unknown;
} | null | undefined;

export function extractLightingTotalCents(estimate: EstimateLike): number | null {
  const inputs: any = estimate?.inputs ?? {};
  const outputs: any = estimate?.outputs ?? {};

  const candidates: Array<unknown> = [
    inputs?.lighting_total_inc_gst,
    inputs?.lightingTotalIncGst,
    inputs?.lighting?.totalIncGst,
    inputs?.lighting?.total_inc_gst,
    outputs?.lighting_total_inc_gst,
    outputs?.lightingTotalIncGst,
    outputs?.lighting?.totalIncGst,
  ];

  for (const value of candidates) {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
    if (Number.isFinite(n) && n > 0) return toCents(n);
  }

  return null;
}
