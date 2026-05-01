import type { PlanPoint } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';

export type InteractionToolPointer = {
  pointerId: number;
  clientX: number;
  clientY: number;
  planPoint: PlanPoint;
};

export type InteractionToolDiagnostics = {
  toolId: string;
  coordinateSpace: string;
  source: string;
  status: 'idle' | 'active' | 'blocked' | 'committed' | 'failed';
  message?: string | null;
};

export type InteractionToolController<TStartInput, TState, TPreview, TRelease> = {
  id: string;
  start: (input: TStartInput, pointer: InteractionToolPointer) => TState | null;
  move: (state: TState, pointer: InteractionToolPointer) => TPreview | null;
  release: (state: TState, preview: TPreview | null) => TRelease | null;
  cancel: (state: TState) => TState | null;
  diagnostics: (state: TState | null, preview: TPreview | null) => InteractionToolDiagnostics;
};

export type CommitAdapterResult<TPatch> = {
  ok: true;
  patch: TPatch;
  commitCoordinateSpace: string;
  diagnostics: Record<string, string | number | boolean | null>;
} | {
  ok: false;
  error: string;
  commitCoordinateSpace: string;
  diagnostics: Record<string, string | number | boolean | null>;
};
