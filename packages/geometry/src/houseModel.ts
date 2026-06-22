import type {
  GeometryConfig,
  GeometryMetadata,
  HouseDeck3D,
  HouseAttachmentTarget3D,
  HouseModel3D,
  HouseReferenceGeometry,
  HouseRoofFeature3D,
  HouseRoofForm,
  HouseWallSegment3D,
  Line3,
  Plane3,
  Polygon3,
  RoofPlane3D,
} from "./contracts";
import type { HouseModel3DRawHouseInput } from "./houseModelRawInputAdapter";
import { buildHouseModel3DGeometryConfigInputFromRawHouseInput } from "./houseModelRawInputAdapter";
import { normalizeHouseRoofPitchDegForForm } from "./houseRoofValidation";
import {
  planeFromOriginAxes,
} from "./math3d";
import {
  DEFAULT_EAVE_HEIGHT_MM,
  DEFAULT_EAVE_OVERHANG_MM,
  DEFAULT_FASCIA_HEIGHT_MM,
  DEFAULT_GUTTER_DEPTH_MM,
  DEFAULT_GUTTER_PROJECTION_MM,
  DEFAULT_GUTTER_WIDTH_MM,
  DEFAULT_ROOF_PITCH_DEG,
  DEFAULT_SOFFIT_DEPTH_MM,
} from "./house/constants";
import {
  boundingBox,
  finiteNumber,
  point,
  positiveNumber,
  type HouseRoofPerimeterEdge,
} from "./house/_internal";
import { buildHouseRoofPerimeterEdges } from "./house/perimeterEdges";
import { buildWallSegments, wallBoundaryHasFlatTop } from "./house/walls";
import { deriveHouseGableTerminalEndsFromFootprint } from "./house/roofJoined";
import {
  buildPolygonFasciaPolygons,
  buildPolygonGutterBoundaries,
  buildPolygonGutterLines,
  buildPolygonSoffitPolygons,
} from "./house/eave";
import { buildSharedHouseRoof } from "./house/sharedHouseRoof";
import {
  buildHouseRoofFeatureFlashings,
  buildPerimeterFlashings,
} from "./house/roofFlashings";
import {
  buildHouseDecks,
  resolveHouseDeckBoundary,
} from "./house/decks";
import { buildOpenGableFrameFeatures } from "./house/roofFrames";
import {
  buildAttachmentAwareMonoEavePolygon,
  buildAttachmentTarget,
  buildSemanticHouseAttachmentEdge,
} from "./house/attachment";
import { buildHouseEnvelopeSolids } from "./house/envelopeSolids";
import {
  canonicalizeHouseFootprintPolygon,
  isOrthogonalFootprint,
  isRectanglePolygon,
  offsetFootprintPolygon,
} from "./house/footprintMath";
import { buildHouseOpenings } from "./house/openings";
import { buildHippedRoofWithEaveOffsetRepair } from "./house/eaveOffsetRepair";
import { buildOrthogonalCellUnionEaveOffset } from "./house/orthogonalEaveOffset";

// PR-T8 (2026-05-29): `deriveHouseRoofAppendageSupportFromFootprint` was
// the public entry point for the inspector to ask "is appendage
// supported on this footprint?" before showing the editor. Removed with
// the rest of the appendage feature.

/**
 * PR-SS-6 (2026-06-21): the canonical "roof planes -> 3D roof artifacts"
 * derivation — perimeter edges, gutter / fascia / soffit geometry,
 * flashings, roof-material visuals, eave snap targets, and the extruded
 * envelope solids (walls + roof + decks + eave trim). Extracted verbatim
 * from `buildHouseModel3D` so the composition-roof swap
 * (`swapRoofFromComposition`) can rebuild the SAME artifacts from
 * skeleton roof planes instead of re-implementing the sequence (which
 * would drift from this one over time).
 *
 * `roofPlanesForSolids` and `roofFlashings` are
 * gated on `roof.metadata.roofQaStatus`: a roof that failed QA still
 * contributes perimeter / eave geometry but no solid bodies or flashings
 * — matching the original inline behaviour.
 *
 * Eave overhang: the caller decides. `buildHouseModel3D` passes the
 * overhang-offset eave polygon; the composition swap passes the union
 * footprint as both `footprint` and `eavePolygon` because the
 * orthogonal straight skeleton builds eave nodes at the polygon corners
 * (no overhang yet — a separate followup).
 */
