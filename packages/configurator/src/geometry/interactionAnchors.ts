import type {
  Line3,
  PergolaInteractionAnchors,
  Vector3,
} from '@sp/geometry';
import type {
  CustomerEdgeIdV1,
  CustomerPergolaConfigurationV1,
} from '../core';

type CustomerPergolaIdV1 =
  CustomerPergolaConfigurationV1['intent']['pergola']['id'];

export type CustomerInteractionEdgeAnchorIdV1 =
  `${CustomerPergolaIdV1}:edge:${CustomerEdgeIdV1}`;

export type CustomerLightingRunAnchorIdV1 =
  `${CustomerPergolaIdV1}:lighting:${string}`;

export type CustomerInteractionEdgeAnchorV1 = {
  id: CustomerInteractionEdgeAnchorIdV1;
  edgeId: CustomerEdgeIdV1;
  centerline: Line3;
  outwardNormal: Vector3;
  bottomZ: number;
  topZ: number;
  hosted: boolean;
};

export type CustomerLightingRunAnchorV1 = {
  id: CustomerLightingRunAnchorIdV1;
  sourceRunId: string;
  centerline: Line3;
  kind: 'rafter' | 'perimeter';
};

export type CustomerInteractionAnchorsV1 = {
  pergolaId: CustomerPergolaIdV1;
  edges: CustomerInteractionEdgeAnchorV1[];
  lightingRuns: CustomerLightingRunAnchorV1[];
};

function cloneLine(line: Line3): Line3 {
  return {
    start: { ...line.start },
    end: { ...line.end },
  };
}

/**
 * Pair assembly-scoped physical anchors with stable public pergola semantics.
 * Runtime project and estimate identity deliberately never enter these IDs.
 */
export function mapPergolaInteractionAnchorsToCustomerV1(
  pergolaId: CustomerPergolaIdV1,
  anchors: PergolaInteractionAnchors,
): CustomerInteractionAnchorsV1 {
  return {
    pergolaId,
    edges: anchors.edges.map((edge) => ({
      id: `${pergolaId}:edge:${edge.id}`,
      edgeId: edge.id,
      centerline: cloneLine(edge.centerline),
      outwardNormal: { ...edge.outwardNormal },
      bottomZ: edge.bottomZ,
      topZ: edge.topZ,
      hosted: edge.hosted,
    })),
    lightingRuns: anchors.lightingRuns.map((run) => ({
      id: `${pergolaId}:lighting:${run.id}`,
      sourceRunId: run.id,
      centerline: cloneLine(run.centerline),
      kind: run.kind,
    })),
  };
}
