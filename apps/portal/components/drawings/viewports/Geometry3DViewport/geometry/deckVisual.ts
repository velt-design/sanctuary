import * as THREE from "three";
import type {
  Point3,
  ViewerSceneHouseSurfaceSolidObject,
} from "@sp/geometry";
import { vectorFromPoint } from "./lineBuilders";
import { centroid } from "./scenePointHelpers";
import { normalizeNonZeroVector } from "./buildGeometries";

/**
 * Deck-surface visual helpers: material classification, palette
 * selection, frame derivation, and groove-line emission. Keeps the
 * deck-specific look (timber boards vs. composite vs. concrete) out of
 * the larger `buildGeometries` module so each renderer reaches for
 * exactly the helper it needs without dragging the rest of the
 * THREE-side math into scope.
 *
 * `metadataStringValue`/`metadataNumberValue` are deck-typed because
 * `ViewerSceneHouseSurfaceSolidObject["metadata"]` is its own metadata
 * shape; the generic `numericMetadataValue` for member metadata lives
 * in `buildGeometries.ts`.
 */

type DeckMaterialKey = "timber_decking" | "composite" | "concrete";

function metadataStringValue(
  metadata: ViewerSceneHouseSurfaceSolidObject["metadata"] | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function metadataNumberValue(
  metadata: ViewerSceneHouseSurfaceSolidObject["metadata"] | undefined,
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function resolveDeckMaterial(
  object: ViewerSceneHouseSurfaceSolidObject,
): DeckMaterialKey {
  const material = metadataStringValue(object.metadata, "deckSurfaceMaterial");
  if (material === "composite" || material === "concrete") return material;
  return "timber_decking";
}

export function resolveDeckPalette(material: DeckMaterialKey) {
  if (material === "composite") {
    return {
      topColor: "#a8b095",
      baseColor: "#7f8672",
      grooveColor: "#68705f",
      outlineColor: "#56604f",
      selectedColor: "#2f6f96",
    };
  }
  if (material === "concrete") {
    return {
      topColor: "#b7b9bc",
      baseColor: "#94979b",
      grooveColor: "#8e9296",
      outlineColor: "#6e7276",
      selectedColor: "#2f6f96",
    };
  }
  return {
    topColor: "#c8bc7b",
    baseColor: "#9c8e58",
    grooveColor: "#8a7b45",
    outlineColor: "#776a3a",
    selectedColor: "#2f6f96",
  };
}

function buildDeckVisualFrame(
  object: ViewerSceneHouseSurfaceSolidObject,
): {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  widthDir: THREE.Vector3;
  depthDir: THREE.Vector3;
  minWidth: number;
  maxWidth: number;
  minDepth: number;
  maxDepth: number;
} | null {
  if (object.boundary.length < 4) return null;
  const widthMm = metadataNumberValue(object.metadata, "deckPresetRectWidthMm");
  if (widthMm === null || widthMm <= 0) return null;
  const normal = normalizeNonZeroVector(vectorFromPoint(object.plane.normal));
  if (!normal) return null;
  const centerPoint = centroid(object.boundary);
  const center = vectorFromPoint(centerPoint);
  const edges = object.boundary.map((point, index) => {
    const next = object.boundary[(index + 1) % object.boundary.length]!;
    const vector = new THREE.Vector3(next.x - point.x, next.y - point.y, next.z - point.z);
    return {
      length: vector.length(),
      direction: normalizeNonZeroVector(vector),
    };
  });
  const widthEdge = edges
    .filter((edge): edge is { length: number; direction: THREE.Vector3 } => Boolean(edge.direction))
    .sort((left, right) => Math.abs(left.length - widthMm) - Math.abs(right.length - widthMm))[0];
  if (!widthEdge) return null;
  const widthDir = widthEdge.direction;
  const depthDir = normalizeNonZeroVector(new THREE.Vector3().crossVectors(normal, widthDir));
  if (!depthDir) return null;

  const projected = object.boundary.map((point) => {
    const relative = new THREE.Vector3(point.x - center.x, point.y - center.y, point.z - center.z);
    return {
      width: relative.dot(widthDir),
      depth: relative.dot(depthDir),
    };
  });
  return {
    center,
    normal,
    widthDir,
    depthDir,
    minWidth: Math.min(...projected.map((point) => point.width)),
    maxWidth: Math.max(...projected.map((point) => point.width)),
    minDepth: Math.min(...projected.map((point) => point.depth)),
    maxDepth: Math.max(...projected.map((point) => point.depth)),
  };
}

export function buildDeckGrooveLines(
  object: ViewerSceneHouseSurfaceSolidObject,
): Array<{ id: string; start: Point3; end: Point3 }> {
  const material = resolveDeckMaterial(object);
  if (material === "concrete") return [];
  const frame = buildDeckVisualFrame(object);
  if (!frame) return [];
  const spacingMm = material === "composite" ? 160 : 140;
  const usableDepth = frame.maxDepth - frame.minDepth;
  if (usableDepth <= spacingMm * 1.25) return [];
  const insetMm = 24;
  const lines: Array<{ id: string; start: Point3; end: Point3 }> = [];
  let index = 0;
  for (
    let depth = frame.minDepth + spacingMm;
    depth <= frame.maxDepth - spacingMm * 0.5;
    depth += spacingMm
  ) {
    index += 1;
    const start = frame.center
      .clone()
      .addScaledVector(frame.widthDir, frame.minWidth + insetMm)
      .addScaledVector(frame.depthDir, depth)
      .addScaledVector(frame.normal, 2);
    const end = frame.center
      .clone()
      .addScaledVector(frame.widthDir, frame.maxWidth - insetMm)
      .addScaledVector(frame.depthDir, depth)
      .addScaledVector(frame.normal, 2);
    lines.push({
      id: `${object.id}-deck-groove-${index}`,
      start: { x: start.x, y: start.y, z: start.z },
      end: { x: end.x, y: end.y, z: end.z },
    });
  }
  return lines;
}
