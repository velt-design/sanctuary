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
import type { WorkbenchObjectFamily, WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { CommitResult, DrawOutlineTarget } from './objectWorkbenchClientTypes';

type UseObjectWorkbenchSelectionInput = {
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>;
  setDrawOutlineTarget: Dispatch<SetStateAction<DrawOutlineTarget>>;
  setDrawOutlineRequestId: Dispatch<SetStateAction<number>>;
  availableObjectIdsByFamily: Record<WorkbenchObjectFamily, string[]>;
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

function buildSelectionStateForObjectRef(
  current: DrawingWorkbenchUiState,
  ref: WorkbenchObjectRef,
  houseSelectionOverride?: WorkbenchHouseSelection,
): DrawingWorkbenchCanonicalSelectionState {
  return buildDrawingWorkbenchCanonicalSelectionState({
    activeRailTab: ref.family,
    activeObjectRef: ref,
    activeHouseSelection:
      houseSelectionOverride ??
      (ref.family === 'decks'
        ? ref.objectId
          ? { kind: 'deck', targetId: ref.objectId }
          : { kind: 'house', targetId: null }
        : ref.family === 'openings'
          ? ref.objectId
            ? { kind: 'opening', targetId: ref.objectId }
            : { kind: 'house', targetId: null }
          : ref.family === 'house_forms'
            ? { kind: 'house', targetId: null }
            : current.activeHouseSelection),
    activePergolaId: ref.family === 'pergolas' ? ref.objectId : current.activePergolaId,
  });
}

export function useObjectWorkbenchSelection({
  setUi,
  setDrawOutlineTarget,
  setDrawOutlineRequestId,
  availableObjectIdsByFamily,
}: UseObjectWorkbenchSelectionInput) {
  const resetDrawOutlineTarget = useCallback(() => {
    setDrawOutlineTarget(FOOTPRINT_DRAW_OUTLINE_TARGET);
  }, [setDrawOutlineTarget]);

  const getDefaultObjectId = useCallback(
    (family: WorkbenchObjectFamily) => availableObjectIdsByFamily[family][0] ?? null,
    [availableObjectIdsByFamily],
  );

  const selectHouseFormsWorkbenchMode = useCallback(() => {
    resetDrawOutlineTarget();
    setUi((current) => ({
      ...current,
      ...buildSelectionStateForObjectRef(current, {
        family: 'house_forms',
        objectId:
          current.activeObjectRef.family === 'house_forms' && current.activeObjectRef.objectId
            ? current.activeObjectRef.objectId
            : getDefaultObjectId('house_forms'),
      }),
    }));
  }, [getDefaultObjectId, resetDrawOutlineTarget, setUi]);

  const selectPergolaWorkbenchMode = useCallback(
    (defaultPergolaId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        ...buildSelectionStateForObjectRef(current, {
          family: 'pergolas',
          objectId:
            defaultPergolaId ??
            (current.activeObjectRef.family === 'pergolas' ? current.activeObjectRef.objectId : null) ??
            current.activePergolaId ??
            getDefaultObjectId('pergolas'),
        }),
      }));
    },
    [getDefaultObjectId, resetDrawOutlineTarget, setUi],
  );

  const selectRailTab = useCallback(
    (tab: DrawingWorkbenchRailTab, defaultObjectId: string | null = null) => {
      resetDrawOutlineTarget();
      setUi((current) => {
        if (tab === 'diagnostics') {
          return {
            ...current,
            ...buildSelectionStateForTab(current, tab),
          };
        }

        const family = tab;
        const objectId =
          current.activeObjectRef.family === family && current.activeObjectRef.objectId
            ? current.activeObjectRef.objectId
            : defaultObjectId ?? getDefaultObjectId(family);

        return {
          ...current,
          ...buildSelectionStateForObjectRef(current, {
            family,
            objectId,
          }),
        };
      });
    },
    [getDefaultObjectId, resetDrawOutlineTarget, setUi],
  );

  const selectObjectRef = useCallback(
    (ref: WorkbenchObjectRef) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        ...buildSelectionStateForObjectRef(current, ref),
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const startDrawOutlineEditor = useCallback((): CommitResult => {
    setDrawOutlineTarget(FOOTPRINT_DRAW_OUTLINE_TARGET);
    setUi((current) => ({
      ...current,
      viewportMode: 'model',
      activeView: 'plan',
      ...buildSelectionStateForObjectRef(
        current,
        {
          family: 'house_forms',
          objectId: getDefaultObjectId('house_forms'),
        },
        { kind: 'footprint', targetId: null },
      ),
    }));
    setDrawOutlineRequestId((current) => current + 1);
    return { ok: true };
  }, [getDefaultObjectId, setDrawOutlineRequestId, setDrawOutlineTarget, setUi]);

  const startDeckOutlineEditor = useCallback(
    (deckId: string): CommitResult => {
      setDrawOutlineTarget({ kind: 'deck', deckId });
      setUi((current) => ({
        ...current,
        viewportMode: 'model',
        activeView: 'plan',
        ...buildSelectionStateForObjectRef(current, { family: 'decks', objectId: deckId }),
      }));
      setDrawOutlineRequestId((current) => current + 1);
      return { ok: true };
    },
    [setDrawOutlineRequestId, setDrawOutlineTarget, setUi],
  );

  const selectDeckObject = useCallback(
    (deckId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        ...buildSelectionStateForObjectRef(current, { family: 'decks', objectId: deckId }),
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const selectOpeningObject = useCallback(
    (openingId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        ...buildSelectionStateForObjectRef(current, { family: 'openings', objectId: openingId }),
      }));
    },
    [resetDrawOutlineTarget, setUi],
  );

  const selectObjectWorkbenchTarget = useCallback(
    (selection: WorkbenchHouseSelection) => {
      resetDrawOutlineTarget();
      const nextTab = deriveRailTabFromHouseSelection(selection);
      setUi((current) => ({
        ...current,
        ...buildDrawingWorkbenchCanonicalSelectionState({
          activeRailTab: nextTab,
          activeObjectRef: {
            family: nextTab,
            objectId:
              nextTab === 'decks' || nextTab === 'openings'
                ? selection.targetId ?? null
                : getDefaultObjectId('house_forms'),
          },
          activeHouseSelection: selection,
        }),
      }));
    },
    [getDefaultObjectId, resetDrawOutlineTarget, setUi],
  );

  const selectPergolaObject = useCallback(
    (pergolaId: string | null) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        ...buildSelectionStateForObjectRef(current, {
          family: 'pergolas',
          objectId: pergolaId,
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
            current.activeObjectFamily === 'decks' || current.activeObjectFamily === 'openings'
              ? { kind: 'house', targetId: null }
              : current.activeObjectFamily === 'house_forms'
                ? { kind: 'house', targetId: null }
                : current.activeHouseSelection,
          activePergolaId: current.activeRailTab === 'pergolas' ? null : current.activePergolaId,
        }),
      };
    });
  }, [resetDrawOutlineTarget, setUi]);

  return {
    selectHouseFormsWorkbenchMode,
    selectPergolaWorkbenchMode,
    selectRailTab,
    selectObjectRef,
    startDrawOutlineEditor,
    startDeckOutlineEditor,
    selectDeckObject,
    selectOpeningObject,
    selectObjectWorkbenchTarget,
    selectPergolaObject,
    clearActiveWorkbenchSelection,
  };
}