export function buildHouseRoofEnvelopeArtifacts(input: {
  footprint: Polygon3;
  eavePolygon: Polygon3;
  roofForm: HouseRoofForm;
  roof: {
    roofPlanes: RoofPlane3D[];
    roofFeatures: HouseRoofFeature3D[];
    metadata: GeometryMetadata;
  };
  eaveHeightMm: number;
  wallSegments: HouseWallSegment3D[];
  decks: HouseDeck3D[];
  attachmentTarget: HouseAttachmentTarget3D;
  joinSourceEdgeId: string | null;
  soffitDepthMm: number;
  fasciaHeightMm: number;
  gutterWidthMm: number;
  gutterDepthMm: number;
  gutterProjectionMm: number;
  eaveOverhangMm: number;
}): {
  perimeterEdges: HouseRoofPerimeterEdge[];
  solids: NonNullable<HouseModel3D["solids"]>;
  eave: HouseModel3D["eave"];
  roofFlashings: HouseModel3D["roofFlashings"];
  roofEaves: HouseModel3D["roofEaves"];
} {
  const { roof } = input;
  const perimeterEdges = buildHouseRoofPerimeterEdges({
    footprint: input.footprint,
    eavePolygon: input.eavePolygon,
    roofForm: input.roofForm,
    roofPlanes: roof.roofPlanes,
    eaveHeightMm: input.eaveHeightMm,
    joinSourceEdgeId: input.joinSourceEdgeId,
  });
  const gutterLines = buildPolygonGutterLines({ perimeterEdges });
  const gutterBoundaries = buildPolygonGutterBoundaries({
    perimeterEdges,
    gutterWidthMm: input.gutterWidthMm,
    gutterProjectionMm: input.gutterProjectionMm,
  });
  const fasciaPolygons = buildPolygonFasciaPolygons({
    perimeterEdges,
    fasciaHeightMm: input.fasciaHeightMm,
  });
  const soffitPolygons = buildPolygonSoffitPolygons({
    perimeterEdges,
    roofForm: input.roofForm,
    roofPlanes: roof.roofPlanes,
  });
  const roofPlanesForSolids =
    roof.metadata.roofQaStatus === "valid" ? roof.roofPlanes : [];
  const roofFlashings =
    roof.metadata.roofQaStatus === "valid"
      ? [
          ...buildHouseRoofFeatureFlashings({
            roofPlanes: roof.roofPlanes,
            roofFeatures: roof.roofFeatures,
          }),
          ...buildPerimeterFlashings({
            perimeterEdges: perimeterEdges,
            roofPlanes: roof.roofPlanes,
            attachmentTarget: input.attachmentTarget,
          }),
        ]
      : [];
  const roofEaves = perimeterEdges
    .filter(
      (edge) =>
        edge.edgeKind === "drain_eave" ||
        edge.edgeKind === "weather_flashed_edge" ||
        edge.edgeKind === "house_apron_edge",
    )
    .map((edge) => ({
      id: `roof-eave-${edge.sourceEdgeId}`,
      edgeKind: edge.edgeKind,
      eaveLine: { start: edge.eaveStart, end: edge.eaveEnd },
      sourceEdgeId: edge.sourceEdgeId,
      sourceRoofPlaneId: edge.sourceRoofPlaneId ?? null,
    }));
  const solids = buildHouseEnvelopeSolids({
    wallSegments: input.wallSegments,
    roofPlanes: roofPlanesForSolids,
    roofForm: input.roofForm,
    decks: input.decks,
    perimeterEdges: perimeterEdges,
    soffitPolygons,
    fasciaPolygons,
    gutterLines,
    gutterBoundaries,
    gutterWidthMm: input.gutterWidthMm,
    gutterDepthMm: input.gutterDepthMm,
  });
  const eave = {
    soffitDepthMm: input.soffitDepthMm,
    fasciaHeightMm: input.fasciaHeightMm,
    gutterWidthMm: input.gutterWidthMm,
    gutterDepthMm: input.gutterDepthMm,
    gutterProjectionMm: input.gutterProjectionMm,
    eaveOverhangMm: input.eaveOverhangMm,
    gutterLines: gutterLines.map((candidate) => candidate.line),
    gutterBoundaries: gutterBoundaries.map((candidate) => candidate.boundary),
    fasciaPolygons: fasciaPolygons.map((candidate) => candidate.boundary),
    soffitPolygons: soffitPolygons.map((candidate) => candidate.boundary),
    metadata: roof.metadata,
  };
  return {
    perimeterEdges,
    solids,
    eave,
    roofFlashings,
    roofEaves,
  };
}

