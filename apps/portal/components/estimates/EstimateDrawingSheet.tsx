'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  canEditHouseFootprintPlan,
  getSuggestedModuleDrawingScale,
  ModuleDrawingRenderer,
  type HouseFootprintEditorDragMeta,
  type ModuleFootprintEditorProps,
  resolveModuleDrawingScaleState,
  type ModuleDrawingInteractiveFieldMap,
} from '@/app/staff/calculator/ModuleViewsCard';
import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { WorkbenchDrawingSurfaceGeometry } from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import drawingStyles from '@/app/staff/calculator/CalculatorGrid.module.css';
import { PORTAL_COMPANY_PROFILE } from '@/lib/company/profile';
import {
  type EstimateDrawingField,
  type EstimateDrawingFootprintEdit,
} from '@/lib/estimates/drawingEdits';
import {
  estimateDrawingScaleKey,
  formatEstimateDrawingScale,
  getEstimateDrawingScaleOptions,
  parseEstimateDrawingScaleKey,
  type EstimateDrawingScale,
  type EstimateDrawingSheetMeta,
} from '@/lib/estimates/drawingSheet';
import { getDrawingSheetViewportMm } from '@/lib/estimates/drawingSheetLayout';
import { normalizeHouseFootprintParams, type CalculatorHouseFootprintParams } from '@/lib/types/calculator';
import { moduleDrawingThemeCssVariables } from '@/lib/theme/moduleDrawing';
import { blockNativeSelectionEvent } from '@/components/drawings/viewports/nativeSelection';
import styles from './EstimateDrawingSheet.module.css';

type LegendSourceClass =
  | 'modulePlanPerimeter'
  | 'modulePlanMemberEdge'
  | 'modulePlanRafter'
  | 'modulePlanSoffitBracket'
  | 'moduleSectionPrimaryBeam'
  | 'moduleSectionRoofMember'
  | 'moduleSectionRidgeBeam'
  | 'moduleSectionTieBeamPrimary'
  | 'moduleSectionConnection'
  | 'moduleDimLine'
  | 'moduleDimTick';

