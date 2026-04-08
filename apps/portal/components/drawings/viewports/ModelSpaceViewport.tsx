'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from 'react';
import type { AttachmentSide } from '@sp/costing';
import {
  ModuleDrawingRenderer,
  type ModuleDrawingInteractiveFieldMap,
  type ModulePlanInteractionProps,
  type ModulePlanResizeDragMeta,
  type ModulePlanResizeFieldId,
  canEditHouseFootprintPlan,
  type HouseFootprintEditorDragMeta,
  type ModuleFootprintEditorProps,
  type ModuleViewsStatus,
  type ModuleViewsTab,
} from '@/app/staff/calculator/ModuleViewsCard';
import type { HouseFootprintHandleId, ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { EstimateDrawingField, EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import { normalizeHouseFootprintParams, type CalculatorHouseFootprintParams } from '@/lib/types/calculator';
import { moduleDrawingThemeCssVariables } from '@/lib/theme/moduleDrawing';
import styles from './ModelSpaceViewport.module.css';

type FootprintDragSession = HouseFootprintEditorDragMeta & {
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  startParams: CalculatorHouseFootprintParams;
};

type PlanFieldDragSession = ModulePlanResizeDragMeta & {
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  startValueM: number;
  field: EstimateDrawingField;
};

const MIN_MODEL_ZOOM = 1;
const MAX_MODEL_ZOOM = 4;

function clampZoom(value: number): number {
  return Math.min(Math.max(value, MIN_MODEL_ZOOM), MAX_MODEL_ZOOM);
}

function formatHouseFootprintParamValue(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function parseHouseFootprintParamValue(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function snapHouseFootprintValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatDrawingFieldValue(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function clientPointToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

async function resolveCommitResult(
  action: Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string },
): Promise<{ ok: boolean; error?: string }> {
  return await action;
}

export default function ModelSpaceViewport({
  view,
  status,
  planModel,
  sectionModel,
  planViewModel,
  viewportTransform,
  onViewportTransformChange,
  editableFields,
  onCommitField,
  onCommitFootprintEdit,
}: {
  view: ModuleViewsTab;
  status: ModuleViewsStatus;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  planViewModel?: PlanViewModel | null;
  viewportTransform: DrawingWorkbenchViewportTransform;
  onViewportTransformChange?: (next: DrawingWorkbenchViewportTransform) => void;
  editableFields?: EstimateDrawingField[];
  onCommitField?: (
    field: EstimateDrawingField,
    nextValue: string,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitFootprintEdit?: (
    edit: EstimateDrawingFootprintEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const footprintSvgRef = useRef<SVGSVGElement | null>(null);
  const syncingScrollRef = useRef(false);
  const [footprintError, setFootprintError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [footprintHoveredAttachmentSide, setFootprintHoveredAttachmentSide] = useState<AttachmentSide | null>(null);
  const [footprintHoveredHandleId, setFootprintHoveredHandleId] = useState<HouseFootprintHandleId | null>(null);
  const [footprintActiveHandleId, setFootprintActiveHandleId] = useState<HouseFootprintHandleId | null>(null);
  const [footprintContextHovered, setFootprintContextHovered] = useState(false);
  const [footprintDragSession, setFootprintDragSession] = useState<FootprintDragSession | null>(null);
  const [planHoveredResizeFieldId, setPlanHoveredResizeFieldId] = useState<ModulePlanResizeFieldId | null>(null);
  const [planActiveResizeFieldId, setPlanActiveResizeFieldId] = useState<ModulePlanResizeFieldId | null>(null);
  const [planFieldDragSession, setPlanFieldDragSession] = useState<PlanFieldDragSession | null>(null);

  const zoom = clampZoom(viewportTransform.zoom);
  const editableFieldMap = useMemo(() => {
    const next = new Map<string, EstimateDrawingField>();
    for (const field of editableFields ?? []) {
      if (!field.svgFieldId) continue;
      next.set(field.svgFieldId, field);
    }
    return next;
  }, [editableFields]);
  const modelInteractiveFields = useMemo<ModuleDrawingInteractiveFieldMap>(() => {
    const next: ModuleDrawingInteractiveFieldMap = {};
    for (const field of editableFieldMap.values()) {
      if (!field.svgFieldId) continue;
      next[field.svgFieldId] = {
        fieldId: field.id,
      };
    }
    return next;
  }, [editableFieldMap]);
  const canEditFootprint = view === 'plan' && Boolean(planModel) && Boolean(onCommitFootprintEdit) && canEditHouseFootprintPlan(planModel);
  const canRotatePlan = view === 'plan' && Boolean(planModel) && Boolean(onCommitFootprintEdit) && planModel?.roofType !== 'hip_corner';
  const canEditPlanDimensions =
    view === 'plan' &&
    Boolean(planModel) &&
    Boolean(onCommitField) &&
    (editableFieldMap.has('plan:lengthA') || editableFieldMap.has('plan:spanA'));
  const showPlanViewport = view === 'plan' && Boolean(planModel);
  const interactionError = fieldError ?? footprintError;

  const commitFootprintEdit = useCallback(
    async (edit: EstimateDrawingFootprintEdit) => {
      if (!onCommitFootprintEdit) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }
      const result = await resolveCommitResult(onCommitFootprintEdit(edit));
      setFootprintError(result.ok ? null : result.error ?? 'Unable to update the drawing draft.');
      if (result.ok) setFieldError(null);
      return result;
    },
    [onCommitFootprintEdit],
  );

  const commitFieldEdit = useCallback(
    async (field: EstimateDrawingField, nextValue: string) => {
      if (!onCommitField) {
        return { ok: false, error: 'Drawing inputs are not available for this estimate.' };
      }
      const result = await resolveCommitResult(onCommitField(field, nextValue));
      setFieldError(result.ok ? null : result.error ?? 'Unable to update the drawing draft.');
      if (result.ok) setFootprintError(null);
      return result;
    },
    [onCommitField],
  );

  const updateViewportTransform = useCallback(
    (next: Partial<DrawingWorkbenchViewportTransform>) => {
      onViewportTransformChange?.({
        zoom,
        panX: viewportTransform.panX,
        panY: viewportTransform.panY,
        ...next,
      });
    },
    [onViewportTransformChange, viewportTransform.panX, viewportTransform.panY, zoom],
  );

  const handleZoomChange = useCallback(
    (delta: number) => {
      updateViewportTransform({ zoom: clampZoom(zoom + delta) });
    },
    [updateViewportTransform, zoom],
  );

  const handleResetView = useCallback(() => {
    setFootprintError(null);
    setFieldError(null);
    updateViewportTransform({ zoom: 1, panX: 0, panY: 0 });
  }, [updateViewportTransform]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      handleZoomChange(event.deltaY < 0 ? 0.2 : -0.2);
    },
    [handleZoomChange],
  );

  const handleScroll = useCallback(() => {
    if (syncingScrollRef.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    updateViewportTransform({
      panX: scroller.scrollLeft,
      panY: scroller.scrollTop,
    });
  }, [updateViewportTransform]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const nextLeft = Math.max(0, viewportTransform.panX);
    const nextTop = Math.max(0, viewportTransform.panY);
    if (Math.abs(scroller.scrollLeft - nextLeft) < 1 && Math.abs(scroller.scrollTop - nextTop) < 1) return;
    syncingScrollRef.current = true;
    scroller.scrollLeft = nextLeft;
    scroller.scrollTop = nextTop;
    const timeoutId = window.setTimeout(() => {
      syncingScrollRef.current = false;
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [viewportTransform.panX, viewportTransform.panY, zoom]);

  const handleFootprintPresetSelect = useCallback(
    async (preset: NonNullable<ModulePlanModel['houseFootprintPreset']>) => {
      setFieldError(null);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setFootprintError(null);
      await commitFootprintEdit({ type: 'preset', preset });
    },
    [commitFootprintEdit],
  );

  const handleFootprintRotate = useCallback(
    async (delta: -1 | 1) => {
      setFieldError(null);
      setFootprintHoveredAttachmentSide(null);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setFootprintError(null);
      await commitFootprintEdit({ type: 'rotate', delta });
    },
    [commitFootprintEdit],
  );

  const handleFootprintAttachmentSideSelect = useCallback(
    async (side: AttachmentSide) => {
      setFieldError(null);
      setFootprintHoveredAttachmentSide(side);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setFootprintError(null);
      await commitFootprintEdit({ type: 'attachment_side', side });
    },
    [commitFootprintEdit],
  );

  const handleFootprintDragStart = useCallback(
    (meta: HouseFootprintEditorDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => {
      if (!canEditFootprint || !planModel) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const startPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!startPoint) return;
      setFieldError(null);
      setFootprintError(null);
      setFootprintContextHovered(true);
      setFootprintActiveHandleId(meta.handleId);
      setFootprintHoveredHandleId(meta.handleId);
      setFootprintDragSession({
        ...meta,
        pointerId: event.pointerId,
        startSvgX: startPoint.x,
        startSvgY: startPoint.y,
        startParams: normalizeHouseFootprintParams(planModel.houseFootprintParams),
      });
    },
    [canEditFootprint, planModel],
  );

  const handlePlanFieldDragStart = useCallback(
    (meta: ModulePlanResizeDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => {
      if (!canEditPlanDimensions || !planModel) return;
      const field = editableFieldMap.get(meta.fieldId);
      if (!field) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const startPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!startPoint) return;

      const fallbackValue = meta.fieldId === 'plan:lengthA' ? planModel.lengthA : planModel.spanA;
      const startValueM = Number.parseFloat(field.rawValue);

      setFootprintError(null);
      setFieldError(null);
      setPlanActiveResizeFieldId(meta.fieldId);
      setPlanHoveredResizeFieldId(meta.fieldId);
      setPlanFieldDragSession({
        ...meta,
        pointerId: event.pointerId,
        startSvgX: startPoint.x,
        startSvgY: startPoint.y,
        startValueM: Number.isFinite(startValueM) ? startValueM : fallbackValue,
        field,
      });
    },
    [canEditPlanDimensions, editableFieldMap, planModel],
  );

  useEffect(() => {
    if (!footprintDragSession || !onCommitFootprintEdit) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== footprintDragSession.pointerId) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;

      const deltaSvgX = nextPoint.x - footprintDragSession.startSvgX;
      const deltaSvgY = nextPoint.y - footprintDragSession.startSvgY;
      const deltaUnits = deltaSvgX * footprintDragSession.axisX + deltaSvgY * footprintDragSession.axisY;
      const deltaM = (deltaUnits / Math.max(footprintDragSession.scale, 0.001)) * footprintDragSession.deltaMultiplier;
      const minValueM = footprintDragSession.minValueM;
      const maxValueM = Math.max(minValueM, footprintDragSession.maxValueM);
      const startParams = footprintDragSession.startParams;

      let key: keyof CalculatorHouseFootprintParams = 'bandDepthM';
      let nextValue = parseHouseFootprintParamValue(startParams.bandDepthM, 1.8) + deltaM;

      switch (footprintDragSession.handleId) {
        case 'returnRun':
          key = 'returnRunM';
          nextValue = parseHouseFootprintParamValue(startParams.returnRunM, 2.4) + deltaM;
          break;
        case 'recessWidth':
          key = 'recessWidthM';
          nextValue = parseHouseFootprintParamValue(startParams.recessWidthM, 2.4) + deltaM;
          break;
        case 'recessDepth':
          key = 'recessDepthM';
          nextValue = parseHouseFootprintParamValue(startParams.recessDepthM, 1.2) + deltaM;
          break;
        case 'leftLegRun':
          key = 'leftLegRunM';
          nextValue = parseHouseFootprintParamValue(startParams.leftLegRunM, 2.4) + deltaM;
          break;
        case 'rightLegRun':
          key = 'rightLegRunM';
          nextValue = parseHouseFootprintParamValue(startParams.rightLegRunM, 2.4) + deltaM;
          break;
        case 'sideRun':
          key = 'sideRunM';
          nextValue = parseHouseFootprintParamValue(startParams.sideRunM, 2.4) + deltaM;
          break;
        case 'bandDepth':
        default:
          key = 'bandDepthM';
          nextValue = parseHouseFootprintParamValue(startParams.bandDepthM, 1.8) + deltaM;
          break;
      }

      void commitFootprintEdit({
        type: 'param',
        key,
        value: formatHouseFootprintParamValue(snapHouseFootprintValue(Math.min(Math.max(nextValue, minValueM), maxValueM))),
      });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== footprintDragSession.pointerId) return;
      setFootprintDragSession(null);
      setFootprintActiveHandleId(null);
      setFootprintHoveredHandleId(null);
      setFootprintContextHovered(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [commitFootprintEdit, footprintDragSession, onCommitFootprintEdit]);

  useEffect(() => {
    if (!planFieldDragSession || !onCommitField) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== planFieldDragSession.pointerId) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;

      const deltaSvgX = nextPoint.x - planFieldDragSession.startSvgX;
      const deltaSvgY = nextPoint.y - planFieldDragSession.startSvgY;
      const deltaUnits = deltaSvgX * planFieldDragSession.axisX + deltaSvgY * planFieldDragSession.axisY;
      const deltaM = (deltaUnits / Math.max(planFieldDragSession.scale, 0.001)) * planFieldDragSession.deltaMultiplier;
      const unclampedValueM = planFieldDragSession.startValueM + deltaM;
      const nextValueM = Number.isFinite(planFieldDragSession.maxValueM)
        ? Math.min(Math.max(unclampedValueM, planFieldDragSession.minValueM), planFieldDragSession.maxValueM)
        : Math.max(unclampedValueM, planFieldDragSession.minValueM);

      void commitFieldEdit(planFieldDragSession.field, formatDrawingFieldValue(nextValueM));
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== planFieldDragSession.pointerId) return;
      setPlanFieldDragSession(null);
      setPlanActiveResizeFieldId(null);
      setPlanHoveredResizeFieldId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [commitFieldEdit, onCommitField, planFieldDragSession]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setFootprintDragSession(null);
      setFootprintActiveHandleId(null);
      setFootprintHoveredHandleId(null);
      setFootprintContextHovered(false);
      setPlanFieldDragSession(null);
      setPlanActiveResizeFieldId(null);
      setPlanHoveredResizeFieldId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const footprintEditor = useMemo<ModuleFootprintEditorProps | undefined>(() => {
    if (!canEditFootprint && !canRotatePlan) return undefined;
    return {
      available: canEditFootprint,
      surface: 'model',
      isEditing: true,
      isContextHovered: footprintContextHovered,
      hoveredAttachmentSide: footprintHoveredAttachmentSide,
      hoveredHandleId: footprintHoveredHandleId,
      activeHandleId: footprintActiveHandleId,
      onStartEditing: () => undefined,
      onDoneEditing: () => undefined,
      onContextHoverChange: (hovered) => setFootprintContextHovered(hovered),
      onContextPopoverHoverChange: () => undefined,
      onAttachmentSideHover: (side) => setFootprintHoveredAttachmentSide(side),
      onAttachmentSideSelect: (side) => void handleFootprintAttachmentSideSelect(side),
      onHandleHover: (handleId) => setFootprintHoveredHandleId(handleId),
      onHandleDragStart: handleFootprintDragStart,
      onPresetSelect: (preset) => void handleFootprintPresetSelect(preset),
      onRotate: (delta) => void handleFootprintRotate(delta),
      onSvgMount: (node) => {
        footprintSvgRef.current = node;
      },
    };
  }, [
    canEditFootprint,
    canRotatePlan,
    footprintActiveHandleId,
    footprintContextHovered,
    footprintHoveredAttachmentSide,
    footprintHoveredHandleId,
    handleFootprintAttachmentSideSelect,
    handleFootprintDragStart,
    handleFootprintPresetSelect,
    handleFootprintRotate,
  ]);

  const planInteraction = useMemo<ModulePlanInteractionProps | undefined>(() => {
    if (!canEditPlanDimensions) return undefined;
    return {
      available: true,
      hoveredResizeFieldId: planHoveredResizeFieldId,
      activeResizeFieldId: planActiveResizeFieldId,
      onResizeFieldHover: (fieldId) => setPlanHoveredResizeFieldId(fieldId),
      onResizeFieldDragStart: handlePlanFieldDragStart,
      onSvgMount: (node) => {
        footprintSvgRef.current = node;
      },
    };
  }, [canEditPlanDimensions, handlePlanFieldDragStart, planActiveResizeFieldId, planHoveredResizeFieldId]);

  const scaleFrameStyle = useMemo(
    () => ({
      width: `${zoom * 100}%`,
    }),
    [zoom],
  );

  const planStats = planViewModel
    ? `${planViewModel.primarySize.lengthA?.toFixed(1) ?? '?'}m x ${planViewModel.primarySize.spanA?.toFixed(1) ?? '?'}m`
    : null;

  return (
    <section className={styles.viewport} aria-label={`${view === 'plan' ? 'Plan' : 'Section'} model space viewport`} style={moduleDrawingThemeCssVariables('model')}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <div className={styles.toolbarMeta}>
            <p className={styles.eyebrow}>Model Space</p>
            <h3 className={styles.title}>{showPlanViewport ? 'Live plan viewport' : 'Drawing-space viewer'}</h3>
            <p className={styles.subtitle}>
              {showPlanViewport
                ? planStats
                  ? `${planStats}. Drag the primary resize handles or use the Sanctuary rail to adjust the live draft.`
                  : 'Drag the primary resize handles or use the Sanctuary rail to adjust the live draft.'
                : 'Section model-space editing lands in a later milestone. Use Sheet View for the generated section for now.'}
            </p>
          </div>
        </div>

        <div className={styles.toolbarGroup}>
          <button type="button" className={styles.toolbarButton} onClick={() => handleZoomChange(-0.2)}>
            Zoom out
          </button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button type="button" className={styles.toolbarButton} onClick={() => handleZoomChange(0.2)}>
            Zoom in
          </button>
          <button type="button" className={styles.toolbarButton} onClick={handleResetView}>
            Reset view
          </button>
        </div>
      </div>

      {interactionError ? <p className={styles.error}>{interactionError}</p> : null}

      <div ref={scrollerRef} className={styles.scroller} onScroll={handleScroll} onWheel={handleWheel}>
        <div className={styles.scaleFrame} style={scaleFrameStyle}>
          <div className={styles.canvas}>
            {showPlanViewport ? (
              <ModuleDrawingRenderer
                view={view}
                status={status}
                planModel={planModel}
                sectionModel={sectionModel}
                presentation="model"
                interactiveFields={modelInteractiveFields}
                footprintEditor={footprintEditor}
                planInteraction={planInteraction}
              />
            ) : (
              <div className={styles.placeholder}>
                <p className={styles.placeholderTitle}>Section model space is staged for a later milestone.</p>
                <p className={styles.placeholderText}>Switch to Sheet View to review the generated section while we finish the shared section and elevation foundation.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
