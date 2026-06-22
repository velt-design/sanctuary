import type {
  HouseAttachmentTarget3D,
  HouseRoofFeature3D,
  Line3,
  Plane3,
  Point3,
  RoofFlashing3D,
  RoofPlane3D,
} from '../contracts';
import { crossProduct, dotProduct, lineLength, normalizeVector, planeFromOriginAxes, scaleVector, subtractPoints } from '../math3d';
import {
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_GIRTH_MM,
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM,
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
  ROOF_JOIN_EPSILON_MM,
  ROOF_JOIN_FEATURE_MIN_LENGTH_MM,
  ROOF_REGION_MIN_AREA_MM2,
  WORLD_Z,
} from './constants';
import {
  finiteVectorLength,
  negateVector,
  point,
  polygonArea3D,
  translatePointByVector,
  type HouseRoofPerimeterEdge,
  type HouseRoofPerimeterEdgeKind,
} from './_internal';
import { roofPlanePerimeterOverlapSegment } from './perimeterEdges';
import {
  buildRoofSolidAdjacency,
  clipPolygon3DByScalar,
  polygonAveragePoint3D,
  roofPlaneTopNormal,
  roofSolidEdgeKey,
} from './roofSolids';

function isPerimeterFlashingEdge(edgeKind: HouseRoofPerimeterEdgeKind): boolean {
  return edgeKind === 'weather_flashed_edge' || edgeKind === 'house_apron_edge';
}

