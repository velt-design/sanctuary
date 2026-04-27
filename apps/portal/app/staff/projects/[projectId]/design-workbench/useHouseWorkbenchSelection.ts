'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { DrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchHouseSelection } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type { CommitResult, DrawOutlineTarget } from './houseWorkbenchClientTypes';

type UseHouseWorkbenchSelectionInput = {
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>;
  setDrawOutlineTarget: Dispatch<SetStateAction<DrawOutlineTarget>>;
  setDrawOutlineRequestId: Dispatch<SetStateAction<number>>;
};

const FOOTPRINT_DRAW_OUTLINE_TARGET: DrawOutlineTarget = {
  kind: 'footprint',
  deckId: null,
};

export function useHouseWorkbenchSelection({
  setUi,
  setDrawOutlineTarget,
  setDrawOutlineRequestId,
}: UseHouseWorkbenchSelectionInput) {
  const resetDrawOutlineTarget = useCallback(() => {
    setDrawOutlineTarget(FOOTPRINT_DRAW_OUTLINE_TARGET);
  }, [setDrawOutlineTarget]);

  const selectHouseWorkbenchMode = useCallback(() => {
    resetDrawOutlineTarget();
    setUi((current) => ({
      ...current,
      workbenchMode: 'house',
      activeHouseSelection: { kind: 'house', targetId: null },
    }));
  }, [resetDrawOutlineTarget, setUi]);

  const selectPergolaWorkbenchMode = useCallback(
    (defaultPergolaId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        workbenchMode: 'pergolas',
        activePergolaId: defaultPergolaId ?? current.activePergolaId,
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const startDrawOutlineEditor = useCallback((): CommitResult => {
    setDrawOutlineTarget(FOOTPRINT_DRAW_OUTLINE_TARGET);
    setUi((current) => ({
      ...current,
      workbenchMode: 'house',
      viewportMode: 'model',
      activeView: 'plan',
      activeHouseSelection: { kind: 'footprint', targetId: null },
    }));
    setDrawOutlineRequestId((current) => current + 1);
    return { ok: true };
  }, [setDrawOutlineRequestId, setDrawOutlineTarget, setUi]);

  const startDeckOutlineEditor = useCallback(
    (deckId: string): CommitResult => {
      setDrawOutlineTarget({ kind: 'deck', deckId });
      setUi((current) => ({
        ...current,
        workbenchMode: 'house',
        viewportMode: 'model',
        activeView: 'plan',
        activeHouseSelection: { kind: 'deck', targetId: deckId },
      }));
      setDrawOutlineRequestId((current) => current + 1);
      return { ok: true };
    },
    [setDrawOutlineRequestId, setDrawOutlineTarget, setUi],
  );

  const selectSharedHouseDeck = useCallback(
    (deckId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        workbenchMode: 'house',
        activeHouseSelection: deckId ? { kind: 'deck', targetId: deckId } : { kind: 'house', targetId: null },
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const selectSharedHouseOpening = useCallback(
    (openingId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        workbenchMode: 'house',
        activeHouseSelection: openingId
          ? { kind: 'opening', targetId: openingId }
          : { kind: 'house', targetId: null },
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const selectHouseFirstTarget = useCallback(
    (selection: WorkbenchHouseSelection) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        workbenchMode: 'house',
        activeHouseSelection: selection,
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  return {
    selectHouseWorkbenchMode,
    selectPergolaWorkbenchMode,
    startDrawOutlineEditor,
    startDeckOutlineEditor,
    selectSharedHouseDeck,
    selectSharedHouseOpening,
    selectHouseFirstTarget,
  };
}
