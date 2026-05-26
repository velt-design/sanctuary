import type { EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { DrawingWorkbenchRailModel } from '@/lib/drawings/state/drawingWorkbenchRailModel';
import type { HouseFormRoofIntentModel, WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';

export type CommitResult = { ok: boolean; error?: string };

/*
 * PR-W3d.5 (2026-05-25): inspector context slimmed to just the rail's
 * "Add structure" callback. All other inspector wiring (footprint edits,
 * roof intent, deck/opening patches, attachment context, diagnostics)
 * moved to `WorkbenchInspectorHost` which builds the right-panel inspector
 * content from its own copy of the store + actions. The rail's only
 * inspector-side need is the inline `+ Add structure` button on the
 * House Forms tree section.
 */
export type ObjectWorkbenchRailInspectorContext = {
  /**
   * PR10: rail "Add structure" button. Clones the active form (or
   * primary if none selected) via PR5's `addHouseFormToObjectFirstDraft`
   * and selects the new form. Disabled when locked.
   */
  onAddHouseForm?: () => Promise<CommitResult> | CommitResult;
};

export type ObjectWorkbenchRailProps = {
  model: DrawingWorkbenchRailModel;
  disabled?: boolean;
  activeObjectRef: WorkbenchObjectRef;
  visibility: DrawingWorkbenchVisibilityState;
  // PR-W3d (2026-05-25): `activeRailTab` + `onSelectRailTab` removed. The
  // rail no longer has a tab strip; selection drives the active family via
  // `activeObjectRef.family` and is dispatched through `onSelectObjectRef`.
  onSelectObjectRef?: (ref: WorkbenchObjectRef) => void;
  onVisibilityChange?: (family: keyof DrawingWorkbenchVisibilityState, visible: boolean) => void;
  inspectorContext: ObjectWorkbenchRailInspectorContext;
};

export type FieldErrors = Record<string, string>;

export type RunFootprintCommit = (fieldId: string, edit: EstimateDrawingFootprintEdit) => Promise<void>;

export type RunRoofCommit = (fieldId: string, nextRoof: HouseFormRoofIntentModel) => Promise<void>;

export type RunAction = (
  fieldId: string,
  action: Promise<CommitResult> | CommitResult | undefined,
  fallbackMessage: string,
) => Promise<void>;
