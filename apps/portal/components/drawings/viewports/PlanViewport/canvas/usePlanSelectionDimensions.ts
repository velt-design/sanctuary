'use client';

import { useMemo } from 'react';
import {
  buildSelectionDimensions,
  type ActiveObjectFamily,
  type PlanDimension,
} from './planDimension';
import type { PlanRenderItem } from './planRenderItem';

const EMPTY_DIMENSIONS: ReadonlyArray<PlanDimension> = [];

type UsePlanSelectionDimensionsInput = {
  selectionHaloItems: ReadonlyArray<PlanRenderItem> | undefined;
  activeFamily: ActiveObjectFamily | null | undefined;
  providedDimensions?: ReadonlyArray<PlanDimension>;
};

export function usePlanSelectionDimensions({
  selectionHaloItems,
  activeFamily,
  providedDimensions,
}: UsePlanSelectionDimensionsInput): ReadonlyArray<PlanDimension> {
  return useMemo(() => {
    const selectionDims = selectionHaloItems
      ? buildSelectionDimensions(
          selectionHaloItems.map((item) => ({
            id: item.shape.id,
            polygon: item.shape.polygon,
            family: item.shape.family,
            kind: item.shape.kind,
            isCanonicalOutline: item.shape.metadata?.isCanonicalOutline === true,
          })),
          activeFamily ?? null,
        )
      : [];
    const provided = providedDimensions ?? EMPTY_DIMENSIONS;
    if (selectionDims.length === 0) return provided;
    if (provided.length === 0) return selectionDims;
    return [...selectionDims, ...provided];
  }, [activeFamily, providedDimensions, selectionHaloItems]);
}