function buildHouseRoofFeatureFlashingWing(input: {
  flashingId: string;
  featureLine: Line3;
  roofPlane: RoofPlane3D;
}): RoofFlashing3D['wings'][number] | null {
  if (lineLength(input.featureLine) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;
  const topNormal = roofPlaneTopNormal(input.roofPlane);
  if (!topNormal || input.roofPlane.boundary.length < 3) return null;

  const featureDirection = normalizeVector(subtractPoints(input.featureLine.end, input.featureLine.start));
  if (finiteVectorLength(featureDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  let interiorDirection = normalizeVector(crossProduct(topNormal, featureDirection));
  if (finiteVectorLength(interiorDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  const centroidDistance = dotProduct(
    subtractPoints(polygonAveragePoint3D(input.roofPlane.boundary), input.featureLine.start),
    interiorDirection,
  );
  if (Math.abs(centroidDistance) <= ROOF_JOIN_EPSILON_MM) {
    const distances = input.roofPlane.boundary.map((candidate) =>
      dotProduct(subtractPoints(candidate, input.featureLine.start), interiorDirection),
    );
    const positiveMax = Math.max(...distances);
    const negativeMax = Math.max(...distances.map((distance) => -distance));
    if (negativeMax > positiveMax) interiorDirection = negateVector(interiorDirection);
  } else if (centroidDistance < 0) {
    interiorDirection = negateVector(interiorDirection);
  }

  const distanceFromFeature = (candidate: Point3) =>
    dotProduct(subtractPoints(candidate, input.featureLine.start), interiorDirection);
  const interiorSide = clipPolygon3DByScalar(
    input.roofPlane.boundary,
    (candidate) => -distanceFromFeature(candidate),
  );
  const strip = clipPolygon3DByScalar(
    interiorSide,
    (candidate) => distanceFromFeature(candidate) - DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
  );
  if (strip.length < 3 || polygonArea3D(strip) <= ROOF_REGION_MIN_AREA_MM2) return null;

  const surfaceOffset = scaleVector(topNormal, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM);
  const boundary = strip.map((candidate) => translatePointByVector(candidate, surfaceOffset));
  const plane = {
    ...input.roofPlane.plane,
    origin: translatePointByVector(input.roofPlane.plane.origin, surfaceOffset),
  };

  return {
    id: `${input.flashingId}-${input.roofPlane.id}-wing`,
    boundary,
    plane,
  };
}

export function buildHouseRoofFeatureFlashings(input: {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
}): RoofFlashing3D[] {
  const adjacency = buildRoofSolidAdjacency(input.roofPlanes);
  const flashings: RoofFlashing3D[] = [];

  for (const feature of input.roofFeatures) {
    if (feature.kind === 'gable_end_frame') continue;
    if (feature.metadata?.roofFeatureSource === 'reentrant_fallback') continue;
    const edgeReferences = adjacency.edgeMap.get(roofSolidEdgeKey(feature.line.start, feature.line.end)) ?? [];
    const uniqueRoofPlaneIndexes = new Set(edgeReferences.map((reference) => reference.roofPlaneIndex));
    if (edgeReferences.length !== 2 || uniqueRoofPlaneIndexes.size !== 2) continue;
    if (edgeReferences.some((reference) => adjacency.invalidRoofPlaneIndexes.has(reference.roofPlaneIndex))) continue;

    const flashingId = `house-roof-flashing-${feature.id}`;
    const wings = edgeReferences
      .map((reference) => {
        const roofPlane = input.roofPlanes[reference.roofPlaneIndex];
        return roofPlane
          ? buildHouseRoofFeatureFlashingWing({
              flashingId,
              featureLine: feature.line,
              roofPlane,
            })
          : null;
      })
      .filter((wing): wing is RoofFlashing3D['wings'][number] => wing !== null);

    if (wings.length !== 2) continue;
    flashings.push({
      id: flashingId,
      wings,
      thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
      metadata: {
        position: feature.kind,
        source: 'house_model',
        sourceFeatureId: feature.id,
        featureKind: feature.kind,
        girthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_GIRTH_MM,
        wingLengthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
        thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
        surfaceOffsetMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM,
        roofGeometry: typeof feature.metadata?.roofGeometry === 'string' ? feature.metadata.roofGeometry : null,
      },
    });
  }

  return flashings;
}

function attachmentTargetPlane(input: {
  attachmentTarget?: HouseAttachmentTarget3D | null;
}): Plane3 | null {
  const attachmentTarget = input.attachmentTarget;
  if (!attachmentTarget) return null;
  if (attachmentTarget.kind === 'zone') return attachmentTarget.zone?.plane ?? null;
  if (attachmentTarget.kind === 'plane') return attachmentTarget.plane ?? null;
  return null;
}

function buildPerimeterRoofFlashingWing(input: {
  flashingId: string;
  edge: HouseRoofPerimeterEdge;
  roofPlane: RoofPlane3D;
  featureLine: Line3;
}): RoofFlashing3D['wings'][number] | null {
  if (lineLength(input.featureLine) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;
  const topNormal = roofPlaneTopNormal(input.roofPlane);
  if (!topNormal || input.roofPlane.boundary.length < 3) return null;

  const featureDirection = normalizeVector(subtractPoints(input.featureLine.end, input.featureLine.start));
  if (finiteVectorLength(featureDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  let interiorDirection = normalizeVector(crossProduct(topNormal, featureDirection));
  if (finiteVectorLength(interiorDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  const centroidDistance = dotProduct(
    subtractPoints(polygonAveragePoint3D(input.roofPlane.boundary), input.featureLine.start),
    interiorDirection,
  );
  if (Math.abs(centroidDistance) <= ROOF_JOIN_EPSILON_MM) {
    const distances = input.roofPlane.boundary.map((candidate) =>
      dotProduct(subtractPoints(candidate, input.featureLine.start), interiorDirection),
    );
    const positiveMax = Math.max(...distances);
    const negativeMax = Math.max(...distances.map((distance) => -distance));
    if (negativeMax > positiveMax) interiorDirection = negateVector(interiorDirection);
  } else if (centroidDistance < 0) {
    interiorDirection = negateVector(interiorDirection);
  }

  const surfaceOffset = scaleVector(topNormal, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM);
  const inset = scaleVector(interiorDirection, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM);
  const boundary = [
    translatePointByVector(input.featureLine.start, surfaceOffset),
    translatePointByVector(input.featureLine.end, surfaceOffset),
    translatePointByVector(translatePointByVector(input.featureLine.end, inset), surfaceOffset),
    translatePointByVector(translatePointByVector(input.featureLine.start, inset), surfaceOffset),
  ];
  if (polygonArea3D(boundary) <= ROOF_REGION_MIN_AREA_MM2) return null;
  const plane = {
    ...input.roofPlane.plane,
    origin: translatePointByVector(input.roofPlane.plane.origin, surfaceOffset),
  };

  return {
    id: `${input.flashingId}-${input.roofPlane.id}-roof-wing`,
    boundary,
    plane,
  };
}

function buildPerimeterReturnFlashingWing(input: {
  flashingId: string;
  edge: HouseRoofPerimeterEdge;
  roofPlane: RoofPlane3D;
  attachmentTarget?: HouseAttachmentTarget3D | null;
  featureLine: Line3;
}): RoofFlashing3D['wings'][number] | null {
  if (lineLength(input.featureLine) <= ROOF_JOIN_FEATURE_MIN_LENGTH_MM) return null;

  const roofOffsetNormal = roofPlaneTopNormal(input.roofPlane);
  const roofOffset =
    roofOffsetNormal
      ? scaleVector(roofOffsetNormal, DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM)
      : { x: 0, y: 0, z: 0 };
  const topStart = translatePointByVector(input.featureLine.start, roofOffset);
  const topEnd = translatePointByVector(input.featureLine.end, roofOffset);

  if (input.edge.edgeKind === 'house_apron_edge') {
    const wallPlane = attachmentTargetPlane({ attachmentTarget: input.attachmentTarget });
    if (wallPlane) {
      const boundary = [
        input.featureLine.start,
        input.featureLine.end,
        point(
          input.featureLine.end.x,
          input.featureLine.end.y,
          input.featureLine.end.z + DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
        ),
        point(
          input.featureLine.start.x,
          input.featureLine.start.y,
          input.featureLine.start.z + DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
        ),
      ];
      if (polygonArea3D(boundary) <= ROOF_REGION_MIN_AREA_MM2) return null;
      return {
        id: `${input.flashingId}-${input.roofPlane.id}-apron-wing`,
        boundary,
        plane: wallPlane,
      };
    }
  }

  const featureDirection = normalizeVector(subtractPoints(input.featureLine.end, input.featureLine.start));
  if (finiteVectorLength(featureDirection) <= ROOF_JOIN_EPSILON_MM) return null;

  const boundary = [
    topStart,
    topEnd,
    point(topEnd.x, topEnd.y, topEnd.z - DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM),
    point(topStart.x, topStart.y, topStart.z - DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM),
  ];
  if (polygonArea3D(boundary) <= ROOF_REGION_MIN_AREA_MM2) return null;

  return {
    id: `${input.flashingId}-${input.roofPlane.id}-return-wing`,
    boundary,
    plane: planeFromOriginAxes(topStart, featureDirection, WORLD_Z),
  };
}

export function buildPerimeterFlashings(input: {
  perimeterEdges: HouseRoofPerimeterEdge[];
  roofPlanes: RoofPlane3D[];
  attachmentTarget?: HouseAttachmentTarget3D | null;
}): RoofFlashing3D[] {
  return input.perimeterEdges.flatMap((edge) => {
    if (!isPerimeterFlashingEdge(edge.edgeKind)) return [];
    return input.roofPlanes.flatMap((roofPlane) => {
      const featureLine = roofPlanePerimeterOverlapSegment(roofPlane, edge);
      if (!featureLine) return [];

      const flashingId = `house-roof-flashing-${edge.sourceEdgeId}-${roofPlane.id}`;
      const roofWing = buildPerimeterRoofFlashingWing({
        flashingId,
        edge,
        roofPlane,
        featureLine,
      });
      const returnWing = buildPerimeterReturnFlashingWing({
        flashingId,
        edge,
        roofPlane,
        attachmentTarget: input.attachmentTarget,
        featureLine,
      });
      const wings = [roofWing, returnWing].filter(
        (wing): wing is RoofFlashing3D['wings'][number] => wing !== null,
      );
      if (wings.length !== 2) return [];

      return [{
        id: flashingId,
        wings,
        thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
        metadata: {
          position: edge.flashingRole ?? null,
          source: 'house_model',
          sourceEdgeId: edge.sourceEdgeId,
          sourceRoofPlaneId: roofPlane.id,
          featureKind: null,
          girthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_GIRTH_MM,
          wingLengthMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
          thicknessMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
          surfaceOffsetMm: DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM,
          roofGeometry:
            typeof roofPlane.metadata?.roofGeometry === 'string' ? roofPlane.metadata.roofGeometry : null,
          houseRoofPerimeterRole: edge.edgeKind,
          flashingRole: edge.flashingRole ?? null,
          flashingTreatment: 'house_perimeter_folded',
        },
      }];
    });
  });
}
