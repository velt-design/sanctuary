'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  buildDrawingWorkbenchObjectSelectionState,
  buildDrawingWorkbenchObjectSelectionStateFromBridgeTarget,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  DrawingWorkbenchRailTab,
  DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectFamily, WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { CommitResult, DrawOutlineTarget } from './objectWorkbenchClientTypes';

type ObjectWorkbenchTargetSelection = DrawingWorkbenchUiState['activeHouseSelection'];

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
): ReturnType<typeof buildDrawingWorkbenchObjectSelectionState> {
  return buildDrawingWorkbenchObjectSelectionState({
    activeRailTab: tab,
    activeObjectFamily: current.activeObjectFamily,
    activeObjectRef: current.activeObjectRef,
    bridgeHouseSelection: tab === 'diagnostics' ? current.activeHouseSelection : undefined,
    activePergolaId: current.activePergolaId,
  });
}

function buildSelectionStateForObjectRef(
  current: DrawingWorkbenchUiState,
  ref: WorkbenchObjectRef,
  houseSelectionOverride?: ObjectWorkbenchTargetSelection,
): ReturnType<typeof buildDrawingWorkbenchObjectSelectionState> {
  return buildDrawingWorkbenchObjectSelectionState({
    activeRailTab: ref.family,
    activeObjectRef: ref,
    bridgeHouseSelection: houseSelectionOverride,
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
    (selection: ObjectWorkbenchTargetSelection) => {
      resetDrawOutlineTarget();
      setUi((current) => ({
        ...current,
        ...buildDrawingWorkbenchObjectSelectionStateFromBridgeTarget({
          target: selection,
          defaultHouseFormId: getDefaultObjectId('house_forms'),
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
      const activeFamily =
        current.activeRailTab === 'diagnostics' ? current.activeObjectFamily : current.activeRailTab;
      return {
        ...current,
        ...buildDrawingWorkbenchObjectSelectionState({
          activeRailTab: current.activeRailTab,
          activeObjectFamily: activeFamily,
          activeObjectRef: {
            family: activeFamily,
            objectId: null,
          },
          activePergolaId: activeFamily === 'pergolas' ? null : current.activePergolaId,
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
