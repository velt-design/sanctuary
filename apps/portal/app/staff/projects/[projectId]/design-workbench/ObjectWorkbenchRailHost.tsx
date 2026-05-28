'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import ObjectWorkbenchRail from '@/components/drawings/rail/ObjectWorkbenchRail';
import type { ObjectWorkbenchGeometryEditState } from '@/lib/drawings/geometry/geometryEditAdapter';
import type { DrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  buildDrawingWorkbenchObjectSelectionState,
  type DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { ObjectWorkbenchActions } from './useObjectWorkbenchActions';
import type { ObjectWorkbenchSelectionActions } from './useObjectWorkbenchSelection';

/*
 * PR-W3d (2026-05-25) — thin wrapper around the visibility + flat OBJECTS
 * TREE rail. Inspector panel building moved to `WorkbenchInspectorHost`
 * (right-side `RightInspectorPanel`); this host now only:
 *   - forwards visibility + object-ref selection state to the rail
 *   - bridges pergola row clicks into the legacy `activeModuleIndex` so
 *     downstream consumers (sheet preview, viewport keys, etc.) that still
 *     index by module position stay in sync
 *   - wires the rail's inline "+ Add structure" affordance
 *
 * `activeRailTab` and `onSelectRailTab` are gone — the rail no longer has
 * a tab strip. Family activity is derived from `activeObjectRef.family`
 * by `WorkbenchInspectorHost`.
 */

type ObjectWorkbenchRailHostProps = {
  activeModuleInput: CalculatorModuleInputs | null;
  geometryEditState: ObjectWorkbenchGeometryEditState | null;
  isLocked: boolean;
  objectSelectionActions: ObjectWorkbenchSelectionActions;
  objectWorkbenchActions: ObjectWorkbenchActions;
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>;
  store: DrawingWorkbenchStore;
  supportsSanctuaryEditing: boolean;
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
      setUi((current) => {
        const nextModuleIndex =
          pergolaId === null
            ? current.activeModuleIndex
            : Math.max(
                0,
                store.persisted.modules.findIndex(
                  (module) => module.drawingModule.input.pergolaId === pergolaId,
                ),
              );
        return {
          ...current,
          activeModuleIndex: nextModuleIndex,
          ...buildDrawingWorkbenchObjectSelectionState({
            activeRailTab: 'pergolas',
            activeObjectRef: { family: 'pergolas', objectId: pergolaId },
          }),
        };
      });
    },
    [setUi, store.persisted.modules],
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
