import type { Point2 } from '@sp/geometry';
import type { CalculatorHouseFootprintPolygonPoint } from '@/lib/types/calculator';
import type { WorkbenchPergolaRenderStatus } from '@/lib/drawings/state/workbenchSolvedModel';

type AttachmentSide = 'rear' | 'front' | 'left' | 'right';
type DeckAttachmentMode = 'floating' | 'single_edge' | 'corner_dual_edge';
type OverlayRenderSource =
  | 'geometry'
  | 'geometry_derived'
  | 'diagnostic_plan_reference'
  | 'top_projection_committed'
  | 'top_projection_context';

export type PlanPoint = Point2;

type PlanSegment = {
  start: PlanPoint;
  end: PlanPoint;
};

type ObjectWorkbenchPlanDeckReferenceFrame = {
  hostEdgeId: AttachmentSide;
  sourceEdgeId: string;
  frameSource?: 'top_projection_wall_edge' | 'top_projection_body' | 'geometry_plan' | 'object_frame';
  axis: 'along' | 'depth';
  spanStartM: number;
  spanEndM: number;
  edgeCoordinateM: number;
  outwardDirection: -1 | 1;
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
  alongUnitX: number;
  alongUnitY: number;
  outwardUnitX: number;
  outwardUnitY: number;
};

type ObjectWorkbenchPlanDeckCrossEdgeReference = {
  hostEdgeId: AttachmentSide;
  gapM: number;
  frame: ObjectWorkbenchPlanDeckReferenceFrame;
};

export type ObjectWorkbenchPlanDeckInteraction = {
  kind: 'preset_rect' | 'custom_outline';
  placement: 'snapped' | 'floating';
  attachmentMode: DeckAttachmentMode;
  houseAttachmentSide: AttachmentSide;
  semanticPlacementSide: AttachmentSide | null;
  semanticWitnessSide: AttachmentSide;
  placementEdgeId: string | null;
  primaryHostEdgeId: string | null;
  secondaryHostEdgeId: string | null;
  cornerVertexId: string | null;
  witnessEdgeId: string;
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
  hostSpanM: number;
  deckWidthM: number;
  deckDepthM: number;
  centerOffsetM: number;
  referenceEdgeGapM: number;
  minCenterOffsetM: number;
  maxCenterOffsetM: number;
  renderedCenter: PlanPoint;
  dragPolygon: PlanPoint[];
  dragCenter: PlanPoint;
  dragCoordinateSpace: 'top_projection_world_m' | 'object_outline_plan_m';
  dragSource: OverlayRenderSource;
  commitStartPolygon: PlanPoint[] | null;
  referenceFrames: ObjectWorkbenchPlanDeckReferenceFrame[];
  commitReferenceFrames: ObjectWorkbenchPlanDeckReferenceFrame[];
  snapFrameSource?: 'top_projection_wall_edge' | 'top_projection_body' | 'geometry_plan';
  crossEdgeReference: ObjectWorkbenchPlanDeckCrossEdgeReference | null;
};

export type ObjectWorkbenchPlanOpeningInteraction = {
  kind: 'opening';
  hostEdgeId: string;
  hostEdgeStart: PlanPoint;
  hostEdgeEnd: PlanPoint;
  hostSpanM: number;
  openingWidthM: number;
  offsetAlongWallM: number;
  minOffsetAlongWallM: number;
  maxOffsetAlongWallM: number;
};

type ObjectWorkbenchPlanShapeOverlay = {
  ownerKind: 'footprint' | 'deck' | 'opening';
  ownerId: string;
  polygon: PlanPoint[];
  detailSegments: PlanSegment[];
  selected: boolean;
  custom: boolean;
  muted: boolean;
  invalid: boolean;
  invalidMessage: string | null;
  deckInteraction: ObjectWorkbenchPlanDeckInteraction | null;
  openingInteraction: ObjectWorkbenchPlanOpeningInteraction | null;
  deckDragEligibility:
    | {
        eligible: boolean;
        reason: string;
      }
    | null;
  openingDragEligibility:
    | {
        eligible: boolean;
        reason: string;
      }
    | null;
  source: OverlayRenderSource;
  geometrySourceId: string | null;
  renderStatus: WorkbenchPergolaRenderStatus;
};

export type ObjectWorkbenchPlanPresetDimensionAnnotation = {
  id: string;
  targetKind: 'house_preset_param' | 'deck_preset_param' | 'deck_host_edge_reference' | 'opening_param';
  emphasis: 'driving' | 'relationship';
  ownerKind: 'footprint' | 'deck' | 'opening';
  ownerId: string;
  fieldKey: string;
  rawValue: string;
  displayValue: string;
  witnessStart: PlanPoint;
  witnessEnd: PlanPoint;
  lineStart: PlanPoint;
  lineEnd: PlanPoint;
  deckInteraction: ObjectWorkbenchPlanDeckInteraction | null;
};

export type ObjectWorkbenchPlanCustomEdgeCandidate = {
  id: string;
  targetKind: 'house_custom_edge' | 'deck_custom_edge';
  ownerKind: 'footprint' | 'deck';
  ownerId: string;
  edgeIndex: number;
  rawValue: string;
  displayValue: string;
  localPolygon: CalculatorHouseFootprintPolygonPoint[];
  witnessStart: PlanPoint;
  witnessEnd: PlanPoint;
  lineStart: PlanPoint;
  lineEnd: PlanPoint;
};

export type ObjectWorkbenchPlanOverlay = {
  housePolygonSource: 'custom_saved' | 'preset_derived' | 'geometry_projection';
  shapes: ObjectWorkbenchPlanShapeOverlay[];
  presetAnnotations: ObjectWorkbenchPlanPresetDimensionAnnotation[];
  customEdgeCandidates: ObjectWorkbenchPlanCustomEdgeCandidate[];
};
