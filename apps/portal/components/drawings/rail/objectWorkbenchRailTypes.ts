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
type ObjectWorkbenchRailInspectorContext = {
  /**
   * Rail "Add structure" button. Clones the selected/current form when
   * available, or creates a deterministic first form for an explicit
   * zero-house object-first assembly. Disabled when locked.
   */
  onAddHouseForm?: () => Promise<CommitResult> | CommitResult;
  /**
   * PR-T6 (2026-05-26): inline "+ Add X" pills on the OBJECTS TREE.
   * Decks/openings defer mode/kind choice to existing add helpers. Pergolas
   * create a freestanding object-first pergola and let snap form the host
   * relationship later.
   */
  onAddPergola?: () => Promise<CommitResult> | CommitResult;
  onAddDeck?: () => Promise<CommitResult> | CommitResult;
  onAddOpening?: () => Promise<CommitResult> | CommitResult;
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
