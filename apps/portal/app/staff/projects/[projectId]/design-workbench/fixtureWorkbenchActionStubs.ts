/*
 * PR-T5 (2026-05-26) — fixture-only no-op stubs for the workbench action
 * surfaces. Used exclusively by `DesignWorkbenchFixtureClient` to mount
 * `WorkbenchInspectorHost` in the read-only `/qa/design-workbench-fixture`
 * route so AI-assisted visual iteration runs against the same inspector
 * code path users see in production.
 *
 * Contract: every function returns immediately with `{ ok: true }` (or
 * the appropriate void/state-only effect). Nothing persists. The fixture
 * is read-only by design; `isLocked={true}` on the inspector host means
 * the rendered controls appear disabled so users of the snapshot route
 * can't accidentally "edit" a fixture and wonder why nothing happens.
 *
 * Why stubs and not the real hooks: the real `useObjectWorkbenchActions`
 * and `useObjectWorkbenchSelection` hooks depend on a real `EstimateDetail`
 * with DB-backed fields + a `persistDrawingDraftLocally` callback wired to
 * the local-first storage layer. Fabricating those for fixture mode is
 * more code than this — and would conflate the "render the inspector"
 * concern with the "persist edits" concern. Stubs keep that separation
 * crisp.
 *
 * Why these stubs intentionally use `ReturnType<typeof use*>` for typing:
 * when production adds a new action function, the stub object becomes
 * structurally invalid and TypeScript fails the build until the stub
 * catches up. That's the maintenance signal that keeps this fixture from
 * silently drifting away from the production surface it's meant to mirror.
 */

import type { Dispatch, SetStateAction } from 'react';
import {
  buildDrawingWorkbenchObjectSelectionState,
  type DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { ObjectWorkbenchViewportTargetSelection } from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchActions } from './useObjectWorkbenchActions';
import type { ObjectWorkbenchSelectionActions } from './useObjectWorkbenchSelection';
import { buildPergolaSelectionUiState } from './pergolaSelectionState';

const ok = async () => ({ ok: true as const });

function buildObjectRefForFixtureViewportTarget(
  selection: ObjectWorkbenchViewportTargetSelection,
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
    objectId: selection.targetId,
  };
}

/**
 * Build the selection-actions stub. The `setUi` setter is wired through
 * for the handful of actions whose only effect is updating local UI state
 * (e.g. selecting a different rail row). Everything else returns a
 * successful no-op commit result.
 */
export function buildFixtureSelectionActions(
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>,
): ObjectWorkbenchSelectionActions {
  // Local helpers — these mirror what the real hook does for the
  // state-only actions, but without the draw-outline-target side effects
  // (which would require additional setters the fixture doesn't own).
  const noopVoid = () => {
    /* fixture mode: pure no-op */
  };

  return {
    selectHouseFormsWorkbenchMode: noopVoid,
    selectPergolaWorkbenchMode: noopVoid,
    selectRailTab: noopVoid,
    selectObjectRef: (ref) =>
      setUi((current) => ({
        ...current,
        ...(ref.family === 'pergolas' ? { activePergolaId: ref.objectId } : {}),
        ...buildDrawingWorkbenchObjectSelectionState({
          activeRailTab: ref.family,
          activeObjectRef: ref,
        }),
        selection: { kind: 'none', targetId: null },
      })),
    startDrawOutlineEditor: () => ({ ok: true as const }),
    startDeckOutlineEditor: () => ({ ok: true as const }),
    selectDeckObject: (deckId) =>
      setUi((current) => ({
        ...current,
        ...buildDrawingWorkbenchObjectSelectionState({
          activeRailTab: 'decks',
          activeObjectRef: { family: 'decks', objectId: deckId },
        }),
        selection: { kind: 'none', targetId: null },
      })),
    selectOpeningObject: (openingId) =>
      setUi((current) => ({
        ...current,
        ...buildDrawingWorkbenchObjectSelectionState({
          activeRailTab: 'openings',
          activeObjectRef: { family: 'openings', objectId: openingId },
        }),
        selection: { kind: 'none', targetId: null },
      })),
    selectObjectWorkbenchTarget: (selection) =>
      setUi((current) => {
        const ref = buildObjectRefForFixtureViewportTarget(selection);
        return {
          ...current,
          ...buildDrawingWorkbenchObjectSelectionState({
            activeRailTab: ref.family,
            activeObjectRef: ref,
          }),
          selection: {
            kind: selection.kind === 'house' ? 'none' : 'geometry',
            targetId: selection.targetId,
            targetKind: selection.kind === 'house' ? undefined : selection.kind,
          },
        };
      }),
    selectPergolaObject: (pergolaId) =>
      setUi((current) =>
        buildPergolaSelectionUiState({
          current,
          pergolaId,
        }),
      ),
    clearActiveWorkbenchSelection: () =>
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
          }),
          selection: { kind: 'none', targetId: null },
        };
      }),
  };
}

/**
 * Build the object-workbench-actions stub. All commit / add / remove
 * handlers return a successful no-op. The inspector renders all editable
 * controls because `isLocked={true}` on the host disables them visually.
 */
export function buildFixtureWorkbenchActions(): ObjectWorkbenchActions {
  return {
    addSharedPergola: ok,
    addSharedHouseDeck: ok,
    addSharedHouseForm: ok,
    addSharedHouseOpening: ok,
    commitHouseFormFootprintEdit: ok,
    commitHouseFormTransformDelta: ok,
    commitDrawingField: ok,
    commitDeckDimension: ok,
    commitGeometryIntent: ok,
    commitHouseFormFootprintDimension: ok,
    commitHouseFormRoofIntent: ok,
    commitOpeningDimension: ok,
    commitSharedPergolaAttachment: ok,
    commitSharedPergolaEdgeDragResult: ok,
    commitSharedDeckCustomPolygon: ok,
    commitSharedHouseDeckPatch: ok,
    commitSharedHouseFootprintEdit: ok,
    commitSharedHouseOpeningPatch: ok,
    commitSharedHouseRoofDraft: ok,
    removeSharedHouseDeck: ok,
    removeSharedHouseForm: ok,
    removeSharedHouseOpening: ok,
  };
}
