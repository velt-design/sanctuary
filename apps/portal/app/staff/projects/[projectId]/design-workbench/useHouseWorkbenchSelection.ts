'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  buildDrawingWorkbenchCanonicalSelectionState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  DrawingWorkbenchRailTab,
  DrawingWorkbenchUiState,
  DrawingWorkbenchCanonicalSelectionState,
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

function buildSelectionStateForTab(
  current: DrawingWorkbenchUiState,
  tab: DrawingWorkbenchRailTab,
) : DrawingWorkbenchCanonicalSelectionState {
  return buildDrawingWorkbenchCanonicalSelectionState({
    activeRailTab: tab,
    activeObjectFamily: current.activeObjectFamily,
    activeObjectRef: current.activeObjectRef,
    activeHouseSelection:
      tab === 'diagnostics'
        ? current.activeHouseSelection
        : tab === 'house_forms'
          ? { kind: 'house', targetId: null }
          : current.activeHouseSelection,
    activePergolaId: current.activePergolaId,
  });
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
      ...buildSelectionStateForTab(current, 'house_forms'),
    }));
  }, [resetDrawOutlineTarget, setUi]);

  const selectPergolaWorkbenchMode = useCallback(
    (defaultPergolaId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        ...buildDrawingWorkbenchCanonicalSelectionState({
          activeRailTab: 'pergolas',
          activeObjectRef: {
            family: 'pergolas',
            objectId: defaultPergolaId ?? current.activePergolaId,
          },
          activePergolaId: defaultPergolaId ?? current.activePergolaId,
        }),
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
            ...buildDrawingWorkbenchCanonicalSelectionState({
              activeRailTab: 'pergolas',
              activeObjectRef: { family: 'pergolas', objectId: pergolaId },
              activePergolaId: pergolaId,
            }),
          };
        }

        return {
          ...current,
          ...buildSelectionStateForTab(current, tab),
        };
      });
    },
    [resetDrawOutlineTarget, setUi],
  );

  const startDrawOutlineEditor = useCallback((): CommitResult => {
    setDrawOutlineTarget(FOOTPRINT_DRAW_OUTLINE_TARGET);
    setUi((current) => ({
      ...current,
      viewportMode: 'model',
      activeView: 'plan',
      ...buildDrawingWorkbenchCanonicalSelectionState({
        activeRailTab: 'house_forms',
        activeHouseSelection: { kind: 'footprint', targetId: null },
      }),
    }));
    setDrawOutlineRequestId((current) => current + 1);
    return { ok: true };
  }, [setDrawOutlineRequestId, setDrawOutlineTarget, setUi]);

  const startDeckOutlineEditor = useCallback(
    (deckId: string): CommitResult => {
      setDrawOutlineTarget({ kind: 'deck', deckId });
      setUi((current) => ({
        ...current,
        viewportMode: 'model',
        activeView: 'plan',
        ...buildDrawingWorkbenchCanonicalSelectionState({
          activeRailTab: 'decks',
          activeObjectRef: { family: 'decks', objectId: deckId },
          activeHouseSelection: { kind: 'deck', targetId: deckId },
        }),
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
        ...buildDrawingWorkbenchCanonicalSelectionState({
          activeRailTab: 'decks',
          activeObjectRef: { family: 'decks', objectId: deckId },
          activeHouseSelection: deckId ? { kind: 'deck', targetId: deckId } : { kind: 'house', targetId: null },
        }),
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const selectSharedHouseOpening = useCallback(
    (openingId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        ...buildDrawingWorkbenchCanonicalSelectionState({
          activeRailTab: 'openings',
          activeObjectRef: { family: 'openings', objectId: openingId },
          activeHouseSelection: openingId
            ? { kind: 'opening', targetId: openingId }
            : { kind: 'house', targetId: null },
        }),
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
        ...buildDrawingWorkbenchCanonicalSelectionState({
          activeRailTab: nextTab,
          activeObjectRef: {
            family: nextTab,
            objectId: nextTab === 'decks' || nextTab === 'openings' ? selection.targetId ?? null : null,
          },
          activeHouseSelection: selection,
        }),
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const selectPergolaObject = useCallback(
    (pergolaId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        ...buildDrawingWorkbenchCanonicalSelectionState({
          activeRailTab: 'pergolas',
          activeObjectRef: {
            family: 'pergolas',
            objectId: pergolaId ?? current.activePergolaId,
          },
          activePergolaId: pergolaId ?? current.activePergolaId,
        }),
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const clearActiveWorkbenchSelection = useCallback(() => {
    resetDrawOutlineTarget();
    setUi((current) => {
      return {
        ...current,
        ...buildDrawingWorkbenchCanonicalSelectionState({
          activeRailTab: current.activeRailTab,
          activeObjectFamily: current.activeObjectFamily,
          activeObjectRef: {
            family: current.activeRailTab === 'diagnostics' ? current.activeObjectFamily : current.activeRailTab,
            objectId: null,
          },
          activeHouseSelection:
            current.activeRailTab === 'diagnostics'
              ? current.activeHouseSelection
              : current.activeObjectFamily === 'house_forms'
                ? { kind: 'house', targetId: null }
                : current.activeHouseSelection,
          activePergolaId: current.activeRailTab === 'pergolas' ? null : current.activePergolaId,
        }),
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
