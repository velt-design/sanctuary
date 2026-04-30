'use client';

import { useCallback, useMemo } from 'react';
import { useLocalWorkingCopy } from '@/lib/localFirst/useLocalWorkingCopy';
import { buildEstimateDrawingDraftEntityKey } from '@/lib/localFirst/portalEntities';
import {
  buildEstimateDrawingDraftFromSnapshot,
  estimateDrawingDraftMatchesSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import type { EstimateDetail } from '@/lib/estimates/types';

type UseObjectWorkbenchDraftPersistenceInput = {
  estimateId: string;
  snapshot: EstimateDetail['calculatorSnapshot'];
};

export function useObjectWorkbenchDraftPersistence({
  estimateId,
  snapshot,
}: UseObjectWorkbenchDraftPersistenceInput) {
  const baseDraft = useMemo(() => buildEstimateDrawingDraftFromSnapshot(snapshot), [snapshot]);
  const drawingWorkingCopy = useLocalWorkingCopy<EstimateDrawingDraft | null>(
    buildEstimateDrawingDraftEntityKey(estimateId),
    baseDraft,
  );
  const drawingDraft = drawingWorkingCopy.value;

  const persistDrawingDraftLocally = useCallback(
    async (nextDraft: EstimateDrawingDraft) => {
      if (estimateDrawingDraftMatchesSnapshot(nextDraft, snapshot)) {
        await drawingWorkingCopy.clearWorkingCopy();
      } else {
        await drawingWorkingCopy.setWorkingCopy(nextDraft);
      }
    },
    [drawingWorkingCopy, snapshot],
  );

  return {
    drawingDraft,
    persistDrawingDraftLocally,
  };
}
