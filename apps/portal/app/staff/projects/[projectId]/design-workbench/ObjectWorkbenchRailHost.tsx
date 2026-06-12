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
 * PR-W3d (2026-05-25) — thin wrapper around the visibility + flat OBJECTS
 * TREE rail. Inspector panel building moved to `WorkbenchInspectorHost`
 * (right-side `RightInspectorPanel`); this host now only:
 *   - forwards visibility + object-ref selection state to the rail
 *   - writes pergola row clicks into the canonical object-id selection state
 *   - wires the rail's inline "+ Add structure" affordance
 *
 * `activeRailTab` and `onSelectRailTab` are gone — the rail no longer has
 * a tab strip. Family activity is derived from `activeObjectRef.family`
 * by `WorkbenchInspectorHost`.
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
