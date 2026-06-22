'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  buildDrawingWorkbenchObjectSelectionState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { ObjectWorkbenchViewportTargetSelection } from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type { WorkbenchObjectFamily, WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { buildPergolaSelectionUiState } from './pergolaSelectionState';

type ObjectWorkbenchTargetSelection = ObjectWorkbenchViewportTargetSelection;

type UseObjectWorkbenchSelectionInput = {
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>;
  availableObjectIdsByFamily: Record<WorkbenchObjectFamily, string[]>;
};

function buildSelectionStateForObjectRef(
  ref: WorkbenchObjectRef,
): ReturnType<typeof buildDrawingWorkbenchObjectSelectionState> {
  return buildDrawingWorkbenchObjectSelectionState({
    activeObjectRef: ref,
  });
}

function buildObjectRefForViewportTarget(
  selection: ObjectWorkbenchTargetSelection,
  defaultHouseFormId: string | null,
): WorkbenchObjectRef {
  if (selection.kind === 'deck') {
    return {
      family: 'decks',
      objectId: selection.targetId,
    };
  }
  if (selection.kind === 'opening') {
    return {
      family: 'openings',
      objectId: selection.targetId,
    };
  }
  return {
    family: 'house_forms',
    objectId: selection.targetId ?? defaultHouseFormId,
  };
}

export function useObjectWorkbenchSelection({
  setUi,
  availableObjectIdsByFamily,
}: UseObjectWorkbenchSelectionInput) {
  const getDefaultObjectId = useCallback(
    (family: WorkbenchObjectFamily) => availableObjectIdsByFamily[family][0] ?? null,
    [availableObjectIdsByFamily],
  );

  const selectObjectRef = useCallback(
    (ref: WorkbenchObjectRef) => {
      setUi((current) => ({
        ...current,
        ...buildSelectionStateForObjectRef(ref),
        selection: { kind: 'none', targetId: null },
      }));
    },
    [setUi],
  );

  const selectDeckObject = useCallback(
    (deckId: string | null) => {
      setUi((current) => ({
        ...current,
        ...buildSelectionStateForObjectRef({ family: 'decks', objectId: deckId }),
        selection: { kind: 'none', targetId: null },
      }));
    },
    [setUi],
  );

  const selectOpeningObject = useCallback(
    (openingId: string | null) => {
      setUi((current) => ({
        ...current,
        ...buildSelectionStateForObjectRef({ family: 'openings', objectId: openingId }),
        selection: { kind: 'none', targetId: null },
      }));
    },
    [setUi],
  );

  const selectObjectWorkbenchTarget = useCallback(
    (selection: ObjectWorkbenchTargetSelection) => {
      setUi((current) => ({
        ...current,
        ...buildSelectionStateForObjectRef(
          buildObjectRefForViewportTarget(selection, getDefaultObjectId('house_forms')),
        ),
        selection: {
          kind: selection.kind === 'house' ? 'none' : 'geometry',
          targetId: selection.targetId,
          targetKind: selection.kind === 'house' ? undefined : selection.kind,
        },
      }));
    },
    [getDefaultObjectId, setUi],
  );

  const selectPergolaObject = useCallback(
    (pergolaId: string | null) => {
      setUi((current) =>
        buildPergolaSelectionUiState({
          current,
          pergolaId,
        }),
      );
    },
    [setUi],
  );

  const clearActiveWorkbenchSelection = useCallback(() => {
    setUi((current) => {
      const activeFamily = current.activeObjectRef.family;
      return {
        ...current,
        ...buildDrawingWorkbenchObjectSelectionState({
          activeObjectRef: {
            family: activeFamily,
            objectId: null,
          },
        }),
        selection: { kind: 'none', targetId: null },
      };
    });
  }, [setUi]);

  return {
    selectObjectRef,
    selectDeckObject,
    selectOpeningObject,
    selectObjectWorkbenchTarget,
    selectPergolaObject,
    clearActiveWorkbenchSelection,
  };
}

export type ObjectWorkbenchSelectionActions = ReturnType<typeof useObjectWorkbenchSelection>;
