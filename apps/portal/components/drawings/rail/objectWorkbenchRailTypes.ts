import type { ReactNode } from 'react';
import type { EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type {
  DrawingWorkbenchRailTab,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { DrawingWorkbenchRailModel } from '@/lib/drawings/state/drawingWorkbenchRailModel';
import type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchInspectorFacade,
  ObjectWorkbenchOpeningPatch,
} from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type {
  HouseFormRoofIntentModel,
  WorkbenchObjectRef,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { OpeningObjectModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';

export type CommitResult = { ok: boolean; error?: string };

export type ObjectWorkbenchRailInspectorContext = {
  objectWorkbench: ObjectWorkbenchInspectorFacade;
  canEditFootprint?: boolean;
  canStartDrawOutline?: boolean;
  onStartDrawOutline?: () => Promise<CommitResult> | CommitResult;
  onCommitFootprintEdit?: (edit: EstimateDrawingFootprintEdit) => Promise<CommitResult> | CommitResult;
  onCommitRoofIntent?: (roof: HouseFormRoofIntentModel) => Promise<CommitResult> | CommitResult;
  onAddDeck?: (mode: 'preset' | 'custom_outline') => Promise<CommitResult> | CommitResult;
  onAddOpening?: (
    kind: Extract<OpeningObjectModel['kind'], 'window' | 'hinged_door' | 'slider' | 'stacker'>,
  ) => Promise<CommitResult> | CommitResult;
  onRemoveDeck?: (deckId: string) => Promise<CommitResult> | CommitResult;
  onRemoveOpening?: (openingId: string) => Promise<CommitResult> | CommitResult;
  onCommitDeckPatch?: (
    deckId: string,
    patch: ObjectWorkbenchDeckPatch,
  ) => Promise<CommitResult> | CommitResult;
  onCommitOpeningPatch?: (
    openingId: string,
    patch: ObjectWorkbenchOpeningPatch,
  ) => Promise<CommitResult> | CommitResult;
  onStartDeckOutline?: (deckId: string) => Promise<CommitResult> | CommitResult;
  houseFormAttachmentContextPanel?: ReactNode;
  pergolaInspectorPanel: ReactNode;
  diagnosticsPanel: ReactNode;
};

export type ObjectWorkbenchRailProps = {
  model: DrawingWorkbenchRailModel;
  disabled?: boolean;
  activeRailTab: DrawingWorkbenchRailTab;
  activeObjectRef: WorkbenchObjectRef;
  visibility: DrawingWorkbenchVisibilityState;
  onSelectRailTab?: (tab: DrawingWorkbenchRailTab) => void;
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
