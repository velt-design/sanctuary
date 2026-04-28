import type { ReactNode } from 'react';
import type { EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type {
  DrawingWorkbenchRailTab,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { DrawingWorkbenchRailModel } from '@/lib/drawings/state/drawingWorkbenchRailModel';
import type {
  HouseFirstDeckDraft,
  HouseFirstMigrationWarning,
  HouseFirstOpeningDraft,
  HouseFirstRoofDraft,
  HouseModel,
  PergolaModel,
  WallOpeningKind,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';

export type CommitResult = { ok: boolean; error?: string };

export type HouseFirstWorkbenchRailCompatibilityInspectorState = {
  house: HouseModel | null;
  pergolas: PergolaModel[];
  warnings: HouseFirstMigrationWarning[];
  activeDeckId?: string | null;
  activeOpeningId?: string | null;
  canEditFootprint?: boolean;
  canStartDrawOutline?: boolean;
  onStartDrawOutline?: () => Promise<CommitResult> | CommitResult;
  onCommitFootprintEdit?: (edit: EstimateDrawingFootprintEdit) => Promise<CommitResult> | CommitResult;
  onCommitRoofDraft?: (roof: HouseFirstRoofDraft) => Promise<CommitResult> | CommitResult;
  onAddDeck?: (mode: 'preset' | 'custom_outline') => Promise<CommitResult> | CommitResult;
  onAddOpening?: (
    kind: Extract<WallOpeningKind, 'window' | 'hinged_door' | 'slider' | 'stacker'>,
  ) => Promise<CommitResult> | CommitResult;
  onRemoveDeck?: (deckId: string) => Promise<CommitResult> | CommitResult;
  onRemoveOpening?: (openingId: string) => Promise<CommitResult> | CommitResult;
  onCommitDeckPatch?: (
    deckId: string,
    patch: Partial<HouseFirstDeckDraft>,
  ) => Promise<CommitResult> | CommitResult;
  onCommitOpeningPatch?: (
    openingId: string,
    patch: Partial<HouseFirstOpeningDraft>,
  ) => Promise<CommitResult> | CommitResult;
  onStartDeckOutline?: (deckId: string) => Promise<CommitResult> | CommitResult;
  houseContextPanel?: ReactNode;
  pergolaInspectorPanel: ReactNode;
  diagnosticsPanel: ReactNode;
};

export type HouseFirstWorkbenchRailProps = {
  model: DrawingWorkbenchRailModel;
  disabled?: boolean;
  activeRailTab: DrawingWorkbenchRailTab;
  activeObjectRef: WorkbenchObjectRef;
  visibility: DrawingWorkbenchVisibilityState;
  onSelectRailTab?: (tab: DrawingWorkbenchRailTab) => void;
  onSelectObjectRef?: (ref: WorkbenchObjectRef) => void;
  onVisibilityChange?: (family: keyof DrawingWorkbenchVisibilityState, visible: boolean) => void;
  compatibilityInspectorState: HouseFirstWorkbenchRailCompatibilityInspectorState;
};

export type FieldErrors = Record<string, string>;

export type RunFootprintCommit = (fieldId: string, edit: EstimateDrawingFootprintEdit) => Promise<void>;

export type RunRoofCommit = (fieldId: string, nextRoof: HouseFirstRoofDraft) => Promise<void>;

export type RunAction = (
  fieldId: string,
  action: Promise<CommitResult> | CommitResult | undefined,
  fallbackMessage: string,
) => Promise<void>;