export function buildHouseModel3D(input: {
  /**
   * Source house form id. Stamped onto the returned `HouseModel3D.houseId`
   * so the scene-assembly seam can prefix derived scene-object ids by
   * source house. Required even for single-house scenes — tests pass a
   * stable literal (e.g. `'test-house'`) so multi-house regressions trip
   * the scene-id invariant test rather than slipping through.
   */
  houseId: string;
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
}): HouseModel3D | null {
  // Freestanding house forms get a full 3D model (walls + roof + envelope)
  // because project-level scenes render house forms independently of pergola
  // attachment. The pergola-dependent helpers downstream
  // (`buildSemanticHouseAttachmentEdge`, `buildAttachmentTarget`) are already
  // null-safe for freestanding: the resulting `attachmentTarget` is
  // `{ kind: 'none' }`, which is correct.
  const model = input.config.houseContext.model;
  const rawFootprint = model?.footprint;
  if (!rawFootprint || rawFootprint.length < 3) return null;
  const canonicalizedFootprint =
    canonicalizeHouseFootprintPolygon(rawFootprint);
  const footprint = canonicalizedFootprint.footprint;
  if (footprint.length < 3) return null;
  const footprintCanonicalizationMetadata: GeometryMetadata =
    canonicalizedFootprint.status === "canonicalized"
      ? {
          footprintCanonicalizationStatus: canonicalizedFootprint.status,
          footprintCanonicalizationPrecisionMm:
            canonicalizedFootprint.precisionMm,
          footprintCanonicalizationPointCountBefore:
            canonicalizedFootprint.pointCountBefore,
          footprintCanonicalizationPointCountAfter:
            canonicalizedFootprint.pointCountAfter,
        }
      : {};

  const eaveHeightMm = finiteNumber(
    model.eaveHeightMm,
    input.config.structural.heights.referenceUndersideMm ??
      input.config.structural.heights.houseUndersideMm ??
      DEFAULT_EAVE_HEIGHT_MM,
  );
  const wallHeightMm = finiteNumber(model.wallHeightMm, eaveHeightMm);
  const roofForm = model.roofForm ?? "hipped";
  const roofPitchDeg = normalizeHouseRoofPitchDegForForm({
    roofForm,
    pitchDeg: finiteNumber(model.roofPitchDeg, DEFAULT_ROOF_PITCH_DEG),
    fallbackPitchDeg: DEFAULT_ROOF_PITCH_DEG,
  });
  const soffitDepthMm = positiveNumber(
    model.eave?.soffitDepthMm,
    DEFAULT_SOFFIT_DEPTH_MM,
  );
  const fasciaHeightMm = positiveNumber(
    model.eave?.fasciaHeightMm,
    DEFAULT_FASCIA_HEIGHT_MM,
  );
  const gutterWidthMm = positiveNumber(
    model.eave?.gutterWidthMm,
    DEFAULT_GUTTER_WIDTH_MM,
  );
  const gutterDepthMm = positiveNumber(
    model.eave?.gutterDepthMm,
    DEFAULT_GUTTER_DEPTH_MM,
  );
  const gutterProjectionMm = positiveNumber(
    model.eave?.gutterProjectionMm,
    DEFAULT_GUTTER_PROJECTION_MM,
  );
  const eaveOverhangMm = positiveNumber(
    model.eave?.eaveOverhangMm,
    DEFAULT_EAVE_OVERHANG_MM,
  );
  const roofPrimaryFallDirection =
    model.roofPrimaryFallDirection ?? "positive_y";
  const roofRidgeAxis = model.roofRidgeAxis ?? "x";
  const semanticAttachmentEdge = buildSemanticHouseAttachmentEdge(
    input.config,
    input.attachmentEdge,
  );
  const preliminaryWallSegments = buildWallSegments(
    footprint,
    wallHeightMm,
    null,
  );
  const preliminaryAttachmentTarget = buildAttachmentTarget({
    config: input.config,
    attachmentEdge: semanticAttachmentEdge,
    wallSegments: preliminaryWallSegments,
    eaveHeightMm,
    fasciaHeightMm,
  });
  // PR-T8 (2026-05-29): renamed from `appendageJoinSourceEdgeId`. The
  // value itself is the attachment target's source edge id — the
  // mono-eave builder still needs it to know where the pergola joins,
  // independent of any appendage feature.
  const attachmentJoinSourceEdgeId =
    preliminaryAttachmentTarget.kind === "zone" &&
    preliminaryAttachmentTarget.line
      ? (preliminaryAttachmentTarget.sourceEdgeId ?? null)
      : null;
  const hippedCustomEaveOffset =
    roofForm === "hipped" &&
    !isRectanglePolygon(footprint) &&
    isOrthogonalFootprint(footprint)
      ? buildOrthogonalCellUnionEaveOffset({
          footprint,
          offsetMm: eaveOverhangMm,
        })
      : null;
  const wallBox = boundingBox(footprint);
  const legacyBaseEavePolygon = offsetFootprintPolygon(footprint, eaveOverhangMm);
  const baseEavePolygon = legacyBaseEavePolygon ?? [
    point(wallBox.minX - eaveOverhangMm, wallBox.minY - eaveOverhangMm, 0),
    point(wallBox.maxX + eaveOverhangMm, wallBox.minY - eaveOverhangMm, 0),
    point(wallBox.maxX + eaveOverhangMm, wallBox.maxY + eaveOverhangMm, 0),
    point(wallBox.minX - eaveOverhangMm, wallBox.maxY + eaveOverhangMm, 0),
  ];
  const eavePolygon = buildAttachmentAwareMonoEavePolygon({
    footprint,
    eavePolygon: baseEavePolygon,
    roofForm,
    attachmentSourceEdgeId: attachmentJoinSourceEdgeId,
  });
  // Resolve which terminal ends are open BEFORE building the roof, so
  // the unified `buildRectangularRoof` (called inside the hipped path
  // for rectangle footprints) can apply per-end caps. Filter to ids that
  // actually exist for the resolved ridge axis -- ignoring stale ids
  // from a different orientation. Honoured for both `gable` and
  // `hipped` forms (milestone 13 phase A); `hipped` + ids = Dutch-hip.
  const availableTerminalEnds = deriveHouseGableTerminalEndsFromFootprint({
    footprint,
    ridgeAxis: roofRidgeAxis,
  });
  const requestedOpenTerminalEndIds = new Set(
    roofForm === "hipped"
      ? (model.openGableEndIds ?? []).filter((id) =>
          availableTerminalEnds.some((terminalEnd) => terminalEnd.id === id),
        )
      : [],
  );

  const roofBuild =
    roofForm === "hipped"
      ? buildHippedRoofWithEaveOffsetRepair({
          footprint,
          requestedEaveOverhangMm: eaveOverhangMm,
          initialEavePolygon: eavePolygon,
          topologyAwareEavePolygon: hippedCustomEaveOffset?.polygon,
          topologyAwareEaveMetadata: hippedCustomEaveOffset?.metadata,
          buildRoof: (candidate) =>
            buildSharedHouseRoof({
              sourceFootprint: candidate.sourceFootprint,
              eavePolygon: candidate.eavePolygon,
              eaveHeightMm,
              roofPitchDeg,
              roofForm,
              roofPrimaryFallDirection,
              roofRidgeAxis,
              openTerminalEndIds: [...requestedOpenTerminalEndIds],
            }),
        })
      : {
          roof: buildSharedHouseRoof({
            sourceFootprint: footprint,
            eavePolygon,
            eaveHeightMm,
            roofPitchDeg,
            roofForm,
            roofPrimaryFallDirection,
            roofRidgeAxis,
            openTerminalEndIds: [...requestedOpenTerminalEndIds],
          }),
          eavePolygon,
          sourceFootprint: footprint,
        };
  const roof = roofBuild.roof;
  const effectiveEavePolygon = roofBuild.eavePolygon;
  const effectiveRoofFootprint = roofBuild.sourceFootprint;
  const wallSegments = buildWallSegments(footprint, wallHeightMm, roof);
  const openTerminalEndIds = new Set(
    roof.metadata.roofQaStatus === "valid" ? requestedOpenTerminalEndIds : [],
  );
  const terminalEndBySourceEdgeId = new Map(
    availableTerminalEnds.map((terminalEnd) => [
      terminalEnd.sourceEdgeId,
      terminalEnd,
    ]),
  );
  // Locate the ridge feature so we can read its height when reshaping
  // open-gable end walls. The unified rectangular roof builder always emits
  // a single ridge feature with `kind: 'ridge'`; its endpoints sit at the
  // ridge apex height. We only need the z component here — the apex's
  // x/y come from the wall's own eave midpoint.
  const ridgeFeature = roof.roofFeatures.find(
    (feature) => feature.kind === "ridge",
  );
  const ridgeZ = ridgeFeature ? ridgeFeature.line.start.z : null;

  const displayWallSegments = wallSegments.map((segment) => {
    const terminalEnd = segment.sourceEdgeId
      ? terminalEndBySourceEdgeId.get(segment.sourceEdgeId)
      : null;
    if (!terminalEnd || !openTerminalEndIds.has(terminalEnd.id)) return segment;

    // Reshape the wall boundary from a flat-top rectangle into a triangle
    // climbing from the eave to the ridge apex. The wall's plane is already
    // vertical (its xAxis runs along the eave, yAxis is +Z), so the apex
    // sits at the eave midpoint at ridge height. With this triangular
    // boundary, the wall-solid mesh builder produces the correct
    // gable-end face that fills the open hip.
    //
    // Only reshape rectangular flat-top boundaries (the migrated-gable case
    // where roofForm === 'hipped'). For a native `gable` roof form,
    // `buildWallSegments` already produced a gable-shaped boundary via
    // `buildWallTopProfile`; leave it alone so closed-vs-open boundary
    // parity (test: "keeps open wrap gable ends on the same terminal
    // closure geometry") is preserved.
    //
    // If we can't find a ridge height (defensive — should not happen for a
    // valid rectangular roof), fall back to the existing rectangular
    // boundary so the wall is still visible at eave height.
    const groundStart = segment.boundary[0]!;
    const groundEnd = segment.boundary[1]!;
    const shouldReshape =
      ridgeZ !== null && wallBoundaryHasFlatTop(segment.boundary);
    const nextBoundary = shouldReshape
      ? [
          groundStart,
          groundEnd,
          {
            x: (groundStart.x + groundEnd.x) / 2,
            y: (groundStart.y + groundEnd.y) / 2,
            z: ridgeZ as number,
          },
        ]
      : segment.boundary;

    return {
      ...segment,
      boundary: nextBoundary,
      metadata: {
        ...segment.metadata,
        houseWallMode: "open_gable_frame",
        gableEndId: terminalEnd.id,
      },
    };
  });
  const frameFeatures = buildOpenGableFrameFeatures({
    wallSegments: displayWallSegments,
    openTerminalEnds: availableTerminalEnds.filter((terminalEnd) =>
      openTerminalEndIds.has(terminalEnd.id),
    ),
    roofGeometry:
      typeof roof.metadata.roofGeometry === "string"
        ? roof.metadata.roofGeometry
        : null,
  });
  // Frame features are synthesized from the validated wall + roof
  // geometry, so they inherit the parent roof's QA verdict. Stamp the
  // QA metadata so downstream `roofQaStatus === 'valid'` checks on the
  // full feature collection do not flag these synthetic outlines.
  const parentRoofQaStatus =
    typeof roof.metadata.roofQaStatus === "string"
      ? roof.metadata.roofQaStatus
      : null;
  const stampedFrameFeatures = parentRoofQaStatus
    ? frameFeatures.map((feature) => ({
        ...feature,
        metadata: { ...feature.metadata, roofQaStatus: parentRoofQaStatus },
      }))
    : frameFeatures;
  const displayRoofFeatures = [...roof.roofFeatures, ...stampedFrameFeatures];
  const attachmentTarget = buildAttachmentTarget({
    config: input.config,
    attachmentEdge: semanticAttachmentEdge,
    wallSegments: displayWallSegments,
    eaveHeightMm,
    fasciaHeightMm,
  });
  // PR-SS-6 (2026-06-21): the roof 3D artifacts (perimeter edges,
  // gutter / fascia / soffit, flashings, material visuals, eave snap
  // targets, and the extruded envelope solids) are derived below via
  // `buildHouseRoofEnvelopeArtifacts` once `decks` exist (the solids
  // builder consumes them). The same helper rebuilds these artifacts
  // for composition-roof swaps, so there is one implementation.
  const decks = buildHouseDecks({
    decks:
      (model.decks ?? []).flatMap((deck) => {
        if (!deck) return [];
        const boundary = resolveHouseDeckBoundary({
          deck,
          footprint,
          wallSegments: displayWallSegments,
        });
        if (!boundary?.length) return [];
        return [
          {
            id: deck.id,
            // PR-T9 (2026-05-29): `name`, `kind`, `elevationMode` removed.
            shape: deck.shape ?? "preset",
            presetType: deck.presetType ?? null,
            presetRect: deck.presetRect ?? null,
            boundary,
            plane: planeFromOriginAxes(
              point(0, 0, 0),
              { x: 1, y: 0, z: 0 },
              { x: 0, y: 1, z: 0 },
            ),
            topSurfaceElevationMm: finiteNumber(
              deck.topSurfaceElevationMm,
              finiteNumber(deck.levelOffsetMm, 0),
            ),
            hostEdgeId: deck.hostEdgeId ?? null,
            isAttached: Boolean(deck.isAttached),
            surfaceMaterial: deck.surfaceMaterial ?? "timber_decking",
            supportClassification:
              deck.supportContext?.classification ?? "mixed_or_unclear",
            metadata: {
              // PR-T9 (2026-05-29): `deckKind` metadata removed alongside
              // the inspector cull. `deckName` is kept as `deck.id` so the
              // legacy diagnostic / hit-test paths that look up the deck
              // by metadata stay functional during the cleanup window.
              deckName: deck.id,
              deckShape: deck.shape ?? "preset",
              deckPresetType: deck.presetType ?? null,
              deckPresetRectWidthMm: deck.presetRect?.widthMm ?? null,
              deckPresetRectDepthMm: deck.presetRect?.depthMm ?? null,
              deckPresetRectCenterOffsetMm:
                deck.presetRect?.centerOffsetMm ?? null,
              deckPresetRectDetachedGapMm:
                deck.presetRect?.detachedGapMm ?? null,
              deckHostEdgeId: deck.hostEdgeId ?? null,
              deckIsAttached: Boolean(deck.isAttached),
              deckSurfaceMaterial: deck.surfaceMaterial ?? "timber_decking",
              deckSupportClassification:
                deck.supportContext?.classification ?? "mixed_or_unclear",
              deckNearestHouseEdgeId:
                deck.supportContext?.nearestHouseEdgeId ?? null,
              deckNearestHouseEdgeDistanceMm:
                deck.supportContext?.nearestHouseEdgeDistanceMm ?? null,
              deckAttachmentContactLengthMm:
                deck.supportContext?.attachmentContactLengthMm ?? null,
              deckSupportWarnings:
                deck.supportContext?.warningCodes?.join(",") ?? null,
              deckValidationStatus: deck.validation?.status ?? "valid",
              deckValidationCodes: deck.validation?.codes?.join(",") ?? null,
            },
          },
        ];
      }) ?? [],
  });
  const openings = buildHouseOpenings({
    openings:
      (model.openings ?? []).map((opening) => ({
        id: opening.id,
        label: opening.label ?? null,
        kind: opening.kind ?? "window",
        wallId: opening.wallId ?? "rear",
        hostEdgeId: opening.hostEdgeId ?? null,
        widthMm: finiteNumber(opening.widthMm, 0),
        heightMm: finiteNumber(opening.heightMm, 0),
        sillHeightMm: finiteNumber(opening.sillHeightMm, 0),
        offsetAlongWallMm: finiteNumber(opening.offsetAlongWallMm, 0),
        panelCount:
          opening.kind === "slider"
            ? opening.panelCount === 3 || opening.panelCount === 4
              ? opening.panelCount
              : 2
            : null,
        validationStatus:
          opening.validation?.status === "invalid" ? "invalid" : "valid",
        validationCodes: opening.validation?.codes ?? [],
        validationMessage: opening.validation?.message ?? null,
        metadata: {
          openingLabel: opening.label ?? opening.id,
          openingKind: opening.kind ?? "window",
          openingPanelCount:
            opening.kind === "slider"
              ? opening.panelCount === 3 || opening.panelCount === 4
                ? opening.panelCount
                : 2
              : null,
          openingWallId: opening.wallId ?? "rear",
          openingHostEdgeId: opening.hostEdgeId ?? null,
          openingWidthMm: finiteNumber(opening.widthMm, 0),
          openingHeightMm: finiteNumber(opening.heightMm, 0),
          openingSillHeightMm: finiteNumber(opening.sillHeightMm, 0),
          openingOffsetAlongWallMm: finiteNumber(opening.offsetAlongWallMm, 0),
          openingValidationStatus: opening.validation?.status ?? "valid",
          openingValidationCodes: opening.validation?.codes?.join(",") ?? null,
          openingValidationMessage: opening.validation?.message ?? null,
        },
      })) ?? [],
  });

  // Roof eave snap targets (step 6 of the first-class spatial-entities
  // migration). One descriptor per attachable perimeter edge — drain
  // eaves AND gable-end / apron edges that pergolas can still attach to
  // even when no roof plane drains above them (e.g. an opened Dutch-hip
  // end's gable wall). The classifier in `perimeterEdges.ts` labels each
  // edge by its hydrology (`drain_eave` / `weather_flashed_edge` /
  // `house_apron_edge`); we surface every kind here and let downstream
  // consumers re-filter on `edgeKind` when they truly need drains only
  // (gutter rendering, flashing rules). Pergola snap is the primary
  // attachment usage and it needs the full perimeter.
  const { solids, eave, roofFlashings, roofEaves } =
    buildHouseRoofEnvelopeArtifacts({
      footprint: effectiveRoofFootprint,
      eavePolygon: effectiveEavePolygon,
      roofForm,
      roof,
      eaveHeightMm,
      wallSegments: displayWallSegments,
      decks,
      attachmentTarget,
      joinSourceEdgeId: attachmentTarget.sourceEdgeId ?? null,
      soffitDepthMm,
      fasciaHeightMm,
      gutterWidthMm,
      gutterDepthMm,
      gutterProjectionMm,
      eaveOverhangMm,
    });

  return {
    houseId: input.houseId,
    footprint,
    wallSegments: displayWallSegments,
    roofPlanes: roof.roofPlanes,
    roofFeatures: displayRoofFeatures,
    roofFlashings,
    decks,
    openings,
    solids,
    roofEaves,
    eave,
    attachmentTarget,
    // Workbench's configured ridge axis. Surfaced at the top level
    // (not in `metadata`) so it does NOT participate in the canonical
    // golden hash -- it's a runtime hint for downstream consumers
    // (top-projection click-target enrichment, rail derivations)
    // that need to align on the active axis without a per-plane
    // heuristic. Joined-hipped wavefront planes carry alternating
    // x/y ridge metadata, so picking from `roofPlanes[0].metadata
    // .ridgeAxis` chose the wrong axis on custom polygons where the
    // user's configured axis differs from the first plane's. The
    // canonical compare cherry-picks specific HouseModel3D fields,
    // so an additional top-level field is silently excluded by
    // omission -- intentional here.
    roofRidgeAxis,
    metadata: {
      roofForm,
      openGableEndIds: [...openTerminalEndIds].join(","),
      storeyMode: model.storeyMode ?? "single_storey",
      wallConstruction: model.wallConstruction ?? "timber_frame",
      attachmentStrategy: attachmentTarget.strategy,
      ...roof.metadata,
      ...footprintCanonicalizationMetadata,
    },
  };
}

