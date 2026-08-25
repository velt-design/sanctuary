import { useMemo } from "react";
import * as THREE from "three";
import type { ViewerSceneHouseSurfaceSolidObject } from "@sp/geometry";
import {
  buildPolygonGeometry,
  buildPolygonSlabGeometry,
  buildRenderMeshGeometry,
  offsetPolygon,
} from "../../three";
import {
  buildDeckGrooveLines,
  resolveDeckMaterial,
  resolveDeckPalette,
} from "../../three";
import {
  buildClosedLineGeometry,
  buildLineGeometry,
  emptyGeometry,
} from "../../three";

/**
 * Solid house-surface renderer — covers roofs, walls (including the
 * gable triangles emitted by the open-gable mesh builder), and decks.
 * Geometry prefers the precomputed `renderMesh` and falls back to
 * extruding the boundary polygon by `thicknessMm` via
 * `buildPolygonSlabGeometry`. The fallback path matters specifically
 * for walls: an earlier version drew a flat `buildPolygonGeometry`
 * which ignored thickness and read visually inconsistently against
 * roof solids.
 *
 * Decks (`object.kind === "deck"`) get a layered look: a base slab
 * mesh + a slightly-offset top mesh in the palette colour + an
 * outline ring + optional groove lines (timber/composite only,
 * concrete skips grooves). Selection swaps the top + outline to the
 * palette's selected blue; hover (without selection) boosts opacity
 * for the same "under interest" affordance without competing with
 * the selection styling.
 *
 * 3D occlusion of the deck interior against the house bounds is NOT
 * yet shipped — see the inline notes in the previous viewport: a
 * depth-write attempt made the whole 3D viewport read as opaque
 * because the same depth values occluded pergola elements visible
 * through transparent walls. Until either a polygon-clip pre-process
 * or a stencil pass lands, the deck floor renders through the walls.
 */
