import type { AttachmentSide } from '@sp/costing';
import type { GeometryPlanViewModel, GeometryTopProjectionViewModel } from '@sp/geometry';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  ObjectWorkbenchPlanCustomEdgeCandidate,
  ObjectWorkbenchPlanDeckInteraction,
  ObjectWorkbenchPlanOpeningInteraction,
  ObjectWorkbenchPlanOverlay,
  ObjectWorkbenchPlanPresetDimensionAnnotation,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type { ObjectInteractionPreviewOverlay } from '@/lib/drawings/interactions/objectInteractionEngine';
import type { WorkbenchDrawingSurfaceGeometry } from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import type {
  ObjectWorkbenchPergolaRenderSource,
  ObjectWorkbenchPergolaRenderStatus,
} from '@/lib/drawings/geometry/deriveWorkbenchGeometry';
import type { DrawingSheetFitResult } from '@/lib/estimates/drawingSheetLayout';
import type { EstimateDrawingScale } from '@/lib/estimates/drawingSheet';
import type { HouseFootprintHandleId, ModulePlanModel, ModuleSectionModel } from './moduleViews';
import type {
  PlanSvgFootprintCanvasPoint,
  PlanSvgFootprintCanvasPointResolver,
} from './ModulePlanSvgBridge';

type Point = { x: number; y: number };

export type ModuleViewsTab = 'plan' | 'section';
export type ModuleViewsStatus = 'loading' | 'ready' | 'error' | 'empty';
export type ModuleDrawingPresentation = 'card' | 'minimal' | 'sheet' | 'model';
export type ModuleDrawingDisplayMode = 'house' | 'pergolas';

export type HouseFootprintEditorDragMeta = {
  handleId: HouseFootprintHandleId;
  axisX: number;
  axisY: number;
  scale: number;
  deltaMultiplier: number;
  minValueM: number;
  maxValueM: number;
};

export type HouseFootprintVertexDragMeta = {
  vertexIndex: number;
  alongAxisX: number;
  alongAxisY: number;
  depthAxisX: number;
  depthAxisY: number;
  scale: number;
};

type ModuleFootprintEditorSurface = 'card' | 'sheet' | 'model';
export type ModuleFootprintCanvasPoint = PlanSvgFootprintCanvasPoint;

export type ModulePlanSheetInteractionProps = {
  isPergolaPopoverOpen?: boolean;
  onPergolaHoverChange?: (hovered: boolean) => void;
  onPergolaPopoverHoverChange?: (hovered: boolean) => void;
};

export type ModulePlanResizeFieldId = 'plan:lengthA' | 'plan:spanA';

export type ModulePlanResizeDragMeta = {
  fieldId: ModulePlanResizeFieldId;
  axisX: number;
  axisY: number;
  scale: number;
  deltaMultiplier: number;
  minValueM: number;
  maxValueM: number;
};

