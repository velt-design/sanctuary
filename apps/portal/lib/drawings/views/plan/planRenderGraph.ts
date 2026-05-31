import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildPlanCommittedBodyVisualStack } from './planCommittedBodyVisualStack';
import {
  planShapeIsPlanHitTarget,
  planShapeVisualOwner,
} from './planShapeOwnership';

export type ProjectionPlanLayer =
  | 'committedBodies'
  | 'contextLines'
  | 'detailLines'
  | 'hitTargets'
  | 'selectionOutlines'
  | 'dimensions'
  | 'dragPreview'
  | 'debug';

export type TopProjectionRole = 'top_visible' | 'context' | 'hidden_from_top';

export type ProjectionPlanGraphItem<TItem extends { shape: GeometryTopProjectionShape }> = TItem & {
  layer: ProjectionPlanLayer;
};

export type ProjectionPlanRenderGraph<TItem extends { shape: GeometryTopProjectionShape }> = {
  committedBodies: Array<ProjectionPlanGraphItem<TItem>>;
  contextLines: Array<ProjectionPlanGraphItem<TItem>>;
  detailLines: Array<ProjectionPlanGraphItem<TItem>>;
  hitTargets: Array<ProjectionPlanGraphItem<TItem>>;
  selectionOutlines: Array<ProjectionPlanGraphItem<TItem>>;
  dimensions: Array<ProjectionPlanGraphItem<TItem>>;
  dragPreview: Array<ProjectionPlanGraphItem<TItem>>;
  debug: Array<ProjectionPlanGraphItem<TItem>>;
  suppressed: TItem[];
};

export function topProjectionRole(shape: GeometryTopProjectionShape): TopProjectionRole {
  const role = shape.metadata?.topProjectionRole;
  return role === 'context' || role === 'hidden_from_top' || role === 'top_visible'
    ? role
    : 'top_visible';
}

export function topProjectionShapeVisible(
  shape: GeometryTopProjectionShape,
  visibility: DrawingWorkbenchVisibilityState,
): boolean {
  const role = topProjectionRole(shape);
  if (role === 'hidden_from_top') return false;
  if (shape.family === 'pergola') return visibility.pergolas;
  if (shape.family !== 'house') return true;
  if (shape.kind === 'deck') return visibility.decks;
  if (shape.kind === 'opening_marker' || shape.kind === 'opening_outline') return visibility.openings;
  return visibility.house;
}

export function topProjectionPlanLayer(shape: GeometryTopProjectionShape): ProjectionPlanLayer | null {
  const role = topProjectionRole(shape);
  if (role === 'hidden_from_top') return null;
  if (role === 'context') {
    if (shape.sourceType === 'reference_line' || shape.sourceType === 'house_line') return 'contextLines';
    if (shape.family === 'house' && (shape.kind === 'opening_marker' || shape.kind === 'opening_outline' || shape.kind === 'attachment_target')) {
      return 'contextLines';
    }
    return null;
  }
  if (shape.family === 'house') {
    if (shape.sourceType === 'house_reference' && shape.kind === 'footprint') {
      return 'hitTargets';
    }
    if (
      (shape.sourceType === 'house_surface_solid' || shape.sourceType === 'house_surface') &&
      (shape.kind === 'roof' || shape.kind === 'deck' || shape.kind === 'footprint')
    ) {
      return 'committedBodies';
    }
    if (shape.sourceType === 'house_roof_material' && shape.kind === 'house_roof_material') {
      return 'committedBodies';
    }
    if (shape.sourceType === 'house_line' || shape.sourceType === 'reference_line') return 'contextLines';
    if (
      (shape.sourceType === 'house_surface_solid' || shape.sourceType === 'house_surface') &&
      (shape.kind === 'fascia' ||
        shape.kind === 'soffit' ||
        shape.kind === 'attachment_zone' ||
        shape.kind === 'opening_marker' ||
        shape.kind === 'opening_outline')
    ) {
      return 'detailLines';
    }
    return null;
  }
  if (shape.family === 'reference') {
    return shape.sourceType === 'reference_line' ? 'contextLines' : null;
  }
  if (shape.family === 'pergola') {
    if (shape.sourceType === 'pergola_reference' && shape.kind === 'outline') {
      return 'committedBodies';
    }
    if (
      shape.sourceType === 'roof_plane' ||
      shape.sourceType === 'roof_cladding_panel' ||
      shape.sourceType === 'member_prism'
    ) {
      return 'committedBodies';
    }
    if (shape.sourceType === 'roof_flashing') return 'detailLines';
    return shape.sourceType === 'reference_line' ? 'contextLines' : null;
  }
  return null;
}

