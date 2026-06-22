'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import ObjectWorkbenchRail from '@/components/drawings/rail/ObjectWorkbenchRail';
import type { DrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  type DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { buildPergolaSelectionUiState } from './pergolaSelectionState';
import type { ObjectWorkbenchActions } from './useObjectWorkbenchActions';
import type { ObjectWorkbenchSelectionActions } from './useObjectWorkbenchSelection';

/*
 * Left-rail host for visibility and object-tree navigation.
 *
 * Forwards object-ref selection state, writes pergola row clicks into the
 * canonical object-id selection state, and wires inline add affordances.
 * Inspector panels live in WorkbenchInspectorHost.
 */

type ObjectWorkbenchRailHostProps = {
  isLocked: boolean;
  objectSelectionActions: ObjectWorkbenchSelectionActions;
  objectWorkbenchActions: ObjectWorkbenchActions;
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>;
  store: DrawingWorkbenchStore;
};

export default function ObjectWorkbenchRailHost({
  isLocked,
  objectSelectionActions,
  objectWorkbenchActions,
  setUi,
  store,
}: ObjectWorkbenchRailHostProps) {
  const handleCanonicalPergolaSelection = useCallback(
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

  const handleRailObjectSelect = useCallback(
    (ref: WorkbenchObjectRef) => {
      if (ref.family === 'pergolas') {
        handleCanonicalPergolaSelection(ref.objectId);
        return;
      }
      objectSelectionActions.selectObjectRef(ref);
    },
    [handleCanonicalPergolaSelection, objectSelectionActions],
  );

  return (
    <ObjectWorkbenchRail
      model={store.derived.railModel}
      activeObjectRef={store.ui.activeObjectRef}
      disabled={isLocked}
      visibility={store.ui.visibility}
      onSelectObjectRef={handleRailObjectSelect}
      onVisibilityChange={(family, visible) =>
        setUi((current) => ({
          ...current,
          visibility: {
            ...current.visibility,
            [family]: visible,
          },
        }))
      }
      inspectorContext={{
        onAddHouseForm: !isLocked ? objectWorkbenchActions.addSharedHouseForm : undefined,
        onAddPergola: objectWorkbenchActions.addSharedPergola,
        // PR-T6: defer mode choice to the inspector's existing add helper.
        // Decks default to 'preset' (rectangle) which mirrors what the
        // inspector's first-time-add does today. Openings have a single
        // add path with default opening kind.
        onAddDeck: !isLocked
          ? () => objectWorkbenchActions.addSharedHouseDeck('preset')
          : undefined,
        onAddOpening: !isLocked
          ? () => objectWorkbenchActions.addSharedHouseOpening('window')
          : undefined,
      }}
    />
  );
}