export type ModulePlanInteractionProps = {
  available: boolean;
  hoveredResizeFieldId: ModulePlanResizeFieldId | null;
  activeResizeFieldId: ModulePlanResizeFieldId | null;
  onResizeFieldHover: (fieldId: ModulePlanResizeFieldId | null) => void;
  onResizeFieldDragStart: (
    meta: ModulePlanResizeDragMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
  onPlanPointResolverChange?: ((resolver: ((clientX: number, clientY: number) => PlanPoint | null) | null) => void) | undefined;
  onDeckDragPointResolverChange?: ((resolver: ((clientX: number, clientY: number) => PlanPoint | null) | null) => void) | undefined;
  onSvgMount?: (node: SVGSVGElement | null) => void;
};

export type ObjectWorkbenchPlanShapeDragStartMeta =
  | {
      ownerKind: 'deck';
      ownerId: string;
      overlayShape: ObjectWorkbenchPlanOverlay['shapes'][number];
      deckInteraction: ObjectWorkbenchPlanDeckInteraction & {
        hostEdgeStart: Point;
        hostEdgeEnd: Point;
      };
    }
  | {
      ownerKind: 'opening';
      ownerId: string;
      openingInteraction: ObjectWorkbenchPlanOpeningInteraction & {
        hostEdgeStart: Point;
        hostEdgeEnd: Point;
      };
    };

export type ObjectWorkbenchPreviewOverlay = ObjectInteractionPreviewOverlay<PlanPoint>;
export type ModuleFootprintCanvasPointResolver = PlanSvgFootprintCanvasPointResolver;

export type GeometryConsistency = {
  level: 'ok' | 'warn';
  summary: string;
  details: string[];
};

export type ModuleFootprintEditorProps = {
  available: boolean;
  isEditing: boolean;
  surface?: ModuleFootprintEditorSurface;
  allowAttachmentSideCanvasSelect?: boolean;
  attachmentSideCanvasActiveSide?: AttachmentSide | null;
  allowResizeEdgeDrag?: boolean;
  customPolygonOverride?: ModulePlanModel['houseFootprintPolygon'] | null;
  customPolygonOpen?: boolean;
  customPolygonConfirmedPointCount?: number;
  customPolygonPreviewPointKind?: 'pending' | 'hover' | 'locked-distance' | null;
  customPolygonCloseReady?: boolean;
  customPolygonCloseHovered?: boolean;
  customPolygonLandingPoint?: ModuleFootprintCanvasPoint | null;
  customPolygonLockedDistanceM?: number | null;
  customPolygonHasError?: boolean;
  hideHouseFootprint?: boolean;
  isContextHovered?: boolean;
  onContextPopoverHoverChange?: (hovered: boolean) => void;
  hoveredAttachmentSide: AttachmentSide | null;
  hoveredHandleId: HouseFootprintHandleId | null;
  activeHandleId: HouseFootprintHandleId | null;
  onStartEditing: () => void;
  onDoneEditing: () => void;
  onContextHoverChange?: (hovered: boolean) => void;
  onAttachmentSideHover: (side: AttachmentSide | null) => void;
  onAttachmentSideSelect: (side: AttachmentSide) => void;
  onHandleHover: (handleId: HouseFootprintHandleId | null) => void;
  onHandleDragStart: (meta: HouseFootprintEditorDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => void;
  onVertexDragStart?: (meta: HouseFootprintVertexDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => void;
  onVertexDelete?: (vertexIndex: number) => void;
  onEdgeAdd?: (edgeIndex: number) => void;
  onPresetSelect: (preset: ModulePlanModel['houseFootprintPreset']) => void;
  onModeSelect?: (mode: NonNullable<Required<ModulePlanModel>['houseFootprintMode']>) => void;
  onRotate: (delta: -1 | 1) => void;
  onCanvasPointSelect?: (point: ModuleFootprintCanvasPoint) => void;
  onCanvasPointPointerDown?: (
    point: ModuleFootprintCanvasPoint,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
  onCanvasPointHover?: (point: ModuleFootprintCanvasPoint | null) => void;
  onCanvasPointResolverChange?: (resolver: ModuleFootprintCanvasPointResolver | null) => void;
  onCloseStartSelect?: () => void;
  onSvgMount?: (node: SVGSVGElement | null) => void;
};

export type ModuleDrawingInteractiveField = {
  fieldId: string;
  onActivate?: (fieldId: string, target: SVGTextElement) => void;
};

export type ModuleDrawingInteractiveFieldMap = Partial<Record<string, ModuleDrawingInteractiveField>>;

export type ModuleDrawingScaleState = {
  requestedScale: EstimateDrawingScale;
  appliedScale: EstimateDrawingScale;
  fit: DrawingSheetFitResult | null;
  fits: boolean;
  suggestedScale: EstimateDrawingScale;
};

export type ModuleDrawingScaleDiagnostic = {
  scale: EstimateDrawingScale;
  fits: boolean;
  requiredWidthMm: number;
  requiredHeightMm: number;
  availableWidthMm: number;
  availableHeightMm: number;
  utilizationX: number;
  utilizationY: number;
};

export type ModuleDrawingRendererProps = {
  view: ModuleViewsTab;
  status: ModuleViewsStatus;
  statusDetail?: string;
  drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  presentation?: ModuleDrawingPresentation;
  drawingScale?: EstimateDrawingScale;
  sheetViewportMm?: { widthMm: number; heightMm: number };
  interactiveFields?: ModuleDrawingInteractiveFieldMap;
  showDebugOverlays?: boolean;
  displayMode?: ModuleDrawingDisplayMode;
  visibility?: DrawingWorkbenchVisibilityState;
  footprintEditor?: ModuleFootprintEditorProps;
  planInteraction?: ModulePlanInteractionProps;
  sheetPlanInteraction?: ModulePlanSheetInteractionProps;
  objectWorkbenchPlanOverlay?: ObjectWorkbenchPlanOverlay | null;
  activeObjectWorkbenchCustomEdgeId?: string | null;
  onObjectWorkbenchShapeSelect?: (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => void;
  hoveredObjectWorkbenchDeckId?: string | null;
  onObjectWorkbenchDeckHoverChange?: (deckId: string | null) => void;
  currentPergolaId?: string | null;
  enableProjectionOnlyModelInteractions?: boolean;
  onPergolaSelect?: (pergolaId: string) => void;
  onCanvasSelect?: () => void;
  onObjectWorkbenchShapeDragStart?: (
    meta: ObjectWorkbenchPlanShapeDragStartMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
  onObjectWorkbenchCustomEdgeSelect?: (target: { ownerKind: 'footprint' | 'deck'; ownerId: string; edgeIndex: number }) => void;
  onObjectWorkbenchDimensionActivate?: (
    annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
    target: SVGTextElement,
  ) => void;
  objectWorkbenchPreviewOverlay?: ObjectWorkbenchPreviewOverlay | null;
  modelSpacePergolaGeometry?: GeometryPlanViewModel | null;
  modelSpaceTopProjection?: GeometryTopProjectionViewModel | null;
  modelSpacePergolaRenderSource?: ObjectWorkbenchPergolaRenderSource;
  modelSpacePergolaRenderStatus?: ObjectWorkbenchPergolaRenderStatus;
};
