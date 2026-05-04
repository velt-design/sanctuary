'use client';

import { useCallback, useRef } from 'react';
import Geometry3DViewport, { type Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import {
  defaultPrefixClassifier,
  routeSelectedObject,
  type SelectionClassifier,
} from '@/components/drawings/viewports/selection/selectionRouter';
import type { GeometryPreviewState } from '@/lib/drawings/state/workbenchSolvedModel';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  ObjectWorkbenchDisplayFamily,
  ObjectWorkbenchViewportTargetSelection,
} from '@/lib/drawings/state/objectWorkbenchViewportTypes';

type GeometryCameraPreset = 'iso' | 'front' | 'right' | 'top' | 'custom';

export type DesignViewportProps = {
  geometryPreview?: GeometryPreviewState | null;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  viewportKey?: string;
  viewportState?: Geometry3DViewportState | null;
  onViewportStateChange?: (next: Geometry3DViewportState) => void;
  lockedViewPreset?: GeometryCameraPreset;
  selectedObjectId?: string | null;
  selectionClassifier?: SelectionClassifier;
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
};

export default function DesignViewport({
  geometryPreview,
  objectWorkbenchDisplayFamily,
  visibility,
  viewportKey,
  viewportState,
  onViewportStateChange,
  lockedViewPreset,
  selectedObjectId,
  selectionClassifier = defaultPrefixClassifier,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
  onClearWorkbenchSelection,
}: DesignViewportProps) {
  const lastDispatchedRef = useRef<string | null>(selectedObjectId ?? null);

  const handleSelectedObjectChange = useCallback(
    (nextObjectId: string | null) => {
      if (lastDispatchedRef.current === nextObjectId) return;
      lastDispatchedRef.current = nextObjectId;

      const target = routeSelectedObject(nextObjectId, selectionClassifier);
      switch (target.kind) {
        case 'none':
          onClearWorkbenchSelection?.();
          return;
        case 'pergola':
          onSelectPergolaTarget?.(target.pergolaId);
          return;
        case 'workbench':
          onSelectObjectWorkbenchTarget?.({
            kind: target.targetKind,
            targetId: target.targetId,
          });
          return;
        case 'unhandled':
          return;
      }
    },
    [
      onClearWorkbenchSelection,
      onSelectObjectWorkbenchTarget,
      onSelectPergolaTarget,
      selectionClassifier,
    ],
  );

  return (
    <Geometry3DViewport
      geometryPreview={geometryPreview}
      objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
      visibility={visibility}
      viewportKey={viewportKey}
      viewportState={viewportState}
      onViewportStateChange={onViewportStateChange}
      lockedViewPreset={lockedViewPreset}
      controlledSelectedObjectId={selectedObjectId}
      onSelectedObjectChange={handleSelectedObjectChange}
    />
  );
}