export function HouseSurfaceSolidObject({
  object,
  color,
  selected,
  hovered,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneHouseSurfaceSolidObject;
  color: string;
  selected: boolean;
  /**
   * Cross-viewport hover state (milestone 16). When true and `selected` is
   * false, the deck renders a lighter highlight (boosted top opacity +
   * outline emphasis) so the user sees the same deck "under interest" in
   * 3D when their pointer is on the matching plan shape. We deliberately
   * skip the highlight when `selected` -- the selection styling already
   * dominates and adding hover on top would muddy the visual.
   */
  hovered: boolean;
  onSelect: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(
    () =>
      buildRenderMeshGeometry(object.renderMesh) ??
      buildPolygonSlabGeometry(object.boundary, object.plane, object.thicknessMm),
    [object.boundary, object.plane, object.renderMesh, object.thicknessMm],
  );
  // PR-HR3 (2026-06-18): roof solids stamped as diagnostic by
  // `viewer.ts` (when `roofQaStatus === "invalid"`) render with a
  // warning tint instead of the layer colour, so a designer can
  // see the solver's best-effort surface AND know it didn't pass
  // QA. The tint reuses the workbench's existing diagnostic
  // vocabulary (warm red-orange, slightly higher transparency).
  const metadataBag = (object as { metadata?: Record<string, unknown> }).metadata ?? null;
  const isDiagnosticRoof =
    object.kind === "roof" &&
    typeof metadataBag?.houseRoofRenderRole === "string" &&
    metadataBag.houseRoofRenderRole === "diagnostic";
  const opacity = isDiagnosticRoof
    ? 0.42
    : object.kind === "roof"
      ? 0.62
      : object.kind === "wall"
        ? 0.58
        : 0.72;
  const diagnosticTint = "#d97706"; // amber-600 — matches RoofValidationPanel approximate styling
  const materialSide =
    object.kind === "wall" ? THREE.FrontSide : THREE.DoubleSide;
  const isDeck = object.kind === "deck";
  const deckMaterial = isDeck ? resolveDeckMaterial(object) : null;
  const deckPalette = isDeck && deckMaterial ? resolveDeckPalette(deckMaterial) : null;
  const deckHoverActive = isDeck && hovered && !selected;
  const bodyOpacity = isDeck
    ? selected
      ? 0.82
      : deckHoverActive
        ? 0.6
        : 0.4
    : opacity;
  const topOpacity = isDeck
    ? selected
      ? 0.98
      : deckHoverActive
        ? 0.88
        : 0.74
    : opacity;
  const outlineOpacity = isDeck
    ? selected
      ? 1
      : deckHoverActive
        ? 0.85
        : 0.58
    : 1;
  const grooveOpacity = isDeck ? (selected ? 0.8 : deckHoverActive ? 0.55 : 0.32) : 1;
  const topBoundary = useMemo(() => {
    if (!isDeck) return [];
    return offsetPolygon(object.boundary, object.plane.normal, 1.5);
  }, [isDeck, object.boundary, object.plane.normal]);
  const topGeometry = useMemo(
    () => (topBoundary.length ? buildPolygonGeometry(topBoundary) : emptyGeometry()),
    [topBoundary],
  );
  const outlineGeometry = useMemo(
    () => (isDeck ? buildClosedLineGeometry(offsetPolygon(object.boundary, object.plane.normal, 3)) : emptyGeometry()),
    [isDeck, object.boundary, object.plane.normal],
  );
  const selectedOutlineGeometry = useMemo(
    () =>
      isDeck && selected
        ? buildClosedLineGeometry(offsetPolygon(object.boundary, object.plane.normal, 6))
        : emptyGeometry(),
    [isDeck, object.boundary, object.plane.normal, selected],
  );
  const deckGrooveLines = useMemo(() => (isDeck ? buildDeckGrooveLines(object) : []), [isDeck, object]);
  const deckGrooveGeometries = useMemo(
    () =>
      deckGrooveLines.map((line) => ({
        id: line.id,
        geometry: buildLineGeometry([line.start, line.end]),
      })),
    [deckGrooveLines],
  );

  return (
    <group
      data-testid={`scene-object-${(object as { sourceId?: string }).sourceId ?? object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHoverEnter(object.id);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHoverLeave(object.id);
      }}
    >
      <mesh>
        <primitive attach="geometry" object={geometry} />
        <meshStandardMaterial
          color={isDiagnosticRoof ? diagnosticTint : (deckPalette?.baseColor ?? color)}
          transparent
          opacity={bodyOpacity}
          depthWrite={false}
          side={materialSide}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
      {isDeck ? (
        <>
          <mesh>
            <primitive attach="geometry" object={topGeometry} />
            <meshStandardMaterial
              color={selected ? deckPalette?.selectedColor ?? color : deckPalette?.topColor ?? color}
              transparent
              opacity={topOpacity}
              depthWrite={false}
              side={THREE.DoubleSide}
              clippingPlanes={clippingPlanes}
            />
          </mesh>
          <line data-testid={`scene-object-${(object as { sourceId?: string }).sourceId ?? object.id}-deck-outline`}>
            <primitive attach="geometry" object={outlineGeometry} />
            <lineBasicMaterial
              color={selected ? deckPalette?.selectedColor ?? "#2f6f96" : deckPalette?.outlineColor ?? color}
              transparent
              opacity={outlineOpacity}
              clippingPlanes={clippingPlanes}
            />
          </line>
          {deckGrooveGeometries.length ? (
            <group data-testid={`scene-object-${(object as { sourceId?: string }).sourceId ?? object.id}-deck-grooves`}>
              {deckGrooveGeometries.map((line) => (
                <line key={line.id}>
                  <primitive attach="geometry" object={line.geometry} />
                  <lineBasicMaterial
                    color={deckPalette?.grooveColor ?? color}
                    transparent
                    opacity={grooveOpacity}
                    clippingPlanes={clippingPlanes}
                  />
                </line>
              ))}
            </group>
          ) : null}
          {selected ? (
            <line data-testid={`scene-object-${(object as { sourceId?: string }).sourceId ?? object.id}-deck-outline-selected`}>
              <primitive attach="geometry" object={selectedOutlineGeometry} />
              <lineBasicMaterial color={deckPalette?.selectedColor ?? "#2f6f96"} clippingPlanes={clippingPlanes} />
            </line>
          ) : null}
        </>
      ) : null}
    </group>
  );
}
