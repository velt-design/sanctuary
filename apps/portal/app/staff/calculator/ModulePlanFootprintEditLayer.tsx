import type { PointerEvent as ReactPointerEvent } from 'react';
import type { AttachmentSide } from '@sp/costing';
import styles from './CalculatorGrid.module.css';
import type { ModuleFootprintEditorProps } from './ModuleDrawingContracts';
import type {
  FootprintCanvasLayout,
  FootprintHandleSpec,
  FootprintResizeEdgeSpec,
} from './ModulePlanFootprintPresentation';
import type { PlanAttachmentFrame } from './ModuleDrawingSurfacePrimitives';

type ModulePlanFootprintEditLayerProps = {
  allowAttachmentSideCanvasSelect: boolean;
  allowResizeEdgeDrag: boolean;
  canEditFootprint: boolean;
  customPolygonHasError: boolean;
  edgeFrames: Array<{ side: AttachmentSide; frame: PlanAttachmentFrame }>;
  editorSurface: 'card' | 'sheet' | 'model';
  footprintCanvasLayout: FootprintCanvasLayout | null;
  footprintEditor?: ModuleFootprintEditorProps;
  handleSpecs: FootprintHandleSpec[];
  resizeEdgeSpecs: FootprintResizeEdgeSpec[];
  scale: number;
  showFootprintControls: boolean;
  attachmentSideCanvasActiveSide: AttachmentSide;
};

