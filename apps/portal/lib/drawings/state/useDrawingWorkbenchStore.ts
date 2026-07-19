'use client';

import { useMemo } from 'react';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { DrawingWorkbenchUiState } from './drawingWorkbenchUiState';
import type { WorkbenchProjectModel } from './objectFirstWorkbenchModel';
import type { WorkbenchGeometryIdentity } from './workbenchSolvedModel';
import {
  buildDrawingWorkbenchSolvedBase,
  buildDrawingWorkbenchStore,
} from './drawingWorkbenchStore';

export function useDrawingWorkbenchStore(input: {
  draft?: EstimateDrawingDraft | null;
  ui: DrawingWorkbenchUiState;
  geometryIdentity?: WorkbenchGeometryIdentity | null;
  projectModel?: WorkbenchProjectModel | null;
}) {
  const solvedBase = useMemo(
    () => buildDrawingWorkbenchSolvedBase({
      draft: input.draft,
      geometryIdentity: input.geometryIdentity,
      projectModel: input.projectModel,
    }),
    [
      input.draft,
      input.geometryIdentity?.designRequestId,
      input.geometryIdentity?.estimateId,
      input.geometryIdentity?.projectId,
      input.projectModel,
    ],
  );
  const store = useMemo(
    () => buildDrawingWorkbenchStore({ ui: input.ui, solvedBase }),
    [input.ui, solvedBase],
  );

  return { solvedBase, store };
}
