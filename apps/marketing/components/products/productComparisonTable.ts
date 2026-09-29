import type { ProductDesignType } from './productDesigns';

export const COMPARISON_SIZES = [[2000, 3000], [4000, 3000], [6000, 3000], [8000, 3000], [6000, 4000], [6000, 5000]] as const;
export const comparisonSizeKey = (widthMm: number, projectionMm: number) => `${widthMm}-${projectionMm}`;
export type ProductComparisonTable =
  | { status: 'priced'; versionNumber: number; amounts: Record<string, Record<ProductDesignType, number>> }
  | { status: 'loading' | 'unavailable' | 'disabled' };
