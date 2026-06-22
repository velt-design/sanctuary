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
import type { ProjectHouseProjectionHealth } from '@/lib/drawings/state/projectHouseProjectionHealth';

type GeometryCameraPreset = 'iso' | 'front' | 'right' | 'top' | 'custom';

type DesignViewportProps = {
  geometryPreview?: GeometryPreviewState | null;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  viewportKey?: string;
  viewportState?: Geometry3DViewportState | null;
  onViewportStateChange?: (next: Geometry3DViewportState) => void;
  lockedViewPreset?: GeometryCameraPreset;
  selectedObjectId?: string | null;
  projectHouseProjectionHealth?: ReadonlyArray<ProjectHouseProjectionHealth>;
  selectionClassifier?: SelectionClassifier;
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
  /**
   * Cross-viewport hover state. Pass-through to Geometry3DViewport's
   * `controlledHoveredObjectId`. Phase 1 (milestone 16) -- the prop is
   * exposed end-to-end but the 3D viewport doesn't yet apply per-object
   * hover styling. See PlanViewport's `hoveredObjectRef` for the emit half.
   */
  hoveredObjectId?: string | null;
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
  projectHouseProjectionHealth,
  selectionClassifier = defaultPrefixClassifier,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
  onClearWorkbenchSelection,
  hoveredObjectId,
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
      controlledHoveredObjectId={hoveredObjectId}
      projectHouseProjectionHealth={projectHouseProjectionHealth}
    />
  );
}