export function topProjectionShapeIsCommittedBody(shape: GeometryTopProjectionShape): boolean {
  return topProjectionPlanLayer(shape) === 'committedBodies';
}

export function topProjectionShapeAllowedInProjectionOnlyModel(shape: GeometryTopProjectionShape): boolean {
  if (topProjectionRole(shape) !== 'top_visible') return false;
  if (shape.family === 'house') {
    return shape.kind === 'roof' || shape.kind === 'deck' || shape.kind === 'footprint';
  }
  if (shape.family === 'pergola') {
    return shape.kind === 'roof_plane' || shape.kind === 'roof_cladding';
  }
  return false;
}

export function topProjectionContextLineAllowedInProjectionOnlyModel(shape: GeometryTopProjectionShape): boolean {
  if (topProjectionRole(shape) !== 'context') return false;
  if (shape.family !== 'house') return false;
  if (shape.sourceType === 'house_line') {
    return shape.kind === 'wall_segment' || shape.kind === 'attachment_target' || shape.kind === 'opening_outline';
  }
  return shape.kind === 'opening_marker';
}

export function topProjectionShapeVisualOwner(shape: GeometryTopProjectionShape): string {
  return planShapeVisualOwner(shape);
}

function withLayer<TItem extends { shape: GeometryTopProjectionShape }>(
  item: ProjectionPlanGraphItem<TItem>,
  layer: ProjectionPlanLayer,
): ProjectionPlanGraphItem<TItem> {
  return { ...item, layer };
}

export function buildProjectionPlanRenderGraph<TItem extends { shape: GeometryTopProjectionShape }>(
  items: readonly TItem[],
  options?: {
    projectionOnlyModelSpace?: boolean;
  },
): ProjectionPlanRenderGraph<TItem> {
  const baseGraph = items.reduce<ProjectionPlanRenderGraph<TItem>>(
    (graph, item) => {
      const layer = topProjectionPlanLayer(item.shape);
      if (layer === 'committedBodies') {
        graph.committedBodies.push({ ...item, layer });
      } else if (layer === 'contextLines') {
        graph.contextLines.push({ ...item, layer });
      } else if (layer === 'detailLines') {
        graph.detailLines.push({ ...item, layer });
      } else if (layer === 'hitTargets') {
        graph.hitTargets.push({ ...item, layer });
      } else {
        graph.suppressed.push(item);
      }
      return graph;
    },
    {
      committedBodies: [],
      contextLines: [],
      detailLines: [],
      hitTargets: [],
      selectionOutlines: [],
      dimensions: [],
      dragPreview: [],
      debug: [],
      suppressed: [],
    },
  );
  const visualStack = buildPlanCommittedBodyVisualStack({
    committedBodies: baseGraph.committedBodies,
    hitTargets: baseGraph.hitTargets,
    projectionOnlyModelSpace: options?.projectionOnlyModelSpace,
    topProjectionShapeAllowedInProjectionOnlyModel,
  });
  const committedBodies = visualStack.committedBodies;
  const hitTargets = [
    ...baseGraph.hitTargets,
    ...committedBodies
      .filter(({ shape }) => shape.sourceType !== 'house_reference' && planShapeIsPlanHitTarget(shape))
      .map((item) => withLayer(item, 'hitTargets')),
  ];
  const contextLines = options?.projectionOnlyModelSpace
    ? baseGraph.contextLines.filter(({ shape }) => topProjectionContextLineAllowedInProjectionOnlyModel(shape))
    : baseGraph.contextLines;
  const detailLines = options?.projectionOnlyModelSpace ? [] : baseGraph.detailLines;
  return {
    committedBodies,
    contextLines,
    detailLines,
    hitTargets,
    selectionOutlines: [],
    dimensions: [],
    dragPreview: [],
    debug: [],
    suppressed: [
      ...baseGraph.suppressed,
      ...visualStack.suppressedCommittedBodies,
      ...baseGraph.contextLines.filter((item) => !contextLines.includes(item)),
      ...(options?.projectionOnlyModelSpace ? baseGraph.detailLines : []),
    ],
  };
}
