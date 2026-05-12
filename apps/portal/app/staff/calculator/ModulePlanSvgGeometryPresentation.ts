import type {
  GeometryPlanMember2D,
  GeometryPlanSurface2D,
  GeometryPlanViewModel,
  GeometryTopProjectionViewModel,
  Line2,
  Point2,
  Vector2,
} from '@sp/geometry';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  WorkbenchPergolaRenderSource,
  WorkbenchPergolaRenderStatus,
} from '@/lib/drawings/geometry/deriveWorkbenchGeometry';
import {
  mmPointToPlanSvg,
  mmPolygonToPlanSvg,
  topProjectionDirectionToPlanSvg,
  topProjectionPointToPlanSvg,
} from '@/lib/drawings/views/plan/planCoordinateAdapter';
import type {
  ObjectWorkbenchPlanOverlay,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type {
  ModulePlanHouseLine2D,
  ModulePlanHouseSurface,
  ModulePlanModel,
} from './moduleViews';
import type { ObjectWorkbenchOverlayShape } from './ModulePlanLayerRenderers';

export type PlanSvgGeometryPresentationMode = {
  useTopProjectionBackedPlan: boolean;
  useGeometryBackedPergola: boolean;
  hasGeometryBackedPergolaPlan: boolean;
  useProjectionOnlyModelSpacePlan: boolean;
  canRenderPergolaPlanGeometry: boolean;
};

export type PlanSvgGeometryPoint = {
  x: number;
  y: number;
};

export type ProjectedGeometrySurface = GeometryPlanSurface2D & {
  points: PlanSvgGeometryPoint[];
};

export type ProjectedGeometryMember = {
  member: GeometryPlanMember2D;
  footprint: PlanSvgGeometryPoint[];
};

export type ProjectedGeometryLine = {
  start: PlanSvgGeometryPoint;
  end: PlanSvgGeometryPoint;
};

export type ProjectedGeometryFallAnchor = {
  point: PlanSvgGeometryPoint;
  direction: Vector2;
  dual: boolean;
};

export type ProjectedSemanticPlanHouseSurface = ModulePlanHouseSurface & {
  points: PlanSvgGeometryPoint[];
  toned: boolean;
};

export type ProjectedSemanticPlanHouseLine = ModulePlanHouseLine2D & {
  start: PlanSvgGeometryPoint;
  end: PlanSvgGeometryPoint;
  emphasized: boolean;
};

export type PlanSvgGeometryPresentation = PlanSvgGeometryPresentationMode & {
  geometryOutlinePoints: PlanSvgGeometryPoint[];
  geometryRoofPlaneSurfaces: ProjectedGeometrySurface[];
  geometryRoofCladdingSurfaces: ProjectedGeometrySurface[];
  geometryPergolaStripMembers: ProjectedGeometryMember[];
  geometryRafterMembers: ProjectedGeometryMember[];
  geometryRidgeMembers: ProjectedGeometryMember[];
  geometryAttachmentEdge: ProjectedGeometryLine | null;
  geometryFallAnchor: ProjectedGeometryFallAnchor | null;
  selectedOpeningHostEdgeId: string | null;
  semanticPlanHouseSurfaces: ProjectedSemanticPlanHouseSurface[];
  semanticPlanHouseLines: ProjectedSemanticPlanHouseLine[];
  hasSemanticPlanHouseContext: boolean;
};

export function resolvePlanSvgGeometryPresentationMode(input: {
  presentation: 'card' | 'minimal' | 'sheet' | 'model';
  showPergolaGeometry: boolean;
  modelSpacePergolaRenderSource: WorkbenchPergolaRenderSource;
  modelSpacePergolaRenderStatus: WorkbenchPergolaRenderStatus;
  modelSpaceTopProjection?: GeometryTopProjectionViewModel | null;
  modelSpacePergolaGeometry?: GeometryPlanViewModel | null;
}): PlanSvgGeometryPresentationMode {
  const isModel = input.presentation === 'model';
  const useTopProjectionBackedPlan =
    (input.presentation === 'model' || input.presentation === 'sheet') &&
    input.modelSpacePergolaRenderSource === 'geometry' &&
    input.modelSpacePergolaRenderStatus === 'geometry_ready' &&
    Boolean(input.modelSpaceTopProjection);
  const useGeometryBackedPergola =
    isModel &&
    input.modelSpacePergolaRenderSource === 'geometry' &&
    input.modelSpacePergolaRenderStatus === 'geometry_ready' &&
    Boolean(input.modelSpacePergolaGeometry);
  const hasGeometryBackedPergolaPlan =
    (input.presentation === 'model' || input.presentation === 'sheet') &&
    input.modelSpacePergolaRenderSource === 'geometry' &&
    input.modelSpacePergolaRenderStatus === 'geometry_ready' &&
    Boolean(input.modelSpacePergolaGeometry);
  const useProjectionOnlyModelSpacePlan = isModel && useTopProjectionBackedPlan;
  return {
    useTopProjectionBackedPlan,
    useGeometryBackedPergola,
    hasGeometryBackedPergolaPlan,
    useProjectionOnlyModelSpacePlan,
    canRenderPergolaPlanGeometry: input.showPergolaGeometry && (!isModel || useGeometryBackedPergola || useTopProjectionBackedPlan),
  };
}

export function buildPlanSvgGeometryPresentation(input: {
  model: ModulePlanModel;
  presentation: 'card' | 'minimal' | 'sheet' | 'model';
  mode: PlanSvgGeometryPresentationMode;
  modelSpaceTopProjection?: GeometryTopProjectionViewModel | null;
  modelSpacePergolaGeometry?: GeometryPlanViewModel | null;
  familyVisibility: DrawingWorkbenchVisibilityState;
  objectWorkbenchOverlayShapes: ObjectWorkbenchOverlayShape[];
  visibleObjectWorkbenchDeckIds: Set<string>;
  customPolygonOverrideActive: boolean;
  hideHouseFootprint: boolean;
  baseX: number;
  baseY: number;
  scale: number;
}): PlanSvgGeometryPresentation {
  const geometryPointProjector =
    input.mode.useTopProjectionBackedPlan && input.modelSpaceTopProjection
      ? (point: Point2) => topProjectionPointToPlanSvg(point, input.modelSpaceTopProjection!, input.baseX, input.baseY, input.scale)
      : (point: Point2) => mmPointToPlanSvg(point, input.baseX, input.baseY, input.scale);
  const geometryLineProjector = (line: Line2) => ({
    start: geometryPointProjector(line.start),
    end: geometryPointProjector(line.end),
  });
  const geometryOutlinePoints =
    input.mode.useGeometryBackedPergola && input.modelSpacePergolaGeometry
      ? mmPolygonToPlanSvg(input.modelSpacePergolaGeometry.outline, input.baseX, input.baseY, input.scale)
      : [];
  const geometryRoofPlaneSurfaces =
    input.mode.useGeometryBackedPergola && input.modelSpacePergolaGeometry
      ? input.modelSpacePergolaGeometry.surfaces.roofPlanes.map((surface) => ({
          ...surface,
          points: mmPolygonToPlanSvg(surface.boundary, input.baseX, input.baseY, input.scale),
        }))
      : [];
  const geometryRoofCladdingSurfaces =
    input.mode.useGeometryBackedPergola && input.modelSpacePergolaGeometry
      ? input.modelSpacePergolaGeometry.surfaces.roofCladding.map((surface) => ({
          ...surface,
          points: mmPolygonToPlanSvg(surface.boundary, input.baseX, input.baseY, input.scale),
        }))
      : [];
  const geometryPergolaStripMembers =
    input.mode.useGeometryBackedPergola && input.modelSpacePergolaGeometry
      ? [
          ...input.modelSpacePergolaGeometry.members.posts,
          ...input.modelSpacePergolaGeometry.members.beams,
          ...input.modelSpacePergolaGeometry.members.ledgers,
          ...input.modelSpacePergolaGeometry.members.gutters,
          ...input.modelSpacePergolaGeometry.members.joiners,
        ].map((member) => ({
          member,
          footprint: buildPlanMemberFootprint({ member, baseX: input.baseX, baseY: input.baseY, scale: input.scale }),
        }))
      : [];
  const geometryRafterMembers =
    input.mode.useGeometryBackedPergola && input.modelSpacePergolaGeometry
      ? input.modelSpacePergolaGeometry.members.rafters.map((member) => ({
          member,
          footprint: buildPlanMemberFootprint({ member, baseX: input.baseX, baseY: input.baseY, scale: input.scale }),
        }))
      : [];
  const geometryRidgeMembers =
    input.mode.useGeometryBackedPergola && input.modelSpacePergolaGeometry
      ? input.modelSpacePergolaGeometry.members.ridge.map((member) => ({
          member,
          footprint: buildPlanMemberFootprint({ member, baseX: input.baseX, baseY: input.baseY, scale: input.scale }),
        }))
      : [];
  const geometryAttachmentEdge =
    input.mode.hasGeometryBackedPergolaPlan && input.modelSpacePergolaGeometry?.attachmentEdge
      ? geometryLineProjector(input.modelSpacePergolaGeometry.attachmentEdge)
      : null;
  const geometryFallAnchor =
    input.mode.hasGeometryBackedPergolaPlan && input.modelSpacePergolaGeometry?.anchors.fall
      ? {
          point: geometryPointProjector(input.modelSpacePergolaGeometry.anchors.fall.point),
          direction: topProjectionDirectionToPlanSvg(
            input.modelSpacePergolaGeometry.anchors.fall.direction,
            input.mode.useTopProjectionBackedPlan ? input.modelSpaceTopProjection : null,
          ),
          dual: input.modelSpacePergolaGeometry.anchors.fall.dual,
        }
      : null;

  const selectedOpeningHostEdgeId =
    input.objectWorkbenchOverlayShapes.find((shape) => shape.ownerKind === 'opening' && shape.selected)?.openingInteraction?.hostEdgeId ?? null;
  const toneHouseRoofContext = Boolean(selectedOpeningHostEdgeId);
  const rawSemanticPlanHouseSurfaces = input.mode.useTopProjectionBackedPlan ? [] : input.model.houseContext?.surfaces ?? [];
  const rawSemanticPlanHouseLines = input.mode.useTopProjectionBackedPlan ? [] : input.model.houseContext?.lines ?? [];
  const semanticPlanHouseSurfaces = rawSemanticPlanHouseSurfaces
    .filter((surface) => {
      if (surface.kind !== 'deck') return true;
      if (!input.familyVisibility.decks) return false;
      return !input.visibleObjectWorkbenchDeckIds.has(surface.id);
    })
    .map((surface) => ({
      ...surface,
      points: surface.boundary.map((point) => planHousePointToSvg(point, input.baseX, input.baseY, input.scale)),
      toned:
        toneHouseRoofContext &&
        (surface.kind === 'roof' || surface.kind === 'soffit' || surface.kind === 'fascia' || surface.kind === 'attachment_zone'),
    }));
  const semanticPlanHouseLines = rawSemanticPlanHouseLines.map((line) => ({
    ...line,
    start: planHousePointToSvg(line.line.start, input.baseX, input.baseY, input.scale),
    end: planHousePointToSvg(line.line.end, input.baseX, input.baseY, input.scale),
    emphasized: selectedOpeningHostEdgeId !== null && line.metadata?.sourceEdgeId === selectedOpeningHostEdgeId,
  }));

  return {
    ...input.mode,
    geometryOutlinePoints,
    geometryRoofPlaneSurfaces,
    geometryRoofCladdingSurfaces,
    geometryPergolaStripMembers,
    geometryRafterMembers,
    geometryRidgeMembers,
    geometryAttachmentEdge,
    geometryFallAnchor,
    selectedOpeningHostEdgeId,
    semanticPlanHouseSurfaces,
    semanticPlanHouseLines,
    hasSemanticPlanHouseContext:
      input.familyVisibility.house &&
      !input.customPolygonOverrideActive &&
      !input.hideHouseFootprint &&
      (semanticPlanHouseSurfaces.length > 0 || semanticPlanHouseLines.length > 0),
  };
}

export function resolveObjectWorkbenchHousePolygonOverlay(input: {
  overlay: ObjectWorkbenchPlanOverlay | null | undefined;
  useTopProjectionBackedPlan: boolean;
  modelSpaceTopProjection: GeometryTopProjectionViewModel | null | undefined;
  baseX: number;
  baseY: number;
  scale: number;
}): PlanSvgGeometryPoint[] | null {
  const footprintShape = input.overlay?.shapes.find((shape) => shape.ownerKind === 'footprint');
  if (!footprintShape || footprintShape.polygon.length < 3) return null;
  const project = (point: PlanPoint) =>
    input.useTopProjectionBackedPlan && input.modelSpaceTopProjection
      ? topProjectionPointToPlanSvg(
          { x: point.x * 1000, y: point.y * 1000 },
          input.modelSpaceTopProjection,
          input.baseX,
          input.baseY,
          input.scale,
        )
      : { x: input.baseX + point.x * input.scale, y: input.baseY + point.y * input.scale };
  return footprintShape.polygon.map(project);
}

export function buildPlanMemberFootprint(input: {
  member: GeometryPlanMember2D;
  baseX: number;
  baseY: number;
  scale: number;
}): PlanSvgGeometryPoint[] {
  const start = mmPointToPlanSvg(input.member.centerline.start, input.baseX, input.baseY, input.scale);
  const end = mmPointToPlanSvg(input.member.centerline.end, input.baseX, input.baseY, input.scale);
  const halfWidth = Math.max(0.15, (input.member.profile.widthMm / 1000) * input.scale / 2);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);

  if (length <= 0.001) {
    const center = start;
    return [
      { x: center.x - halfWidth, y: center.y - halfWidth },
      { x: center.x + halfWidth, y: center.y - halfWidth },
      { x: center.x + halfWidth, y: center.y + halfWidth },
      { x: center.x - halfWidth, y: center.y + halfWidth },
    ];
  }

  const nx = -dy / length;
  const ny = dx / length;
  return [
    { x: start.x + nx * halfWidth, y: start.y + ny * halfWidth },
    { x: end.x + nx * halfWidth, y: end.y + ny * halfWidth },
    { x: end.x - nx * halfWidth, y: end.y - ny * halfWidth },
    { x: start.x - nx * halfWidth, y: start.y - ny * halfWidth },
  ];
}

function planHousePointToSvg(
  point: PlanSvgGeometryPoint,
  baseX: number,
  baseY: number,
  scale: number,
): PlanSvgGeometryPoint {
  return {
    x: baseX + point.x * scale,
    y: baseY + point.y * scale,
  };
}
