import type { ReactNode } from 'react';
import type { EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type {
  DrawingWorkbenchRailTab,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
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

export type HouseFirstWorkbenchRailProps = {
  house: HouseModel | null;
  pergolas: PergolaModel[];
  warnings: HouseFirstMigrationWarning[];
  disabled?: boolean;
  activeRailTab: DrawingWorkbenchRailTab;
  activeObjectRef: WorkbenchObjectRef;
  activeDeckId?: string | null;
  activeOpeningId?: string | null;
  canEditFootprint?: boolean;
  canStartDrawOutline?: boolean;
  visibility: DrawingWorkbenchVisibilityState;
  onSelectRailTab?: (tab: DrawingWorkbenchRailTab) => void;
  onVisibilityChange?: (family: keyof DrawingWorkbenchVisibilityState, visible: boolean) => void;
  onStartDrawOutline?: () => Promise<CommitResult> | CommitResult;
  onCommitFootprintEdit?: (edit: EstimateDrawingFootprintEdit) => Promise<CommitResult> | CommitResult;
  onCommitRoofDraft?: (roof: HouseFirstRoofDraft) => Promise<CommitResult> | CommitResult;
  onSelectDeck?: (deckId: string | null) => void;
  onSelectOpening?: (openingId: string | null) => void;
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
  pergolaPanel: ReactNode;
  diagnosticsPanel: ReactNode;
};

export type FieldErrors = Record<string, string>;

export type RunFootprintCommit = (fieldId: string, edit: EstimateDrawingFootprintEdit) => Promise<void>;

export type RunRoofCommit = (fieldId: string, nextRoof: HouseFirstRoofDraft) => Promise<void>;

export type RunAction = (
  fieldId: string,
  action: Promise<CommitResult> | CommitResult | undefined,
  fallbackMessage: string,
) => Promise<void>;
