'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  DrawingWorkbenchRailTab,
  DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
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

function clearObjectSelectionForTab(
  current: DrawingWorkbenchUiState,
  tab: DrawingWorkbenchRailTab,
): Pick<
  DrawingWorkbenchUiState,
  'activeRailTab' | 'activeObjectFamily' | 'activeObjectRef' | 'workbenchMode' | 'activeHouseSelection' | 'activePergolaId'
> {
  switch (tab) {
    case 'pergolas': {
      const pergolaId = current.activePergolaId ?? current.activeObjectRef.objectId ?? null;
      return {
        activeRailTab: 'pergolas',
        activeObjectFamily: 'pergolas',
        activeObjectRef: { family: 'pergolas', objectId: pergolaId },
        workbenchMode: 'pergolas',
        activeHouseSelection: { kind: 'house', targetId: null },
        activePergolaId: pergolaId,
      };
    }
    case 'decks': {
      const deckId = current.activeHouseSelection.kind === 'deck' ? current.activeHouseSelection.targetId : null;
      return {
        activeRailTab: 'decks',
        activeObjectFamily: 'decks',
        activeObjectRef: { family: 'decks', objectId: deckId },
        workbenchMode: 'house',
        activeHouseSelection: deckId ? { kind: 'deck', targetId: deckId } : { kind: 'house', targetId: null },
        activePergolaId: null,
      };
    }
    case 'openings': {
      const openingId = current.activeHouseSelection.kind === 'opening' ? current.activeHouseSelection.targetId : null;
      return {
        activeRailTab: 'openings',
        activeObjectFamily: 'openings',
        activeObjectRef: { family: 'openings', objectId: openingId },
        workbenchMode: 'house',
        activeHouseSelection: openingId ? { kind: 'opening', targetId: openingId } : { kind: 'house', targetId: null },
        activePergolaId: null,
      };
    }
    case 'diagnostics':
      return {
        activeRailTab: 'diagnostics',
        activeObjectFamily: current.activeObjectFamily,
        activeObjectRef: current.activeObjectRef,
        workbenchMode: current.workbenchMode,
        activeHouseSelection: current.activeHouseSelection,
        activePergolaId: current.activePergolaId,
      };
    case 'house_forms':
    default:
      return {
        activeRailTab: 'house_forms',
        activeObjectFamily: 'house_forms',
        activeObjectRef: { family: 'house_forms', objectId: null },
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'house', targetId: null },
        activePergolaId: null,
      };
  }
}

function deriveRailTabFromHouseSelection(selection: WorkbenchHouseSelection): Exclude<DrawingWorkbenchRailTab, 'diagnostics'> {
  switch (selection.kind) {
    case 'deck':
      return 'decks';
    case 'opening':
      return 'openings';
    default:
      return 'house_forms';
  }
}

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
      ...clearObjectSelectionForTab(current, 'house_forms'),
    }));
  }, [resetDrawOutlineTarget, setUi]);

  const selectPergolaWorkbenchMode = useCallback(
    (defaultPergolaId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        activeRailTab: 'pergolas',
        workbenchMode: 'pergolas',
        activePergolaId: defaultPergolaId ?? current.activePergolaId,
        activeObjectFamily: 'pergolas',
        activeObjectRef: {
          family: 'pergolas',
          objectId: defaultPergolaId ?? current.activePergolaId,
        },
        activeHouseSelection: { kind: 'house', targetId: null },
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const selectRailTab = useCallback(
    (tab: DrawingWorkbenchRailTab, defaultPergolaId: string | null = null) => {
      resetDrawOutlineTarget();
      setUi((current) => {
        if (tab === 'pergolas') {
          const pergolaId = defaultPergolaId ?? current.activePergolaId ?? current.activeObjectRef.objectId;
          return {
            ...current,
            activeRailTab: 'pergolas',
            workbenchMode: 'pergolas',
            activePergolaId: pergolaId,
            activeHouseSelection: { kind: 'house', targetId: null },
            activeObjectFamily: 'pergolas',
            activeObjectRef: { family: 'pergolas', objectId: pergolaId },
          };
        }

        return {
          ...current,
          ...clearObjectSelectionForTab(current, tab),
        };
      });
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
        activeRailTab: 'house_forms',
        activeHouseSelection: { kind: 'footprint', targetId: null },
        activePergolaId: null,
        activeObjectFamily: 'house_forms',
        activeObjectRef: { family: 'house_forms', objectId: null },
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
        activeRailTab: 'decks',
        activeHouseSelection: { kind: 'deck', targetId: deckId },
        activePergolaId: null,
        activeObjectFamily: 'decks',
        activeObjectRef: { family: 'decks', objectId: deckId },
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
        activeRailTab: 'decks',
        workbenchMode: 'house',
        activeHouseSelection: deckId ? { kind: 'deck', targetId: deckId } : { kind: 'house', targetId: null },
        activePergolaId: null,
        activeObjectFamily: 'decks',
        activeObjectRef: { family: 'decks', objectId: deckId },
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const selectSharedHouseOpening = useCallback(
    (openingId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        activeRailTab: 'openings',
        workbenchMode: 'house',
        activeHouseSelection: openingId
          ? { kind: 'opening', targetId: openingId }
          : { kind: 'house', targetId: null },
        activePergolaId: null,
        activeObjectFamily: 'openings',
        activeObjectRef: { family: 'openings', objectId: openingId },
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const selectHouseFirstTarget = useCallback(
    (selection: WorkbenchHouseSelection) => {
      resetDrawOutlineTarget();
      const nextTab = deriveRailTabFromHouseSelection(selection);
      setUi((current) => ({
        ...current,
        workbenchMode: 'house',
        activeHouseSelection: selection,
        activePergolaId: null,
        activeRailTab: nextTab,
        activeObjectFamily: nextTab,
        activeObjectRef: {
          family: nextTab,
          objectId: nextTab === 'decks' || nextTab === 'openings' ? selection.targetId ?? null : null,
        },
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const selectPergolaObject = useCallback(
    (pergolaId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        activeRailTab: 'pergolas',
        workbenchMode: 'pergolas',
        activeHouseSelection: { kind: 'house', targetId: null },
        activePergolaId: pergolaId ?? current.activePergolaId,
        activeObjectFamily: 'pergolas',
        activeObjectRef: {
          family: 'pergolas',
          objectId: pergolaId ?? current.activePergolaId,
        },
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const clearActiveWorkbenchSelection = useCallback(() => {
    resetDrawOutlineTarget();
    setUi((current) => {
      const family =
        current.activeRailTab === 'diagnostics' ? current.activeObjectFamily : current.activeRailTab;
      return {
        ...current,
        activeObjectFamily: family,
        activeObjectRef: { family, objectId: null },
        activeHouseSelection: current.workbenchMode === 'house' ? { kind: 'house', targetId: null } : current.activeHouseSelection,
      };
    });
  }, [resetDrawOutlineTarget, setUi]);

  return {
    selectHouseWorkbenchMode,
    selectPergolaWorkbenchMode,
    selectRailTab,
    startDrawOutlineEditor,
    startDeckOutlineEditor,
    selectSharedHouseDeck,
    selectSharedHouseOpening,
    selectHouseFirstTarget,
    selectPergolaObject,
    clearActiveWorkbenchSelection,
  };
}
