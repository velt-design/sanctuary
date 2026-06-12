'use client';

import { useCallback, useMemo } from 'react';
import { useLocalWorkingCopy } from '@/lib/localFirst/useLocalWorkingCopy';
import { buildEstimateDrawingDraftEntityKey } from '@/lib/localFirst/portalEntities';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import {
  EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT,
  normalizeObjectFirstWorkbenchDraftVNext,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';

type UseObjectWorkbenchDraftPersistenceInput = {
  estimateId: string;
};

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildWorkbenchDraftCarrier(): EstimateDrawingDraft {
  return {
    inputs: {} as EstimateDrawingDraft['inputs'],
    overrides: {},
    objectFirst: EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT,
  };
}

export function useObjectWorkbenchDraftPersistence({
  estimateId,
}: UseObjectWorkbenchDraftPersistenceInput) {
  const baseDraft = useMemo(() => buildWorkbenchDraftCarrier(), []);
  const drawingWorkingCopy = useLocalWorkingCopy<EstimateDrawingDraft | null>(
    buildEstimateDrawingDraftEntityKey(estimateId),
    baseDraft,
  );

  const drawingDraft = drawingWorkingCopy.value ?? baseDraft;
  const persistDrawingDraftLocally = useCallback(
    async (nextDraft: EstimateDrawingDraft) => {
      const nextObjectFirst = normalizeObjectFirstWorkbenchDraftVNext(nextDraft.objectFirst);
      const baseObjectFirst = normalizeObjectFirstWorkbenchDraftVNext(baseDraft.objectFirst);
      if (jsonEqual(nextObjectFirst, baseObjectFirst)) {
        await drawingWorkingCopy.clearWorkingCopy();
        return;
      }
      await drawingWorkingCopy.setWorkingCopy({
        ...baseDraft,
        objectFirst: nextObjectFirst,
      });
    },
    [baseDraft, drawingWorkingCopy],
  );

  return {
    drawingDraft,
    persistDrawingDraftLocally,
  };
}
