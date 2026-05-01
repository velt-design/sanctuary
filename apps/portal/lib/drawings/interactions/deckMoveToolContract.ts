import type { PlanPoint } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type {
  DeckCommitTransformDiagnostics,
  DeckPreviewState,
} from './deckInteractionAdapter';

export type DeckMoveToolCoordinateSpace =
  | 'top_projection_world_m'
  | 'legacy_plan_m'
  | 'unknown';

export type DeckMoveToolState = {
  deckId: string;
  dragSource: 'top_projection_committed' | 'projection_pending_preview' | 'legacy_plan' | 'unknown';
  coordinateSpace: DeckMoveToolCoordinateSpace;
  startPointer: PlanPoint;
  currentPointer: PlanPoint;
  startPolygon: PlanPoint[];
  previewPolygon: PlanPoint[];
  releaseIntent: 'pending' | 'snapped' | 'floating' | 'blocked';
  diagnostics: {
    renderFrameId: string | null;
    commitFrameId: string | null;
    snapFrameSource: string | null;
  };
};

export type DeckMoveReleaseIntent = {
  deckId: string;
  preview: DeckPreviewState;
  previewPolygon: PlanPoint[];
  releasePlacement: 'snapped' | 'floating';
  commitTransform: DeckCommitTransformDiagnostics;
};