export function buildHouseReferenceGeometry(input: {
  /**
   * Source house form id. Stamped onto the returned model so the scene
   * seam can prefix derived ids by source house. For the solver path this
   * is the host house id (the form the active pergola attaches to); for
   * tests it's a stable literal. Required.
   */
  houseId: string;
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
}): HouseReferenceGeometry {
  // House first-class spatial position (milestone 12). When set, every coord
  // on the returned `HouseReferenceGeometry` is in house-local coords; the
  // boundary (`applyAssemblyPosition3D`) consumes `position` and translates
  // to world. When null, legacy world-coord path applies (footprint was
  // pergola-anchored in `normalize.ts` and pre-translated implicitly).
  const housePosition = input.config.houseContext.position ?? null;
  const model = buildHouseModel3D({
    houseId: input.houseId,
    config: input.config,
    attachmentEdge: input.attachmentEdge,
  });

  if (input.config.connection.type === "freestanding") {
    // Freestanding houses populate `model` for project-level house rendering.
    // Pergola-attachment fields stay null: there is no pergola wall to bind
    // to, no fascia, and no attachment target.
    return {
      wallPlane: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
      footprint: model?.footprint ?? input.config.houseContext.footprint ?? null,
      model,
      attachmentTarget: null,
      position: housePosition,
    };
  }

  const wallPlane: Plane3 = planeFromOriginAxes(
    input.config.datum.origin,
    input.config.datum.xAxis,
    input.config.datum.zAxis,
  );

  return {
    wallPlane: {
      ...wallPlane,
      normal: { x: 0, y: -1, z: 0 },
    },
    fasciaLine:
      input.config.connection.type === "fascia" ? input.attachmentEdge : null,
    roofEdgeLine: input.attachmentEdge,
    soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
    footprint: model?.footprint ?? input.config.houseContext.footprint ?? null,
    model,
    attachmentTarget: model?.attachmentTarget ?? null,
    position: housePosition,
  };
}

/**
 * Build a `HouseModel3D` from a `RawHouseInput` plus the pergola-side
 * context the current builder reads. Phase 2 of milestone 13 (drop pergola
 * `houseContext` wrapping) -- this is the entry point that the project-
 * level orchestrator (phase 3) will call ONCE per house, instead of the
 * pipeline rebuilding the same `HouseModel3D` once per pergola.
 *
 * The output is byte-equivalent (modulo serialisation order) to the
 * legacy path of `normalize() -> buildHouseModel3D({ config, attachmentEdge })`,
 * because internally we ARE the legacy path -- this is a thin adapter, not
 * a reimplementation. Phase 2 is intentionally additive; the legacy entry
 * stays as-is. A round-trip test (`houseModelStageDiagnostics.test.ts`)
 * asserts the equivalence so future refactors don't drift the two paths.
 */
export function buildHouseModel3DFromRawHouseInput(
  input: HouseModel3DRawHouseInput,
): HouseModel3D | null {
  const modelInput =
    buildHouseModel3DGeometryConfigInputFromRawHouseInput(input);
  return buildHouseModel3D({
    houseId: modelInput.houseId,
    config: modelInput.config,
    attachmentEdge: modelInput.attachmentEdge,
  });
}