type EstimateDrawingSheetProps = {
  moduleLabel?: string;
  sheetLabel?: string;
  view: ModuleViewsTab;
  status: ModuleViewsStatus;
  drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  meta: EstimateDrawingSheetMeta;
  editableFields?: EstimateDrawingField[];
  showDebugOverlays?: boolean;
  onCommitField?: (
    field: EstimateDrawingField,
    nextValue: string,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitFootprintEdit?: (
    edit: EstimateDrawingFootprintEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
};

type LegendItem = {
  label: string;
  sample: 'line' | 'dimension';
  sourceClass: LegendSourceClass;
  accentClass?: LegendSourceClass;
  sampleKey: string;
};

function SheetLayoutDebugOverlay({ view }: { view: ModuleViewsTab }) {
  const outerMarker = view === 'plan' ? 'outer-plan' : 'outer-section';
  const fitMarker = view === 'plan' ? 'fit-plan' : 'fit-section';

  return (
    <div className={styles.sheetLayoutDebugOverlay} aria-hidden="true">
      <div className={styles.sheetLayoutDebugOuter} data-debug-crop={outerMarker} />
      <div className={styles.sheetLayoutDebugFit} data-debug-crop={fitMarker} />
    </div>
  );
}

type EstimateDrawingSheetScaleState = Record<ModuleViewsTab, EstimateDrawingScale>;

type ActiveDrawingEditor = {
  fieldId: string;
  mode: 'overlay' | 'inline';
  value: string;
  error: string | null;
  rect?: { left: number; top: number; width: number; height: number };
};

type HouseFootprintDragSession = HouseFootprintEditorDragMeta & {
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  startParams: CalculatorHouseFootprintParams;
};

type SheetPlanInteractionOwner =
  | 'idle'
  | 'house_fill'
  | 'house_popover'
  | 'house_edge'
  | 'house_drag'
  | 'pergola'
  | 'pergola_popover';

type SheetPlanHoverState = {
  houseFill: boolean;
  housePopover: boolean;
  houseAttachmentEdge: boolean;
  houseResizeEdge: boolean;
  houseDrag: boolean;
  pergola: boolean;
  pergolaPopover: boolean;
};

type SheetPlanHoverZone = Exclude<keyof SheetPlanHoverState, 'houseDrag'>;

const SHEET_VIEWPORT_MM = getDrawingSheetViewportMm();
const SHEET_PREVIEW_ARTBOARD = {
  widthPx: 1120,
  heightPx: 792,
} as const;
const HOVER_POPOVER_HIDE_DELAY_MS = 120;

function createEmptySheetPlanHoverState(): SheetPlanHoverState {
  return {
    houseFill: false,
    housePopover: false,
    houseAttachmentEdge: false,
    houseResizeEdge: false,
    houseDrag: false,
    pergola: false,
    pergolaPopover: false,
  };
}

export function resolveSheetPlanInteractionOwner(state: SheetPlanHoverState): SheetPlanInteractionOwner {
  if (state.houseDrag) return 'house_drag';
  if (state.houseResizeEdge || state.houseAttachmentEdge) return 'house_edge';
  if (state.housePopover) return 'house_popover';
  if (state.houseFill) return 'house_fill';
  if (state.pergolaPopover) return 'pergola_popover';
  if (state.pergola) return 'pergola';
  return 'idle';
}

function hasActiveSheetPlanHoverZones(state: SheetPlanHoverState): boolean {
  return state.houseFill || state.housePopover || state.houseAttachmentEdge || state.houseResizeEdge || state.pergola || state.pergolaPopover;
}

function stripClientFacingModulePrefix(value: string): string {
  return value.replace(/^\s*M\d+\s*-\s*/i, '').trim();
}

function buildScaleState(
  planModel?: ModulePlanModel | null,
  sectionModel?: ModuleSectionModel | null,
): EstimateDrawingSheetScaleState {
  return {
    plan: getSuggestedModuleDrawingScale({ view: 'plan', planModel, sectionModel, viewportMm: SHEET_VIEWPORT_MM }),
    section: getSuggestedModuleDrawingScale({ view: 'section', planModel, sectionModel, viewportMm: SHEET_VIEWPORT_MM }),
  };
}

function buildLegendItems(
  view: ModuleViewsTab,
  planModel?: ModulePlanModel | null,
  sectionModel?: ModuleSectionModel | null,
): LegendItem[] {
  if (view === 'plan') {
    const items: LegendItem[] = [
      { label: 'Primary structure', sample: 'line', sourceClass: 'modulePlanPerimeter', sampleKey: 'primary' },
      { label: 'Roof framing', sample: 'line', sourceClass: 'modulePlanMemberEdge', sampleKey: 'secondary' },
      { label: 'Roof field', sample: 'line', sourceClass: 'modulePlanRafter', sampleKey: 'tertiary' },
    ];
    if (planModel?.houseConnectionType === 'soffit') {
      items.push({ label: 'Soffit brackets', sample: 'line', sourceClass: 'modulePlanSoffitBracket', sampleKey: 'annotation' });
    }
    items.push({ label: 'Dimensions', sample: 'dimension', sourceClass: 'moduleDimLine', accentClass: 'moduleDimTick', sampleKey: 'dimension' });
    return items;
  }

  const items: LegendItem[] = [
    { label: 'Primary structure', sample: 'line', sourceClass: 'moduleSectionPrimaryBeam', sampleKey: 'primary' },
  ];
  if (sectionModel?.sectionKind === 'gable') {
    items.push({ label: 'Ridge beam', sample: 'line', sourceClass: 'moduleSectionRidgeBeam', sampleKey: 'ridge' });
    items.push({ label: 'Tie beam', sample: 'line', sourceClass: 'moduleSectionTieBeamPrimary', sampleKey: 'tie' });
  }
  items.push({ label: 'Roof members', sample: 'line', sourceClass: 'moduleSectionRoofMember', sampleKey: 'secondary' });
  items.push({ label: 'Datum / guide', sample: 'line', sourceClass: 'moduleSectionConnection', sampleKey: 'guide' });
  items.push({ label: 'Dimensions', sample: 'dimension', sourceClass: 'moduleDimLine', accentClass: 'moduleDimTick', sampleKey: 'dimension' });
  return items;
}

function LegendSample({ item }: { item: LegendItem }) {
  const className = drawingStyles[item.sourceClass];
  const accentClassName = item.accentClass ? drawingStyles[item.accentClass] : null;

  if (item.sample === 'dimension') {
    return (
      <svg
        className={styles.legendSwatchSvg}
        viewBox="0 0 24 8"
        aria-hidden="true"
        data-legend-sample={item.sampleKey}
        data-source-class={item.sourceClass}
      >
        <line x1="2" y1="4" x2="22" y2="4" className={className} />
        <line x1="4" y1="2.45" x2="2.55" y2="5.55" className={accentClassName ?? className} />
        <line x1="21.45" y1="2.45" x2="20" y2="5.55" className={accentClassName ?? className} />
      </svg>
    );
  }

  return (
    <svg
      className={styles.legendSwatchSvg}
      viewBox="0 0 24 8"
      aria-hidden="true"
      data-legend-sample={item.sampleKey}
      data-source-class={item.sourceClass}
    >
      <line x1="1" y1="4" x2="23" y2="4" className={className} />
    </svg>
  );
}

function splitNoteLines(note: string): string[] {
  const trimmed = note.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\.\s+/)
    .map((line, index, parts) => (index < parts.length - 1 && !line.endsWith('.') ? `${line}.` : line))
    .filter(Boolean);
}

function fieldSignature(fields: EstimateDrawingField[]): string {
  return fields.map((field) => `${field.id}:${field.rawValue}`).join('|');
}

function formatHouseFootprintParamValue(value: number): string {
  return value.toFixed(1);
}

function parseHouseFootprintParamValue(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function snapHouseFootprintValue(value: number): number {
  return Math.round(value * 10) / 10;
}

function clientPointToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

export default function EstimateDrawingSheet({
  moduleLabel,
  sheetLabel,
  view,
  status,
  drawingSurfaceGeometry,
  planModel,
  sectionModel,
  meta,
  editableFields = [],
  showDebugOverlays = false,
  onCommitField,
  onCommitFootprintEdit,
}: EstimateDrawingSheetProps) {
  const legacyPlanModel = planModel ?? null;
  const legacySectionModel = sectionModel ?? null;
  const sheetViewportRef = useRef<HTMLDivElement | null>(null);
  const editorInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const footprintSvgRef = useRef<SVGSVGElement | null>(null);
  const [availableWidthPx, setAvailableWidthPx] = useState(0);
  const [selectedScales, setSelectedScales] = useState<EstimateDrawingSheetScaleState>(() =>
    buildScaleState(legacyPlanModel, legacySectionModel),
  );
  const [activeEditor, setActiveEditor] = useState<ActiveDrawingEditor | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [interactionOwner, setInteractionOwner] = useState<SheetPlanInteractionOwner>('idle');
  const interactionOwnerRef = useRef<SheetPlanInteractionOwner>('idle');
  const hoverStateRef = useRef<SheetPlanHoverState>(createEmptySheetPlanHoverState());
  const [footprintHoveredAttachmentSide, setFootprintHoveredAttachmentSide] = useState<ModuleFootprintEditorProps['hoveredAttachmentSide']>(null);
  const [footprintHoveredHandleId, setFootprintHoveredHandleId] = useState<ModuleFootprintEditorProps['hoveredHandleId']>(null);
  const [footprintActiveHandleId, setFootprintActiveHandleId] = useState<ModuleFootprintEditorProps['activeHandleId']>(null);
  const [footprintDragSession, setFootprintDragSession] = useState<HouseFootprintDragSession | null>(null);
  const [footprintError, setFootprintError] = useState<string | null>(null);
  const interactionHideTimerRef = useRef<number | null>(null);
  const viewLabel = view === 'plan' ? 'Plan view' : 'Section view';
  const editableFieldMap = useMemo(() => new Map(editableFields.map((field) => [field.id, field])), [editableFields]);
  const titleField = editableFieldMap.get('meta:title') ?? null;
  const noteField = editableFieldMap.get('meta:note') ?? null;
  const clientFacingModuleLabel = stripClientFacingModulePrefix(meta.moduleTitle);
  const legendItems = buildLegendItems(view, legacyPlanModel, legacySectionModel);
  const noteLines = splitNoteLines(meta.note);
  const moduleInfoRows = meta.moduleInfoRows.filter((row) => row.label.trim() && row.value.trim());
  const resolvedSheetLabel = sheetLabel ?? moduleLabel ?? meta.moduleTitle;
  const scaleOptions = getEstimateDrawingScaleOptions(view).map((option) => ({
    value: estimateDrawingScaleKey(option),
    label: option.mode === 'fit' ? 'Fit / NTS' : formatEstimateDrawingScale(option),
    disabled:
      option.mode === 'fixed' &&
      !resolveModuleDrawingScaleState({
        view,
        requestedScale: option,
        planModel: legacyPlanModel,
        sectionModel: legacySectionModel,
        viewportMm: SHEET_VIEWPORT_MM,
      }).fits,
  }));
  const currentScale = selectedScales[view];
  const currentScaleState = resolveModuleDrawingScaleState({
    view,
    requestedScale: currentScale,
    planModel: legacyPlanModel,
    sectionModel: legacySectionModel,
    viewportMm: SHEET_VIEWPORT_MM,
  });
  const scaleDisplay = formatEstimateDrawingScale(currentScaleState.appliedScale);
  const scaleWarning =
    currentScaleState.requestedScale.mode === 'fixed' && !currentScaleState.fits
      ? `Selected ${formatEstimateDrawingScale(currentScaleState.requestedScale)} exceeds the A3 drawing area. Using ${formatEstimateDrawingScale(currentScaleState.appliedScale)} preview.`
      : null;
  const titleMetaItems = [
    { label: 'Sheet', value: meta.sheetCode },
    { label: 'Revision', value: meta.revision },
    { label: 'Scale', value: scaleDisplay },
    { label: 'Date', value: meta.date },
  ];
  const railMetaItems = titleMetaItems.filter((item) => item.label !== 'Scale');
  const footerMetaItems = [
    { label: 'Client', value: meta.client },
    { label: 'Issue', value: meta.issue },
  ];
  const noteDisplayLines = noteLines.length ? noteLines : [meta.note];
  const clientFacingDrawingTitle = stripClientFacingModulePrefix(meta.drawingTitle);
  const previewScale = availableWidthPx > 0 ? Math.min(availableWidthPx / SHEET_PREVIEW_ARTBOARD.widthPx, 1) : 1;
  const previewHeightPx = Math.round(SHEET_PREVIEW_ARTBOARD.heightPx * previewScale);
  const editableFieldStateKey = useMemo(() => fieldSignature(editableFields), [editableFields]);
  const activeField = activeEditor ? editableFieldMap.get(activeEditor.fieldId) ?? null : null;
  const overlayEditor = activeEditor?.mode === 'overlay' && activeEditor.rect ? activeEditor : null;
  const canEditFootprint = view === 'plan' && Boolean(legacyPlanModel) && Boolean(onCommitFootprintEdit) && canEditHouseFootprintPlan(legacyPlanModel);
  const canRotatePlan = view === 'plan' && Boolean(legacyPlanModel) && Boolean(onCommitFootprintEdit) && legacyPlanModel?.roofType !== 'hip_corner';
  const showHousePopover = canEditFootprint && (interactionOwner === 'house_fill' || interactionOwner === 'house_popover');
  const showHouseControls =
    canEditFootprint &&
    (interactionOwner === 'house_fill' ||
      interactionOwner === 'house_popover' ||
      interactionOwner === 'house_edge' ||
      interactionOwner === 'house_drag');
  const showPergolaPopover = canRotatePlan && (interactionOwner === 'pergola' || interactionOwner === 'pergola_popover');
  const editableSvgFields = useMemo<ModuleDrawingInteractiveFieldMap>(() => {
    if (!onCommitField) return {};
    const next: ModuleDrawingInteractiveFieldMap = {};
    for (const field of editableFields) {
      if (!field.svgFieldId) continue;
      next[field.svgFieldId] = {
        fieldId: field.id,
        onActivate: (fieldId, target) => {
          const viewportRect = sheetViewportRef.current?.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          if (!viewportRect) return;
          setActiveEditor({
            fieldId,
            mode: 'overlay',
            value: field.rawValue,
            error: null,
            rect: {
              left: targetRect.left - viewportRect.left,
              top: targetRect.top - viewportRect.top,
              width: targetRect.width,
              height: targetRect.height,
            },
          });
        },
      };
    }
    return next;
  }, [editableFields, onCommitField]);
  const viewportStyle = {
    '--sheet-preview-scale': `${previewScale}`,
    '--sheet-preview-height': `${previewHeightPx}px`,
  } as CSSProperties;

  useEffect(() => {
    const node = sheetViewportRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      setAvailableWidthPx(Math.round(node.getBoundingClientRect().width));
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scaleResetKey = useMemo(
    () =>
      [
        resolvedSheetLabel,
        legacyPlanModel?.roofType ?? '-',
        legacyPlanModel?.lengthA ?? '-',
        legacyPlanModel?.spanA ?? '-',
        legacyPlanModel?.lengthB ?? '-',
        legacyPlanModel?.spanB ?? '-',
        legacySectionModel?.sectionKind ?? '-',
        legacySectionModel?.spanA ?? '-',
        legacySectionModel?.leftEdgeHeightM ?? '-',
        legacySectionModel?.rightEdgeHeightM ?? '-',
        legacySectionModel?.ridgeHeightM ?? '-',
      ].join('|'),
    [
      resolvedSheetLabel,
      legacyPlanModel?.roofType,
      legacyPlanModel?.lengthA,
      legacyPlanModel?.spanA,
      legacyPlanModel?.lengthB,
      legacyPlanModel?.spanB,
      legacySectionModel?.sectionKind,
      legacySectionModel?.spanA,
      legacySectionModel?.leftEdgeHeightM,
      legacySectionModel?.rightEdgeHeightM,
      legacySectionModel?.ridgeHeightM,
    ],
  );

  useEffect(() => {
    setSelectedScales(buildScaleState(legacyPlanModel, legacySectionModel));
  }, [scaleResetKey]);

  useEffect(() => {
    setActiveEditor(null);
    setEditorSaving(false);
  }, [editableFieldStateKey, resolvedSheetLabel, view]);

  const clearInteractionHideTimer = useCallback(() => {
    if (interactionHideTimerRef.current === null) return;
    window.clearTimeout(interactionHideTimerRef.current);
    interactionHideTimerRef.current = null;
  }, []);

  const setInteractionOwnerValue = useCallback((nextOwner: SheetPlanInteractionOwner) => {
    interactionOwnerRef.current = nextOwner;
    setInteractionOwner(nextOwner);
  }, []);

  const syncInteractionOwnerFromHoverState = useCallback(() => {
    const nextOwner = resolveSheetPlanInteractionOwner(hoverStateRef.current);
    setInteractionOwnerValue(nextOwner);
    return nextOwner;
  }, [setInteractionOwnerValue]);

  const scheduleInteractionOwnerSync = useCallback(() => {
    clearInteractionHideTimer();
    interactionHideTimerRef.current = window.setTimeout(() => {
      interactionHideTimerRef.current = null;
      syncInteractionOwnerFromHoverState();
    }, HOVER_POPOVER_HIDE_DELAY_MS);
  }, [clearInteractionHideTimer, syncInteractionOwnerFromHoverState]);

  const updateHoverZone = useCallback(
    (zone: SheetPlanHoverZone, hovered: boolean) => {
      clearInteractionHideTimer();
      hoverStateRef.current = {
        ...hoverStateRef.current,
        [zone]: hovered,
      };
      if (hovered || hoverStateRef.current.houseDrag || hasActiveSheetPlanHoverZones(hoverStateRef.current)) {
        syncInteractionOwnerFromHoverState();
        return;
      }
      scheduleInteractionOwnerSync();
    },
    [clearInteractionHideTimer, scheduleInteractionOwnerSync, syncInteractionOwnerFromHoverState],
  );

  const resetFootprintInteractions = useCallback(() => {
    clearInteractionHideTimer();
    hoverStateRef.current = createEmptySheetPlanHoverState();
    setInteractionOwnerValue('idle');
    setFootprintHoveredAttachmentSide(null);
    setFootprintHoveredHandleId(null);
    setFootprintActiveHandleId(null);
    setFootprintDragSession(null);
    setFootprintError(null);
  }, [clearInteractionHideTimer, setInteractionOwnerValue]);

  const handleHouseFillHoverChange = useCallback(
    (hovered: boolean) => {
      if (!canEditFootprint) return;
      if (hovered) {
        setFootprintError(null);
      }
      updateHoverZone('houseFill', hovered);
    },
    [canEditFootprint, updateHoverZone],
  );

  const handleHousePopoverHoverChange = useCallback(
    (hovered: boolean) => {
      if (!canEditFootprint) return;
      updateHoverZone('housePopover', hovered);
    },
    [canEditFootprint, updateHoverZone],
  );

  const handleHouseResizeEdgeHoverChange = useCallback(
    (handleId: ModuleFootprintEditorProps['hoveredHandleId']) => {
      setFootprintHoveredHandleId(handleId);
      updateHoverZone('houseResizeEdge', Boolean(handleId));
    },
    [updateHoverZone],
  );

  const handlePergolaTargetHoverChange = useCallback(
    (hovered: boolean) => {
      if (!canRotatePlan) return;
      updateHoverZone('pergola', hovered);
    },
    [canRotatePlan, updateHoverZone],
  );

  const handlePergolaPopoverHoverChange = useCallback(
    (hovered: boolean) => {
      if (!canRotatePlan) return;
      updateHoverZone('pergolaPopover', hovered);
    },
    [canRotatePlan, updateHoverZone],
  );

  useEffect(() => {
    resetFootprintInteractions();
  }, [resolvedSheetLabel, resetFootprintInteractions, view]);

  useEffect(() => {
    if (canEditFootprint || canRotatePlan) return;
    resetFootprintInteractions();
  }, [canEditFootprint, canRotatePlan, resetFootprintInteractions]);

  useEffect(
    () => () => {
      clearInteractionHideTimer();
    },
    [clearInteractionHideTimer],
  );

  const openInlineEditor = (field: EstimateDrawingField) => {
    if (!onCommitField) return;
    setActiveEditor({
      fieldId: field.id,
      mode: 'inline',
      value: field.rawValue,
      error: null,
    });
  };

  const submitEditor = async () => {
    if (!activeEditor || !activeField || !onCommitField || editorSaving) return;
    setEditorSaving(true);
    try {
      const result = await onCommitField(activeField, activeEditor.value);
      if (!result.ok) {
        setActiveEditor((current) =>
          current && current.fieldId === activeField.id
            ? { ...current, error: result.error ?? 'Unable to apply this change.' }
            : current,
        );
        window.setTimeout(() => editorInputRef.current?.focus(), 0);
        return;
      }
      setActiveEditor(null);
    } finally {
      setEditorSaving(false);
    }
  };

  const commitFootprintEdit = useCallback(
    async (edit: EstimateDrawingFootprintEdit) => {
      if (!onCommitFootprintEdit) return false;
      const result = await onCommitFootprintEdit(edit);
      if (!result.ok) {
        setFootprintError(result.error ?? 'Unable to update the house footprint.');
        return false;
      }
      setFootprintError(null);
      return true;
    },
    [onCommitFootprintEdit],
  );

  const handleFootprintPresetSelect = useCallback(
    async (preset: ModulePlanModel['houseFootprintPreset']) => {
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      await commitFootprintEdit({ type: 'preset', preset });
    },
    [commitFootprintEdit],
  );

  const handleFootprintRotate = useCallback(
    async (delta: -1 | 1) => {
      clearInteractionHideTimer();
      setFootprintHoveredAttachmentSide(null);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      syncInteractionOwnerFromHoverState();
      await commitFootprintEdit({ type: 'rotate', delta });
    },
    [clearInteractionHideTimer, commitFootprintEdit, syncInteractionOwnerFromHoverState],
  );

  const handleFootprintAttachmentSideSelect = useCallback(
    async (side: NonNullable<ModulePlanModel['attachmentSide']>) => {
      clearInteractionHideTimer();
      hoverStateRef.current = {
        ...hoverStateRef.current,
        houseAttachmentEdge: true,
      };
      setFootprintHoveredAttachmentSide(side);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      syncInteractionOwnerFromHoverState();
      await commitFootprintEdit({ type: 'attachment_side', side });
    },
    [clearInteractionHideTimer, commitFootprintEdit, syncInteractionOwnerFromHoverState],
  );

  const handleFootprintAttachmentSideHover = useCallback(
    (side: ModuleFootprintEditorProps['hoveredAttachmentSide']) => {
      setFootprintHoveredAttachmentSide(side);
      updateHoverZone('houseAttachmentEdge', Boolean(side));
    },
    [updateHoverZone],
  );

  const handleFootprintDragStart = useCallback(
    (meta: HouseFootprintEditorDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => {
      if (!canEditFootprint || !legacyPlanModel) return;
      const svg = footprintSvgRef.current;
      if (!svg) return;
      const startPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!startPoint) return;
      clearInteractionHideTimer();
      hoverStateRef.current = {
        ...hoverStateRef.current,
        houseDrag: true,
      };
      syncInteractionOwnerFromHoverState();
      setFootprintActiveHandleId(meta.handleId);
      setFootprintHoveredHandleId(meta.handleId);
      setFootprintDragSession({
        ...meta,
        pointerId: event.pointerId,
        startSvgX: startPoint.x,
        startSvgY: startPoint.y,
        startParams: normalizeHouseFootprintParams(legacyPlanModel.houseFootprintParams),
      });
    },
    [canEditFootprint, clearInteractionHideTimer, legacyPlanModel, syncInteractionOwnerFromHoverState],
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
      hoverStateRef.current = {
        ...hoverStateRef.current,
        houseDrag: false,
      };
      setFootprintDragSession(null);
      setFootprintActiveHandleId(null);
      setFootprintHoveredHandleId(null);
      syncInteractionOwnerFromHoverState();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [commitFootprintEdit, footprintDragSession, onCommitFootprintEdit, syncInteractionOwnerFromHoverState]);

  useEffect(() => {
    if (showHouseControls || footprintDragSession) return;
    setFootprintHoveredAttachmentSide(null);
    setFootprintHoveredHandleId(null);
    setFootprintActiveHandleId(null);
  }, [footprintDragSession, showHouseControls]);

  useEffect(() => {
    if (!showHouseControls && !showPergolaPopover && !footprintDragSession) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (footprintDragSession) {
        hoverStateRef.current = {
          ...hoverStateRef.current,
          houseDrag: false,
        };
        setFootprintDragSession(null);
        setFootprintActiveHandleId(null);
        syncInteractionOwnerFromHoverState();
        return;
      }
      resetFootprintInteractions();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [footprintDragSession, resetFootprintInteractions, showHouseControls, showPergolaPopover, syncInteractionOwnerFromHoverState]);

  const footprintEditor = useMemo<ModuleFootprintEditorProps | undefined>(() => {
    if (!canEditFootprint && !canRotatePlan) return undefined;
    return {
      available: canEditFootprint,
      surface: 'sheet',
      isEditing: showHouseControls,
      allowAttachmentSideCanvasSelect: true,
      allowResizeEdgeDrag: true,
      isContextHovered: showHousePopover,
      hoveredAttachmentSide: footprintHoveredAttachmentSide,
      hoveredHandleId: footprintHoveredHandleId,
      activeHandleId: footprintActiveHandleId,
      onStartEditing: () => {
        clearInteractionHideTimer();
        hoverStateRef.current = {
          ...hoverStateRef.current,
          houseFill: true,
        };
        syncInteractionOwnerFromHoverState();
        setFootprintError(null);
      },
      onDoneEditing: resetFootprintInteractions,
      onContextHoverChange: handleHouseFillHoverChange,
      onContextPopoverHoverChange: handleHousePopoverHoverChange,
      onAttachmentSideHover: handleFootprintAttachmentSideHover,
      onAttachmentSideSelect: handleFootprintAttachmentSideSelect,
      onHandleHover: handleHouseResizeEdgeHoverChange,
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
    clearInteractionHideTimer,
    footprintActiveHandleId,
    footprintDragSession,
    footprintHoveredAttachmentSide,
    footprintHoveredHandleId,
    handleFootprintAttachmentSideHover,
    handleFootprintAttachmentSideSelect,
    handleFootprintDragStart,
    handleFootprintPresetSelect,
    handleFootprintRotate,
    handleHousePopoverHoverChange,
    handleHouseFillHoverChange,
    handleHouseResizeEdgeHoverChange,
    resetFootprintInteractions,
    showHouseControls,
    showHousePopover,
    syncInteractionOwnerFromHoverState,
  ]);

  const sheetPlanInteraction = useMemo(
    () =>
      canRotatePlan
        ? {
            isPergolaPopoverOpen: showPergolaPopover,
            onPergolaHoverChange: handlePergolaTargetHoverChange,
            onPergolaPopoverHoverChange: handlePergolaPopoverHoverChange,
          }
        : undefined,
    [canRotatePlan, handlePergolaPopoverHoverChange, handlePergolaTargetHoverChange, showPergolaPopover],
  );

  const overlayEditorStyle = overlayEditor
    ? ({
        left: Math.max(8, (overlayEditor.rect?.left ?? 0) - 8),
        top: Math.max(8, (overlayEditor.rect?.top ?? 0) - 10),
        minWidth: Math.max(132, (overlayEditor.rect?.width ?? 0) + 16),
      } as CSSProperties)
    : undefined;

  const handleNativeSelectionCapture = useCallback((event: Event) => {
    blockNativeSelectionEvent(event);
  }, []);

  useEffect(() => {
    const node = sheetViewportRef.current;
    if (!node) return;
    const handleSelectStart = (event: Event) => handleNativeSelectionCapture(event);
    const handleDragStart = (event: Event) => handleNativeSelectionCapture(event);
    node.addEventListener('selectstart', handleSelectStart, true);
    node.addEventListener('dragstart', handleDragStart, true);
    return () => {
      node.removeEventListener('selectstart', handleSelectStart, true);
      node.removeEventListener('dragstart', handleDragStart, true);
    };
  }, [handleNativeSelectionCapture]);

  return (
    <div className={styles.sheetShell}>
      <div
        ref={sheetViewportRef}
        className={styles.sheetViewport}
        style={viewportStyle}
        data-native-selection-suppressed="true"
        data-drawing-surface-source={drawingSurfaceGeometry?.source}
      >
        <div className={styles.sheetStage}>
          <section className={styles.sheetPaper} style={moduleDrawingThemeCssVariables('sheet')} aria-label={`${viewLabel} A3 drawing sheet`}>
            <div className={styles.sheetUpper}>
              <div className={styles.sheetHeader}>
                <div className={styles.sheetHeaderCopy}>
                  <div className={styles.sheetEyebrow}>{viewLabel}</div>
                  {titleField && onCommitField && activeEditor?.fieldId === titleField.id ? (
                    <input
                      ref={(node) => {
                        editorInputRef.current = node;
                      }}
                      className={styles.sheetModuleLabelInput}
                      value={activeEditor.value}
                      onChange={(event) =>
                        setActiveEditor((current) => (current ? { ...current, value: event.target.value, error: null } : current))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setActiveEditor(null);
                          return;
                        }
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void submitEditor();
                        }
                      }}
                      onBlur={() => void submitEditor()}
                      autoFocus
                    />
                  ) : titleField && onCommitField ? (
                    <button type="button" className={styles.inlineEditableButton} onClick={() => openInlineEditor(titleField)}>
                      <span className={styles.sheetModuleLabel}>{clientFacingModuleLabel}</span>
                    </button>
                  ) : (
                    <div className={styles.sheetModuleLabel}>{clientFacingModuleLabel}</div>
                  )}
                  {activeEditor && activeEditor.fieldId === titleField?.id && activeEditor.error ? (
                    <div className={styles.inlineEditorError}>{activeEditor.error}</div>
                  ) : null}
                </div>
                <div className={styles.sheetHeaderRule} aria-hidden="true" />
              </div>

              <div className={styles.sheetInfoRail}>
                <label className={styles.sheetScaleBox}>
                  <span className={styles.scaleKicker}>Scale</span>
                  <select
                    className={styles.scaleSelect}
                    aria-label="Drawing scale"
                    value={estimateDrawingScaleKey(currentScale)}
                    onChange={(event) => {
                      const nextScale = parseEstimateDrawingScaleKey(event.target.value);
                      setSelectedScales((prev) => ({ ...prev, [view]: nextScale }));
                    }}
                  >
                    {scaleOptions.map((option) => (
                      <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {scaleWarning ? <span className={styles.scaleWarning}>{scaleWarning}</span> : null}
                </label>

                <aside className={styles.legendBox} aria-label="Drawing legend">
                  <div className={styles.legendTitle}>Legend</div>
                  <div className={styles.legendList}>
                    {legendItems.map((item) => (
                      <div key={item.label} className={styles.legendItem}>
                        <LegendSample item={item} />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </aside>

                <aside className={styles.sheetMetaBox} aria-label="Sheet metadata">
                  <div className={styles.legendTitle}>Sheet info</div>
                  <div className={styles.sheetMetaGrid}>
                    {railMetaItems.map((item) => (
                      <div key={item.label} className={styles.sheetMetaPair} data-sheet-meta={item.label.toLowerCase()}>
                        <span className={styles.blockLabel}>{item.label}</span>
                        <span className={styles.sheetMetaValue}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </aside>

                {moduleInfoRows.length ? (
                  <aside className={styles.sheetMetaBox} aria-label="Module information">
                    <div className={styles.legendTitle}>Module info</div>
                    <div className={styles.sheetMetaGrid}>
                      {moduleInfoRows.map((item) => (
                        <div key={item.label} className={styles.sheetMetaPair} data-module-meta={item.label.toLowerCase()}>
                          <span className={styles.blockLabel}>{item.label}</span>
                          <span className={styles.sheetMetaValue}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </aside>
                ) : null}
              </div>

              <div className={styles.drawingViewport}>
                {showDebugOverlays ? <SheetLayoutDebugOverlay view={view} /> : null}
                <ModuleDrawingRenderer
                  key={view}
                  view={view}
                  status={status}
                  drawingSurfaceGeometry={drawingSurfaceGeometry}
                  planModel={legacyPlanModel}
                  sectionModel={legacySectionModel}
                  presentation="sheet"
                  drawingScale={currentScale}
                  sheetViewportMm={SHEET_VIEWPORT_MM}
                  interactiveFields={editableSvgFields}
                  showDebugOverlays={showDebugOverlays}
                  footprintEditor={footprintEditor}
                  sheetPlanInteraction={sheetPlanInteraction}
                />
                {footprintError ? (
                  <div className={styles.sheetInteractionError} role="status" aria-live="polite">
                    {footprintError}
                  </div>
                ) : null}
              </div>
            </div>

            <footer className={styles.sheetFooter}>
              <div className={styles.companyBlock}>
                <div className={styles.companyName}>{PORTAL_COMPANY_PROFILE.name}</div>
                <div className={styles.companyLine}>{PORTAL_COMPANY_PROFILE.addressLines.join(', ')}</div>
                <div className={styles.companyLine}>{`${PORTAL_COMPANY_PROFILE.phone}  |  ${PORTAL_COMPANY_PROFILE.email}`}</div>
              </div>

              <div className={styles.noteBlock}>
                <span className={styles.noteLabel}>Note</span>
                {noteField && onCommitField && activeEditor?.fieldId === noteField.id ? (
                  <span className={styles.noteCopy}>
                    <textarea
                      ref={(node) => {
                        editorInputRef.current = node;
                      }}
                      className={styles.noteTextarea}
                      value={activeEditor.value}
                      onChange={(event) =>
                        setActiveEditor((current) => (current ? { ...current, value: event.target.value, error: null } : current))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setActiveEditor(null);
                        }
                      }}
                      onBlur={() => void submitEditor()}
                      autoFocus
                    />
                    {activeEditor.error ? <span className={styles.inlineEditorError}>{activeEditor.error}</span> : null}
                  </span>
                ) : noteField && onCommitField ? (
                  <button type="button" className={styles.inlineEditableButton} onClick={() => openInlineEditor(noteField)}>
                    <span className={styles.noteCopy}>
                      {noteDisplayLines.map((line, index) => (
                        <span key={`${line}-${index}`} className={styles.noteLine}>
                          {line}
                        </span>
                      ))}
                    </span>
                  </button>
                ) : (
                  <span className={styles.noteCopy}>
                    {noteDisplayLines.map((line, index) => (
                      <span key={`${line}-${index}`} className={styles.noteLine}>
                        {line}
                      </span>
                    ))}
                  </span>
                )}
              </div>

              <div className={styles.infoCluster}>
                <div className={styles.titleInfoBlock}>
                  <div className={styles.blockValue}>{clientFacingDrawingTitle}</div>
                  <div className={styles.titleSubValue}>{meta.siteAddress}</div>
                </div>

                <div className={styles.clusterBottomRow}>
                  {footerMetaItems.map((item) => (
                    <div key={item.label} className={styles.metaCell}>
                      <span className={styles.blockLabel}>{item.label}</span>
                      <span className={styles.metaValue}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </footer>
          </section>
        </div>
        {overlayEditor && activeField ? (
          <div className={styles.overlayEditor} style={overlayEditorStyle}>
            <input
              ref={(node) => {
                editorInputRef.current = node;
              }}
              className={styles.overlayEditorInput}
              value={activeEditor?.value ?? ''}
              onChange={(event) =>
                setActiveEditor((current) => (current ? { ...current, value: event.target.value, error: null } : current))
              }
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setActiveEditor(null);
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void submitEditor();
                }
              }}
              onBlur={() => void submitEditor()}
              autoFocus
            />
            {activeEditor?.error ? <div className={styles.overlayEditorError}>{activeEditor.error}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