export function ModulePlanFootprintEditLayer({
  allowAttachmentSideCanvasSelect,
  allowResizeEdgeDrag,
  canEditFootprint,
  customPolygonHasError,
  edgeFrames,
  editorSurface,
  footprintCanvasLayout,
  footprintEditor,
  handleSpecs,
  resizeEdgeSpecs,
  scale,
  showFootprintControls,
  attachmentSideCanvasActiveSide,
}: ModulePlanFootprintEditLayerProps) {
  return (
    <>
      {showFootprintControls && allowAttachmentSideCanvasSelect
        ? edgeFrames.map(({ side, frame: edgeFrame }) => {
            const isActiveEdge = side === attachmentSideCanvasActiveSide;
            const isHoveredEdge = side === footprintEditor?.hoveredAttachmentSide;
            return (
              <g key={`footprint-edge-${side}`}>
                {isActiveEdge || isHoveredEdge ? (
                  <line
                    x1={edgeFrame.start.x}
                    y1={edgeFrame.start.y}
                    x2={edgeFrame.end.x}
                    y2={edgeFrame.end.y}
                    className={
                      isActiveEdge
                        ? `${styles.moduleFootprintEdge} ${styles.moduleFootprintEdgeActive}`
                        : `${styles.moduleFootprintEdge} ${styles.moduleFootprintEdgeHover}`
                    }
                  />
                ) : null}
                <line
                  x1={edgeFrame.start.x}
                  y1={edgeFrame.start.y}
                  x2={edgeFrame.end.x}
                  y2={edgeFrame.end.y}
                  data-footprint-edge={side}
                  className={styles.moduleFootprintEdgeHit}
                  onPointerEnter={() => {
                    if (editorSurface === 'card') {
                      footprintEditor?.onContextHoverChange?.(true);
                    }
                    footprintEditor?.onAttachmentSideHover(side);
                  }}
                  onPointerLeave={() => {
                    if (editorSurface === 'card') {
                      footprintEditor?.onContextHoverChange?.(false);
                    }
                    footprintEditor?.onAttachmentSideHover(null);
                  }}
                  onClick={() => footprintEditor?.onAttachmentSideSelect(side)}
                />
              </g>
            );
          })
        : null}

      {editorSurface !== 'card' && canEditFootprint && allowResizeEdgeDrag
        ? resizeEdgeSpecs.map((edge) => {
            const isActiveEdge = edge.id === footprintEditor?.activeHandleId;
            const isHoveredEdge = edge.id === footprintEditor?.hoveredHandleId;
            return (
              <g key={`footprint-resize-edge-${edge.id}`}>
                {isActiveEdge || isHoveredEdge ? (
                  <line
                    x1={edge.start.x}
                    y1={edge.start.y}
                    x2={edge.end.x}
                    y2={edge.end.y}
                    data-footprint-resize-edge={edge.id}
                    className={
                      isActiveEdge
                        ? `${styles.moduleFootprintResizeEdge} ${styles.moduleFootprintResizeEdgeActive}`
                        : `${styles.moduleFootprintResizeEdge} ${styles.moduleFootprintResizeEdgeHover}`
                    }
                  />
                ) : null}
                <line
                  x1={edge.start.x}
                  y1={edge.start.y}
                  x2={edge.end.x}
                  y2={edge.end.y}
                  data-footprint-resize-edge-hit={edge.id}
                  className={styles.moduleFootprintResizeEdgeHit}
                  onPointerEnter={() => footprintEditor?.onHandleHover(edge.id)}
                  onPointerLeave={() => footprintEditor?.onHandleHover(null)}
                  onPointerDown={(event: ReactPointerEvent<SVGLineElement>) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    footprintEditor?.onHandleDragStart(
                      {
                        handleId: edge.id,
                        axisX: edge.axisX,
                        axisY: edge.axisY,
                        scale,
                        deltaMultiplier: edge.deltaMultiplier,
                        minValueM: edge.minValueM,
                        maxValueM: edge.maxValueM,
                      },
                      {
                        pointerId: event.pointerId,
                        clientX: event.clientX,
                        clientY: event.clientY,
                      },
                    );
                  }}
                />
              </g>
            );
          })
        : null}

      {editorSurface !== 'card' && canEditFootprint
        ? (footprintCanvasLayout?.customEdges ?? []).map((edge) => (
            <g key={`footprint-custom-edge-${edge.index}`}>
              <line
                x1={edge.start.x}
                y1={edge.start.y}
                x2={edge.end.x}
                y2={edge.end.y}
                data-footprint-custom-edge={edge.index}
                data-footprint-custom-edge-kind={edge.kind}
                data-footprint-custom-preview-edge={edge.previewPointKind ?? undefined}
                data-footprint-custom-close-preview={edge.isClosePreview ? 'true' : undefined}
                data-footprint-custom-active-edge={edge.isActive ? 'true' : undefined}
                data-footprint-custom-invalid={customPolygonHasError ? 'true' : undefined}
                className={[
                  styles.moduleFootprintResizeEdge,
                  edge.kind === 'preview' ? styles.moduleFootprintCustomPreviewEdge : '',
                  edge.isActive ? styles.moduleFootprintCustomActiveEdge : '',
                  edge.isClosePreview ? styles.moduleFootprintCustomClosePreviewEdge : '',
                  customPolygonHasError ? styles.moduleFootprintCustomInvalidEdge : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              {edge.kind === 'confirmed' ? (
                <line
                  x1={edge.start.x}
                  y1={edge.start.y}
                  x2={edge.end.x}
                  y2={edge.end.y}
                  data-footprint-custom-edge-hit={edge.index}
                  className={styles.moduleFootprintResizeEdgeHit}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    footprintEditor?.onEdgeAdd?.(edge.index);
                  }}
                />
              ) : null}
            </g>
          ))
        : null}

      {editorSurface !== 'card' &&
      canEditFootprint &&
      footprintCanvasLayout?.lockedDistanceCenter &&
      footprintCanvasLayout?.landingPoint &&
      footprintEditor?.customPolygonLockedDistanceM !== null &&
      footprintEditor?.customPolygonLockedDistanceM !== undefined ? (
        <g pointerEvents="none" aria-hidden="true" data-draw-outline-locked-radius="true" className={styles.moduleFootprintLandingMarker}>
          <line
            x1={footprintCanvasLayout.lockedDistanceCenter.x}
            y1={footprintCanvasLayout.lockedDistanceCenter.y}
            x2={footprintCanvasLayout.landingPoint.x}
            y2={footprintCanvasLayout.landingPoint.y}
            strokeDasharray="3 2"
          />
        </g>
      ) : null}

      {editorSurface !== 'card' && canEditFootprint && footprintCanvasLayout?.landingPoint && footprintEditor?.customPolygonLandingPoint ? (
        <g
          pointerEvents="none"
          aria-hidden="true"
          data-draw-outline-landing-marker="true"
          data-draw-outline-landing-along-m={footprintEditor.customPolygonLandingPoint.alongM}
          data-draw-outline-landing-depth-m={footprintEditor.customPolygonLandingPoint.depthM}
          className={styles.moduleFootprintLandingMarker}
        >
          <line x1={footprintCanvasLayout.landingPoint.x - 1.15} y1={footprintCanvasLayout.landingPoint.y} x2={footprintCanvasLayout.landingPoint.x + 1.15} y2={footprintCanvasLayout.landingPoint.y} />
          <line x1={footprintCanvasLayout.landingPoint.x} y1={footprintCanvasLayout.landingPoint.y - 1.15} x2={footprintCanvasLayout.landingPoint.x} y2={footprintCanvasLayout.landingPoint.y + 1.15} />
          <circle cx={footprintCanvasLayout.landingPoint.x} cy={footprintCanvasLayout.landingPoint.y} r={0.34} />
        </g>
      ) : null}

      {editorSurface !== 'card' && canEditFootprint
        ? (footprintCanvasLayout?.customVertices ?? []).map((vertex) => (
            <g key={`footprint-custom-vertex-${vertex.index}`}>
              {vertex.isCloseReady ? (
                <circle
                  cx={vertex.point.x}
                  cy={vertex.point.y}
                  r={2.0}
                  data-footprint-custom-close-target={vertex.index}
                  data-footprint-custom-close-hovered={vertex.isCloseHovered ? 'true' : undefined}
                  className={
                    vertex.isCloseHovered
                      ? `${styles.moduleFootprintCustomCloseTarget} ${styles.moduleFootprintCustomCloseTargetHover}`
                      : styles.moduleFootprintCustomCloseTarget
                  }
                />
              ) : null}
              <circle
                cx={vertex.point.x}
                cy={vertex.point.y}
                r={vertex.isLatestConfirmed ? 1.16 : vertex.kind === 'pending' || vertex.kind === 'hover' || vertex.kind === 'locked-distance' ? 1.08 : 1.02}
                data-footprint-custom-vertex={vertex.index}
                data-footprint-custom-vertex-kind={vertex.kind}
                data-footprint-custom-latest-vertex={vertex.isLatestConfirmed ? 'true' : undefined}
                data-footprint-custom-preview-vertex={vertex.kind === 'pending' || vertex.kind === 'hover' || vertex.kind === 'locked-distance' ? vertex.kind : undefined}
                data-footprint-custom-close-ready={vertex.isCloseReady ? 'true' : undefined}
                data-footprint-custom-invalid={customPolygonHasError ? 'true' : undefined}
                className={[
                  styles.moduleFootprintHandle,
                  vertex.isLatestConfirmed ? styles.moduleFootprintCustomLatestVertex : '',
                  vertex.kind === 'pending' ? styles.moduleFootprintCustomPendingVertex : '',
                  vertex.kind === 'hover' || vertex.kind === 'locked-distance' ? styles.moduleFootprintCustomHoverVertex : '',
                  customPolygonHasError ? styles.moduleFootprintCustomInvalidVertex : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              <circle
                cx={vertex.point.x}
                cy={vertex.point.y}
                r={2.8}
                data-footprint-custom-vertex-hit={vertex.index}
                className={styles.moduleFootprintHandleHit}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  footprintEditor?.onVertexDelete?.(vertex.index);
                }}
                onPointerDown={(event: ReactPointerEvent<SVGCircleElement>) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  footprintEditor?.onVertexDragStart?.(
                    {
                      vertexIndex: vertex.index,
                      alongAxisX: vertex.alongAxisX,
                      alongAxisY: vertex.alongAxisY,
                      depthAxisX: vertex.depthAxisX,
                      depthAxisY: vertex.depthAxisY,
                      scale,
                    },
                    {
                      pointerId: event.pointerId,
                      clientX: event.clientX,
                      clientY: event.clientY,
                    },
                  );
                }}
              />
              {vertex.isCloseReady && vertex.index === 0 ? (
                <circle
                  cx={vertex.point.x}
                  cy={vertex.point.y}
                  r={4.2}
                  data-footprint-custom-close-hit={vertex.index}
                  data-footprint-custom-close-hovered={vertex.isCloseHovered ? 'true' : undefined}
                  className={`${styles.moduleFootprintHandleHit} ${styles.moduleFootprintCustomCloseHit}`}
                  onPointerDown={(event: ReactPointerEvent<SVGCircleElement>) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    footprintEditor?.onCloseStartSelect?.();
                  }}
                />
              ) : null}
            </g>
          ))
        : null}

      {editorSurface === 'card' && showFootprintControls
        ? handleSpecs.map((handle) => {
            const isActiveHandle = handle.id === footprintEditor?.activeHandleId;
            const isHoveredHandle = handle.id === footprintEditor?.hoveredHandleId;
            return (
              <g key={`footprint-handle-${handle.id}`}>
                <line
                  x1={handle.guideFrom.x}
                  y1={handle.guideFrom.y}
                  x2={handle.guideTo.x}
                  y2={handle.guideTo.y}
                  className={isActiveHandle ? `${styles.moduleFootprintGuide} ${styles.moduleFootprintGuideActive}` : styles.moduleFootprintGuide}
                />
                <circle
                  cx={handle.point.x}
                  cy={handle.point.y}
                  r={isActiveHandle ? 1.18 : 1.02}
                  data-footprint-handle={handle.id}
                  className={
                    isActiveHandle
                      ? `${styles.moduleFootprintHandle} ${styles.moduleFootprintHandleActive}`
                      : isHoveredHandle
                        ? `${styles.moduleFootprintHandle} ${styles.moduleFootprintHandleHover}`
                        : styles.moduleFootprintHandle
                  }
                />
                <circle
                  cx={handle.point.x}
                  cy={handle.point.y}
                  r={2.8}
                  className={styles.moduleFootprintHandleHit}
                  onPointerEnter={() => {
                    footprintEditor?.onContextHoverChange?.(true);
                    footprintEditor?.onHandleHover(handle.id);
                  }}
                  onPointerLeave={() => {
                    footprintEditor?.onContextHoverChange?.(false);
                    footprintEditor?.onHandleHover(null);
                  }}
                  onPointerDown={(event: ReactPointerEvent<SVGCircleElement>) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    footprintEditor?.onHandleDragStart(
                      {
                        handleId: handle.id,
                        axisX: handle.axisX,
                        axisY: handle.axisY,
                        scale,
                        deltaMultiplier: handle.deltaMultiplier,
                        minValueM: handle.minValueM,
                        maxValueM: handle.maxValueM,
                      },
                      {
                        pointerId: event.pointerId,
                        clientX: event.clientX,
                        clientY: event.clientY,
                      },
                    );
                  }}
                />
              </g>
            );
          })
        : null}
    </>
  );
}
