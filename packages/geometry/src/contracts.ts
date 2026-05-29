/**
 * Canonical Sanctuary geometry contracts.
 *
 * Two coordinate spaces:
 * - **Assembly-local** — the family solver writes here. Origin is at the
 *   spatial entity's anchor (X = entity length axis, Y = entity projection
 *   axis, Z = height); for a pergola that's the legacy "X = pergola
 *   length, Y = projection away from the attachment edge".
 * - **World** — reached by `applyAssemblyPosition3D`, which translates the
 *   assembly by its `position.origin` and rotates by `position.rotationDeg`
 *   around +Z. When `position` is null the transform is a no-op and the
 *   assembly is rendered at world `(0, 0, 0)` (legacy single-pergola path).
 *
 * `Assembly3D` represents one spatial entity instance — projects may carry
 * many (one per pergola today, with the canonical house referenced on
 * each assembly's `house` field for legacy compat). See `Assembly3D` doc
 * for the per-instance / per-project responsibility split.
 *
 * These types intentionally contain no SVG, sheet, or viewport concerns.
 * They are the executable boundary for the geometry-first runtime.
 */

export type Point3 = {
  x: number;
  y: number;
  z: number;
};

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type Line3 = {
  start: Point3;
  end: Point3;
};

export type Polygon3 = Point3[];

export type Point2 = {
  x: number;
  y: number;
};

export type Vector2 = {
  x: number;
  y: number;
};

export type Line2 = {
  start: Point2;
  end: Point2;
};

export type Polygon2 = Point2[];

export type AssemblyMemberProfileAnchors = {
  undersideZ: number;
  topsideZ: number;
  backFaceY: number;
  frontFaceY: number;
  roofBearingFaceY: number;
  roofBearingFaceZ: number;
};

/**
 * Plane basis vectors live in world space. The normal is not view-relative.
 */
export type Plane3 = {
  origin: Point3;
  xAxis: Vector3;
  yAxis: Vector3;
  normal: Vector3;
};

/**
 * Datum frame for the assembly. Attachment edges and member frames are expressed in world space.
 */
export type DatumFrame3 = {
  origin: Point3;
  xAxis: Vector3;
  yAxis: Vector3;
  zAxis: Vector3;
};

/**
 * Supported V1 Sanctuary families only.
 */
export type PergolaFamily = "mono" | "gable" | "box" | "hip" | "hip_corner";

/**
 * Pergola world-space position. When set, downstream consumers should prefer this
 * over deriving placement from `connection.type` + house attachmentEdge.
 *
 * Phase 2 of the free-floating-objects migration introduces this field as a contract
 * surface. Consumers (datum builder, snap engine) are wired in subsequent slices.
 * See docs/design-workbench-architecture.md (section "Direction: Free-Floating
 * Objects With Snap-Derived Connections").
 */
export type AssemblyPosition = {
  /** World-space origin of the pergola on the ground plane (mm). */
  origin: Point2;
  /** Rotation around the +Z axis, in degrees. 0 = pergola length axis runs +X. */
  rotationDeg: number;
};

export type RoofMaterial = "acrylic" | "insulated" | "timber" | "louvre";
export type ConnectionType = "fascia" | "soffit" | "wall" | "freestanding";
export type AttachmentSide = "left" | "right" | "rear" | "front";
export type PostMode = "standard" | "custom";
export type FootingType = "slab" | "pier" | "pile";
export type RoofFallDirection = "positiveY" | "negativeY" | "dual";
export type GutterAssemblyMode = "integrated" | "separate" | "none";
export type SupportConditionType =
  | "house_connection"
  | "post_connection"
  | "ground"
  | "bracing"
  | "custom";
export type AssemblyMemberRole =
  | "post"
  | "beam"
  | "ledger"
  | "ridge"
  | "rafter"
  | "gutter"
  | "brace"
  | "joiner";
export type ProfileShape = "rectangular" | "c-channel" | "custom";
export type RoofCladdingMaterial = "acrylic";
export type HouseStoreyMode = "single_storey" | "double_storey" | "custom";
export type HouseWallConstruction = "timber_frame";
export type HouseRoofForm = "flat" | "mono" | "hipped";
export type HouseRoofPrimaryFallDirection = "positive_x" | "negative_x" | "positive_y" | "negative_y";
export type HouseRoofRidgeAxis = "x" | "y";
// PR-T8 (2026-05-29): `HouseRoofAppendageForm` removed with the
// appendage feature cull. No production consumer remained.
export type HouseRoofFeatureKind = "ridge" | "hip" | "valley" | "gable_end_frame";
export type HouseDeckKind = "deck" | "landing";
export type HouseDeckShape = "preset" | "custom";
export type HouseDeckPresetType = "rect_attached" | "rect_detached";
export type HouseDeckElevationMode = "ground" | "stepped" | "aligned_to_threshold";
export type HouseDeckSurfaceMaterial = "timber_decking" | "composite" | "concrete";
export type HouseDeckSupportClassification =
  | "ground_supported"
  | "threshold_attached"
  | "mixed_or_unclear";
export type HouseOpeningKind = "window" | "hinged_door" | "slider" | "stacker";
export type HouseRoofMaterial =
  | "corrugated_iron"
  | "trapezoidal_5_rib"
  | "eurotray_300"
  | "eurotray_500"
  | "shingles";
export type HouseRoofMaterialProfileKind = "rib" | "seam" | "course";
export type HouseAttachmentStrategy =
  | "soffit_brackets"
  | "fascia_under_gutter"
  | "facade_ledger"
  | "post_supported_tieback"
  | "none";
export type HouseAttachmentTargetKind =
  | "line"
  | "plane"
  | "zone"
  | "metadata_only"
  | "none";
export type HouseFootprintPreset =
  | "straight"
  | "l_left"
  | "l_right"
  | "recess_left"
  | "recess_right"
  | "u_shape"
  | "wrap_left"
  | "wrap_right";
export type HouseFootprintMode = "preset" | "custom_polygon";

export type HouseFootprintPolygonPointInput = {
  alongM: string | number;
  depthM: string | number;
};

export type HouseFootprintParams = {
  widthM: string;
  offsetXM: string;
  setbackM: string;
  bandDepthM: string;
  returnRunM: string;
  recessWidthM: string;
  recessDepthM: string;
  leftLegRunM: string;
  rightLegRunM: string;
  sideRunM: string;
};

export type RawPergolaStyle =
  | "pitched"
  | "gable"
  | "hip"
  | "hip_corner"
  | "box_perimeter";
export type RawRoofMaterial =
  | "acrylic"
  | "timber"
  | "mixed"
  | "insulated"
  | "louvre";
export type RawHouseConnectionType =
  | "soffit"
  | "fascia"
  | "facade"
  | "none"
  | "wall"
  | "freestanding";
export type RawSlopeDirection = "away_from_house" | "toward_house";
export type RawPostConnectionType =
  | "pile_1m"
  | "pile_1_5m"
  | "deck_bracket"
  | "slab_anchors";
export type RawGroundCondition = "easy" | "hard";
export type RawGableEndFramesMode = "none" | "outer_end_only" | "both_ends";
export type RawGableEaveGutterMode = "house" | "our";
export type RawBoxGutterMode = "house" | "our" | "none";

export type GeometryMetadataValue = string | number | boolean | null;
export type GeometryMetadata = Record<string, GeometryMetadataValue>;
export type GableEndFramesMode = RawGableEndFramesMode;
export type GableEaveGutterMode = RawGableEaveGutterMode;
export type BoxGutterMode = RawBoxGutterMode;

export type HouseEaveConfig = {
  soffitDepthMm?: number | null;
  fasciaHeightMm?: number | null;
  gutterWidthMm?: number | null;
  gutterDepthMm?: number | null;
  gutterProjectionMm?: number | null;
  eaveOverhangMm?: number | null;
};

export type HouseModelConfig = {
  footprint?: Polygon3 | null;
  storeyMode?: HouseStoreyMode | null;
  wallConstruction?: HouseWallConstruction | null;
  roofForm?: HouseRoofForm | null;
  roofMaterial?: HouseRoofMaterial | null;
  eaveHeightMm?: number | null;
  wallHeightMm?: number | null;
  roofPitchDeg?: number | null;
  roofPrimaryFallDirection?: HouseRoofPrimaryFallDirection | null;
  roofRidgeAxis?: HouseRoofRidgeAxis | null;
  openGableEndIds?: string[] | null;
  // PR-T8 (2026-05-29): `roofAppendage` removed with the appendage cull.
  decks?: HouseDeckConfig[] | null;
  openings?: HouseOpeningConfig[] | null;
  eave?: HouseEaveConfig | null;
  attachmentStrategy?: HouseAttachmentStrategy | null;
};

export type HouseDeckConfig = {
  id: string;
  name?: string | null;
  kind?: HouseDeckKind | null;
  shape?: HouseDeckShape | null;
  presetType?: HouseDeckPresetType | null;
  presetRect?: {
    widthMm: number;
    depthMm: number;
    centerOffsetMm: number;
    detachedGapMm: number;
  } | null;
  outline?: Polygon3 | null;
  elevationMode?: HouseDeckElevationMode | null;
  levelOffsetMm?: number | null;
  topSurfaceElevationMm?: number | null;
  hostEdgeId?: string | null;
  isAttached?: boolean | null;
  surfaceMaterial?: HouseDeckSurfaceMaterial | null;
  supportContext?: {
    classification?: HouseDeckSupportClassification | null;
    nearestHouseEdgeId?: string | null;
    nearestHouseEdgeDistanceMm?: number | null;
    attachmentContactLengthMm?: number | null;
    warningCodes?: string[] | null;
    warningMessages?: string[] | null;
  } | null;
  validation?: {
    status?: "valid" | "invalid" | null;
    codes?: string[] | null;
    messages?: string[] | null;
  } | null;
};

export type HouseOpeningConfig = {
  id: string;
  label?: string | null;
  kind?: HouseOpeningKind | null;
  panelCount?: 2 | 3 | 4 | null;
  wallId?: AttachmentSide | null;
  hostEdgeId?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  sillHeightMm?: number | null;
  offsetAlongWallMm?: number | null;
  validation?: {
    status?: "valid" | "invalid" | null;
    codes?: string[] | null;
    message?: string | null;
  } | null;
};

export type AssemblyMemberProfile = {
  shape: ProfileShape;
  /**
   * Profile width axis. This is the minor section axis and maps to localFrame.yAxis.
   */
  widthMm: number;
  /**
   * Profile depth axis. This is the major section axis and maps to localFrame.zAxis.
   */
  depthMm: number;
  profileKey?: string | null;
  sectionOutline?: Polygon2 | null;
  sectionVoids?: Polygon2[] | null;
  anchors?: AssemblyMemberProfileAnchors | null;
};

export type AssemblyMemberEndCutPlane = {
  normal: Vector3;
  offsetMm: number;
  keepSide: "negative" | "positive";
};

export type AssemblyMemberEndCut = {
  end: "start" | "end";
  plane: AssemblyMemberEndCutPlane;
  preClipExtensionMm: number;
};

/**
 * Raw house-level input. Phase 1 of milestone 13 (drop pergola
 * `houseContext` wrapping, audit row 9). Mirrors the content currently
 * carried in `RawGeometryModuleInput.houseContext` but lifted to a
 * project-level entity -- in a multi-pergola scene, ONE `RawHouseInput`
 * describes the house and many `RawGeometryModuleInput`s reference it
 * (rather than duplicating the same `houseContext` sub-tree N times).
 *
 * Intentionally additive at this stage: no consumer reads `RawHouseInput`
 * yet. Phase 2 introduces a builder that produces `HouseModel3D` directly
 * from this input; phase 3 wires solve orchestration so the house solves
 * once per project; phase 4 migrates portal callers; phase 5 retires (or
 * shrinks) the `houseContext` field on `RawGeometryModuleInput`.
 *
 * Field-for-field equivalent to today's `houseContext` shape so the
 * migration is a structural lift, not a redesign.
 */
export type RawHouseInput = {
  /**
   * Stable project-scoped house id. In single-house projects this can be
   * a fixed string (`'house-main'`). Multi-house projects use the
   * project-model house-form id. Becomes the `sourceObjectId` on
   * top-projection / 3D scene objects so consumers can disambiguate.
   */
  houseId: string;
  footprintMode?: HouseFootprintMode | "orthogonal_polygon" | null;
  footprintPreset?: HouseFootprintPreset | null;
  footprintParams?: HouseFootprintParams | null;
  footprintPolygon?: HouseFootprintPolygonPointInput[] | null;
  /**
   * Optional world-space position. Same semantics as
   * `houseContext.position`: when present, `footprintPolygon` is decoded
   * against a unit (1m × 1m) frame and this position applies post-decode
   * (so the house's world location is invariant to pergola dimensions).
   * When absent, the legacy real-frame decoder runs.
   */
  position?: {
    origin: { x: string | number; y: string | number };
    rotationDeg?: string | number | null;
  } | null;
  storeyMode?: HouseStoreyMode | null;
  wallConstruction?: HouseWallConstruction | null;
  roofForm?: HouseRoofForm | null;
  roofMaterial?: HouseRoofMaterial | null;
  roofPrimaryFallDirection?: HouseRoofPrimaryFallDirection | null;
  roofRidgeAxis?: HouseRoofRidgeAxis | null;
  openGableEndIds?: string[] | null;
  // PR-T8 (2026-05-29): `roofAppendage` removed with the appendage cull.
  decks?: Array<{
    id: string;
    name?: string | null;
    kind?: HouseDeckKind | null;
    shape?: HouseDeckShape | null;
    presetType?: HouseDeckPresetType | null;
    presetRect?: {
      widthMm?: string | number | null;
      depthMm?: string | number | null;
      centerOffsetMm?: string | number | null;
      detachedGapMm?: string | number | null;
    } | null;
    outline?: HouseFootprintPolygonPointInput[] | null;
    position?: {
      origin: { x: string | number; y: string | number };
      rotationDeg?: string | number | null;
    } | null;
    elevationMode?: HouseDeckElevationMode | null;
    levelOffsetMm?: string | number | null;
    topSurfaceElevationMm?: number | null;
    hostEdgeId?: string | null;
    isAttached?: boolean | null;
    surfaceMaterial?: HouseDeckSurfaceMaterial | null;
    supportContext?: {
      classification?: HouseDeckSupportClassification | null;
      nearestHouseEdgeId?: string | null;
      nearestHouseEdgeDistanceMm?: number | null;
      attachmentContactLengthMm?: number | null;
      warningCodes?: string[] | null;
      warningMessages?: string[] | null;
    } | null;
    validation?: {
      status?: "valid" | "invalid" | null;
      codes?: string[] | null;
      messages?: string[] | null;
    } | null;
  }> | null;
  openings?: Array<{
    id: string;
    label?: string | null;
    kind?: HouseOpeningKind | null;
    panelCount?: 2 | 3 | 4 | string | number | null;
    wallId?: AttachmentSide | null;
    hostEdgeId?: string | null;
    widthMm?: string | number | null;
    heightMm?: string | number | null;
    sillHeightMm?: string | number | null;
    offsetAlongWallMm?: string | number | null;
    validation?: {
      status?: "valid" | "invalid" | null;
      codes?: string[] | null;
      message?: string | null;
    } | null;
  }> | null;
  attachmentStrategy?: HouseAttachmentStrategy | null;
  eaveHeightM?: string | number | null;
  wallHeightM?: string | number | null;
  roofPitchDeg?: string | number | null;
  eave?: {
    soffitDepthMm?: string | number | null;
    fasciaHeightMm?: string | number | null;
    gutterWidthMm?: string | number | null;
    gutterDepthMm?: string | number | null;
    gutterProjectionMm?: string | number | null;
    eaveOverhangMm?: string | number | null;
  } | null;
};

/**
 * Raw module-level input for package-owned normalization.
 * This stays portal-agnostic so callers adapt into it at the boundary.
 */
export type RawGeometryModuleInput = {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  moduleId?: string | null;
  pergolaStyle: RawPergolaStyle;
  boxPerimeterEnabled: boolean;
  roof: {
    material: RawRoofMaterial;
    mode?: string | null;
    slopeDirection?: RawSlopeDirection | null;
    roofPitchDeg?: string | number | null;
    overhangEnabled?: boolean | null;
    overhangM?: string | number | null;
    mixedAcrylicBaysMain?: string | number | null;
    mixedAcrylicBaysA?: string | number | null;
    mixedAcrylicBaysB?: string | number | null;
  };
  gable?: {
    endFramesMode?: RawGableEndFramesMode | null;
    houseEaveGutter?: RawGableEaveGutterMode | null;
    outerEaveGutter?: RawGableEaveGutterMode | null;
  } | null;
  box?: {
    houseEdgeGutter?: RawBoxGutterMode | null;
    farEdgeGutter?: RawBoxGutterMode | null;
  } | null;
  connection: {
    houseConnectionType: RawHouseConnectionType;
    attachmentSide?: AttachmentSide | null;
  };
  /**
   * Optional per-object world position. Phase 2 of the free-floating-objects
   * migration. Currently passed through normalize and exposed on GeometryConfig
   * but not yet consumed by solvers.
   */
  position?: {
    origin?: { x?: string | number | null; y?: string | number | null } | null;
    rotationDeg?: string | number | null;
  } | null;
  supports: {
    postMode?: PostMode | null;
    postPositions?: Point3[] | null;
    postCount?: string | number | null;
    postCutHeightM?: string | number | null;
    postConnectionType?: RawPostConnectionType | null;
    ground?: RawGroundCondition | null;
  };
  structural?: {
    heights?: {
      houseUndersideM?: string | number | null;
      outerUndersideM?: string | number | null;
      referenceUndersideM?: string | number | null;
    } | null;
    profiles?: {
      post?: string | null;
      rafter?: string | null;
      ledger?: string | null;
      supportBeam?: string | null;
      gutter?: string | null;
      ridge?: string | null;
      tieBeam?: string | null;
      strut?: string | null;
      boxPerimeter?: string | null;
    } | null;
    framing?: {
      rafterCount?: string | number | null;
      rafterSpacingMm?: string | number | null;
    } | null;
    drainage?: {
      gutterType?: string | null;
      gutterAssemblyMode?: GutterAssemblyMode | null;
      integratedGutterBeam?: boolean | null;
      hasOurGutter?: boolean | null;
    } | null;
  } | null;
  houseContext: {
    footprintMode?: HouseFootprintMode | "orthogonal_polygon" | null;
    footprintPreset?: HouseFootprintPreset | null;
    footprintParams?: HouseFootprintParams | null;
    footprintPolygon?: HouseFootprintPolygonPointInput[] | null;
    /**
     * Optional world-space position for the house. When present, the geometry
     * pipeline interprets `footprintPolygon` against a unit (1m × 1m) frame and
     * applies this position post-decode — so the house is invariant to the
     * pergola's dimensions. When absent, the legacy decoder uses the live
     * pergola dimensions as the frame anchor (back-compat).
     *
     * Origin in mm; rotation in degrees around +Z.
     */
    position?: {
      origin: { x: string | number; y: string | number };
      rotationDeg?: string | number | null;
    } | null;
    storeyMode?: HouseStoreyMode | null;
    wallConstruction?: HouseWallConstruction | null;
    roofForm?: HouseRoofForm | null;
    roofMaterial?: HouseRoofMaterial | null;
    roofPrimaryFallDirection?: HouseRoofPrimaryFallDirection | null;
    roofRidgeAxis?: HouseRoofRidgeAxis | null;
    openGableEndIds?: string[] | null;
    // PR-T8 (2026-05-29): `roofAppendage` removed with the appendage cull.
    decks?: Array<{
      id: string;
      name?: string | null;
      kind?: HouseDeckKind | null;
      shape?: HouseDeckShape | null;
      presetType?: HouseDeckPresetType | null;
      presetRect?: {
        widthMm?: string | number | null;
        depthMm?: string | number | null;
        centerOffsetMm?: string | number | null;
        detachedGapMm?: string | number | null;
      } | null;
      outline?: HouseFootprintPolygonPointInput[] | null;
      /**
       * Optional world-space position overlay (stage 4 of the
       * first-class-spatial-entities migration). When set, the geometry
       * pipeline applies this translation/rotation to the deck's outline
       * post-decode so the deck stays put when the host's `attachmentSide`
       * or pergola dimensions change.
       */
      position?: {
        origin: { x: string | number; y: string | number };
        rotationDeg?: string | number | null;
      } | null;
      elevationMode?: HouseDeckElevationMode | null;
      levelOffsetMm?: string | number | null;
      topSurfaceElevationMm?: number | null;
      hostEdgeId?: string | null;
      isAttached?: boolean | null;
      surfaceMaterial?: HouseDeckSurfaceMaterial | null;
      supportContext?: {
        classification?: HouseDeckSupportClassification | null;
        nearestHouseEdgeId?: string | null;
        nearestHouseEdgeDistanceMm?: number | null;
        attachmentContactLengthMm?: number | null;
        warningCodes?: string[] | null;
        warningMessages?: string[] | null;
      } | null;
      validation?: {
        status?: "valid" | "invalid" | null;
        codes?: string[] | null;
        messages?: string[] | null;
      } | null;
    }> | null;
    openings?: Array<{
      id: string;
      label?: string | null;
      kind?: HouseOpeningKind | null;
      panelCount?: 2 | 3 | 4 | string | number | null;
      wallId?: AttachmentSide | null;
      hostEdgeId?: string | null;
      widthMm?: string | number | null;
      heightMm?: string | number | null;
      sillHeightMm?: string | number | null;
      offsetAlongWallMm?: string | number | null;
      validation?: {
        status?: "valid" | "invalid" | null;
        codes?: string[] | null;
        message?: string | null;
      } | null;
    }> | null;
    attachmentStrategy?: HouseAttachmentStrategy | null;
    eaveHeightM?: string | number | null;
    wallHeightM?: string | number | null;
    roofPitchDeg?: string | number | null;
    eave?: {
      soffitDepthMm?: string | number | null;
      fasciaHeightMm?: string | number | null;
      gutterWidthMm?: string | number | null;
      gutterDepthMm?: string | number | null;
      gutterProjectionMm?: string | number | null;
      eaveOverhangMm?: string | number | null;
    } | null;
  };
  dimensions: {
    lengthM?: string | number | null;
    projectionM?: string | number | null;
    hipCornerLengthBM?: string | number | null;
    hipCornerProjectionBM?: string | number | null;
  };
  derived?: {
    lengthM?: number | null;
    projectionM?: number | null;
    roofPitchDeg?: number | null;
    slopeDirection?: RawSlopeDirection | null;
    effectiveRunM?: number | null;
    acrylicRequiredDownslopeM?: number | null;
    joinerPieceLengthM?: number | null;
    joinerRunsTotal?: number | null;
    rafterHouseAllowanceM?: number | null;
    rafterFarAllowanceM?: number | null;
    acrylicAreaM2?: number | null;
    boxEffectiveRunM?: number | null;
    boxRiseMm?: number | null;
    boxMaxFallMm?: number | null;
  };
};

/**
 * Normalized runtime input derived from estimate/calculator state.
 * Optional design-request linkage is metadata only and must not gate editor access.
 * This config is local assembly-space state, not a view model.
 */
export type GeometryConfig = {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  family: PergolaFamily;
  datum: {
    origin: Point3;
    xAxis: Vector3;
    yAxis: Vector3;
    zAxis: Vector3;
    attachmentEdgeStart: Point3;
    attachmentEdgeEnd: Point3;
  };
  /**
   * Optional per-object world position. When present, geometry consumers will
   * eventually use this in preference to the connection-driven `datum`. Phase 2
   * scaffolding — currently no solver consumes it; field is plumbed through
   * normalize for downstream slices to wire up. See AssemblyPosition.
   */
  position?: AssemblyPosition | null;
  dimensions: {
    lengthMm: number;
    projectionMm: number;
    lengthBMm?: number | null;
    projectionBMm?: number | null;
    roofPitchDeg: number;
  };
  roof: {
    material: RoofMaterial;
    mode?: string | null;
    fallDirection: RoofFallDirection;
    boxPerimeterEnabled: boolean;
    overhangMm: number;
  };
  roofCovering: {
    kind: RoofCladdingMaterial | null;
    effectiveRunMm: number | null;
    acrylicRequiredDownslopeMm: number | null;
    joinerPieceLengthMm: number | null;
    joinerRunsTotal: number | null;
    houseAllowanceMm: number | null;
    farAllowanceMm: number | null;
    acrylicAreaMm2: number | null;
    mixedAcrylicBaysMain?: number | null;
    mixedAcrylicBaysA?: number | null;
    mixedAcrylicBaysB?: number | null;
  };
  gable: {
    ridgePositionMm: number | null;
    endFramesMode: GableEndFramesMode | null;
    houseEaveGutterMode: GableEaveGutterMode | null;
    outerEaveGutterMode: GableEaveGutterMode | null;
  };
  box: {
    houseEdgeGutterMode: BoxGutterMode | null;
    farEdgeGutterMode: BoxGutterMode | null;
    houseSetbackMm: number | null;
    outerSetbackMm: number | null;
    effectiveRunMm: number | null;
    riseMm: number | null;
    maxFallMm: number | null;
  };
  connection: {
    type: ConnectionType;
    attachmentSide: AttachmentSide;
  };
  supports: {
    postMode: PostMode;
    postPositions?: Point3[];
    postCount?: number;
    postCutHeightMm?: number | null;
    footingType?: FootingType | null;
    postConnectionType?: RawPostConnectionType | null;
    groundCondition?: RawGroundCondition | null;
    groundLevelMm?: number | null;
  };
  structural: {
    heights: {
      houseUndersideMm: number | null;
      outerUndersideMm: number | null;
      referenceUndersideMm: number | null;
    };
    profiles: {
      post: AssemblyMemberProfile | null;
      rafter: AssemblyMemberProfile | null;
      ledger: AssemblyMemberProfile | null;
      supportBeam: AssemblyMemberProfile | null;
      gutter: AssemblyMemberProfile | null;
      ridge: AssemblyMemberProfile | null;
      tieBeam?: AssemblyMemberProfile | null;
      strut?: AssemblyMemberProfile | null;
      boxPerimeter: AssemblyMemberProfile | null;
    };
    framing: {
      rafterCount: number | null;
      rafterSpacingMm: number | null;
    };
    drainage: {
      gutterType: string | null;
      gutterAssemblyMode: GutterAssemblyMode | null;
      integratedGutterBeam: boolean | null;
      hasOurGutter: boolean | null;
    };
  };
  houseContext: {
    wallLine?: Line3 | null;
    fasciaLine?: Line3 | null;
    roofEdgeLine?: Line3 | null;
    soffitDepthMm?: number | null;
    footprint?: Polygon3 | null;
    footprintMode?: HouseFootprintMode | null;
    footprintPolygon?: HouseFootprintPolygonPointInput[] | null;
    /**
     * House first-class spatial position. When set, geometry consumers treat
     * the house's `footprintPolygon` as decoded against a unit (1m × 1m) frame
     * with this position applied post-decode — so the house's world location
     * is invariant to pergola dimensions. When null, the legacy real-frame
     * decoder runs (back-compat).
     */
    position?: AssemblyPosition | null;
    model?: HouseModelConfig | null;
    attachmentStrategy?: HouseAttachmentStrategy | null;
  };
};

/**
 * Structural member in world space. Heights and orientation must never be view-relative.
 * localFrame axes are locked as:
 * - xAxis = member run axis
 * - yAxis = profile width axis
 * - zAxis = profile depth axis
 */
export type AssemblyMember3D = {
  id: string;
  role: AssemblyMemberRole;
  centerline: Line3;
  profile: AssemblyMemberProfile;
  localFrame: DatumFrame3;
  endCuts?: AssemblyMemberEndCut[] | null;
  metadata?: GeometryMetadata;
};

/**
 * Roof surfaces are explicit 3D planes, not implied by plan drafting shortcuts.
 */
export type RoofPlane3D = {
  id: string;
  boundary: Polygon3;
  plane: Plane3;
  fallVector: Vector3;
  metadata?: GeometryMetadata;
};

export type RoofCladdingPanel3D = {
  id: string;
  material: RoofCladdingMaterial;
  boundary: Polygon3;
  thicknessMm: number;
  plane: Plane3;
  metadata?: GeometryMetadata;
};

export type RoofFlashingWing3D = {
  id: string;
  boundary: Polygon3;
  plane: Plane3;
};

export type RoofFlashing3D = {
  id: string;
  wings: RoofFlashingWing3D[];
  thicknessMm: number;
  metadata?: GeometryMetadata;
};

export type HouseWallSegment3D = {
  id: string;
  line: Line3;
  plane: Plane3;
  boundary: Polygon3;
  sourceEdgeId?: string | null;
  metadata?: GeometryMetadata;
};

export type HouseAttachmentZone3D = {
  plane: Plane3;
  topZMm?: number | null;
  bottomZMm?: number | null;
  boundary?: Polygon3 | null;
  safeLine?: Line3 | null;
  metadata?: GeometryMetadata;
};

export type HouseAttachmentTarget3D = {
  kind: HouseAttachmentTargetKind;
  strategy: HouseAttachmentStrategy;
  line?: Line3 | null;
  plane?: Plane3 | null;
  zone?: HouseAttachmentZone3D | null;
  sourceEdgeId?: string | null;
  metadata?: GeometryMetadata;
};

export type HouseEaveGeometry3D = {
  soffitDepthMm?: number | null;
  fasciaHeightMm?: number | null;
  gutterWidthMm?: number | null;
  gutterDepthMm?: number | null;
  gutterProjectionMm?: number | null;
  eaveOverhangMm?: number | null;
  soffitPolygons?: Polygon3[] | null;
  fasciaPolygons?: Polygon3[] | null;
  gutterLines?: Line3[] | null;
  gutterBoundaries?: Polygon3[] | null;
  metadata?: GeometryMetadata;
};

export type HouseRoofFeature3D = {
  id: string;
  kind: HouseRoofFeatureKind;
  line: Line3;
  metadata?: GeometryMetadata;
};

export type HouseRoofMaterialVisual3D = {
  id: string;
  roofPlaneId: string;
  material: HouseRoofMaterial;
  profileKind: HouseRoofMaterialProfileKind;
  lines: Line3[];
  plane: Plane3;
  spacingMm: number;
  surfaceOffsetMm: number;
  metadata?: GeometryMetadata;
};

export type HouseSurfaceSolidKind = "wall" | "roof" | "soffit" | "fascia" | "deck";
export type HouseLinearSolidKind = "gutter";

export type RenderMesh3D = {
  vertices: Point3[];
  faces: [number, number, number][];
};

export type HouseSurfaceSolid3D = {
  id: string;
  kind: HouseSurfaceSolidKind;
  boundary: Polygon3;
  plane: Plane3;
  thicknessMm: number;
  renderMesh?: RenderMesh3D;
  metadata?: GeometryMetadata;
};

export type HouseLinearSolid3D = {
  id: string;
  kind: HouseLinearSolidKind;
  centerline: Line3;
  localFrame: DatumFrame3;
  profileWidthMm: number;
  profileDepthMm: number;
  renderMesh?: RenderMesh3D;
  metadata?: GeometryMetadata;
};

export type HouseEnvelopeSolids3D = {
  surfaceSolids: HouseSurfaceSolid3D[];
  linearSolids: HouseLinearSolid3D[];
};

export type HouseDeck3D = {
  id: string;
  name?: string | null;
  kind: HouseDeckKind;
  shape: HouseDeckShape;
  presetType?: HouseDeckPresetType | null;
  presetRect?: {
    widthMm: number;
    depthMm: number;
    centerOffsetMm: number;
    detachedGapMm: number;
  } | null;
  boundary: Polygon3;
  plane: Plane3;
  topSurfaceElevationMm: number;
  elevationMode: HouseDeckElevationMode;
  hostEdgeId?: string | null;
  isAttached: boolean;
  surfaceMaterial: HouseDeckSurfaceMaterial;
  supportClassification: HouseDeckSupportClassification;
  metadata?: GeometryMetadata;
};

export type HouseOpening3D = {
  id: string;
  label?: string | null;
  kind: HouseOpeningKind;
  panelCount: 2 | 3 | 4 | null;
  wallId: AttachmentSide;
  hostEdgeId?: string | null;
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;
  offsetAlongWallMm: number;
  validationStatus: "valid" | "invalid";
  validationCodes?: string[] | null;
  validationMessage?: string | null;
  metadata?: GeometryMetadata;
};

/**
 * Roof eave snap target. One per attachable perimeter edge of a house roof.
 * Step 6 of the first-class spatial-entities migration: eaves become
 * discoverable as a list parallel to wall edges so the snap engine can
 * surface them as candidates for pergola `spatialKind: 'roof_edge'`
 * attachments. The eave line is the bottom of the roof on this side (where
 * the gutter sits, or where the gable wall meets the eave-level perimeter
 * on a non-draining edge); the snap engine aligns pergola edges to this
 * line and the user picks the attachment method (fascia / direct-to-soffit
 * / soffit brackets) separately in the inspector.
 *
 * `edgeKind` distinguishes the underlying topology:
 * - `drain_eave`: an eave with an adjacent roof plane that drains over it
 *   (gutters live here).
 * - `weather_flashed_edge`: a perimeter edge with no draining roof plane
 *   above it -- typically a gable end face of a hipped roof opened into a
 *   gable (Dutch hip), or a gable rake. Pergola attachment is still valid;
 *   gutter rendering is not. Downstream consumers that need drains only
 *   (gutter, flashing) re-filter on `edgeKind === 'drain_eave'`.
 * - `house_apron_edge`: an internal join edge of an L-/U-shape footprint.
 *
 * Coords are in world space after `applyAssemblyPosition3D` runs at the
 * boundary. When `assembly.house.position` is set the eave is in house-local
 * coords until the boundary translates it (milestone 12); when null the
 * legacy world-coord path applies.
 */
export type HouseRoofEave3D = {
  /** Stable id, scoped within the house model. Format: `roof-eave-${sourceEdgeId}`. */
  id: string;
  edgeKind: "drain_eave" | "weather_flashed_edge" | "house_apron_edge";
  /** Line at eave height (gutter line) — the canonical snap line. */
  eaveLine: Line3;
  /** Footprint edge id this eave is derived from. */
  sourceEdgeId: string;
  /** Roof plane this eave belongs to, when known. */
  sourceRoofPlaneId?: string | null;
};

export type HouseModel3D = {
  /**
   * Source house form id (matches `RawHouseInput.houseId` and
   * `HouseFormModel.id`). Required so the scene-assembly seam can prefix
   * derived scene-object ids by source house, eliminating duplicate-key
   * collisions when multiple house forms render into the same scene.
   * See `viewer.ts:buildHouseModelSceneObjects` for the prefixing logic
   * and `docs/design-workbench-architecture.md` § Object-First Model
   * for the broader "first-class spatial entities" invariant this serves.
   */
  houseId: string;
  footprint: Polygon3;
  wallSegments: HouseWallSegment3D[];
  roofPlanes: RoofPlane3D[];
  roofFeatures?: HouseRoofFeature3D[] | null;
  roofFlashings?: RoofFlashing3D[] | null;
  roofMaterial?: HouseRoofMaterial | null;
  roofMaterialVisuals?: HouseRoofMaterialVisual3D[] | null;
  decks?: HouseDeck3D[] | null;
  openings?: HouseOpening3D[] | null;
  solids?: HouseEnvelopeSolids3D | null;
  eave: HouseEaveGeometry3D;
  /** Roof eave snap targets (all attachable perimeter edges). See `HouseRoofEave3D`. */
  roofEaves?: HouseRoofEave3D[] | null;
  attachmentTarget?: HouseAttachmentTarget3D | null;
  /**
   * Workbench-configured ridge axis. Runtime hint for downstream
   * consumers (top-projection click-target enrichment, rail
   * derivations) that need to align on the active axis without a
   * per-plane heuristic. Excluded from `canonicalizeAssembly3D`
   * (golden hash) intentionally -- it reflects user intent, not
   * geometric identity. Joined-hipped roof planes carry alternating
   * x/y ridge metadata, so the per-plane fallback gave the wrong
   * axis on custom polygons.
   */
  roofRidgeAxis?: HouseRoofRidgeAxis | null;
  metadata?: GeometryMetadata;
};

/**
 * House-side references only. No derived drawing annotations belong here.
 */
export type HouseReferenceGeometry = {
  wallPlane?: Plane3 | null;
  fasciaLine?: Line3 | null;
  roofEdgeLine?: Line3 | null;
  soffitDepthMm?: number | null;
  footprint?: Polygon3 | null;
  model?: HouseModel3D | null;
  attachmentTarget?: HouseAttachmentTarget3D | null;
  /**
   * House first-class spatial position (milestone 12 of the spatial-entities
   * migration). When set, every coord in this `HouseReferenceGeometry` is in
   * **house-local** coords; `applyAssemblyPosition3D` reads this field and
   * translates the house into world coords as part of the same boundary
   * pass that translates the pergola. When null, the legacy world-coord
   * path applies — the house is already in world coords (built from a
   * pre-translated footprint) and `applyAssemblyPosition3D` skips it.
   *
   * Adding this field decouples house position from pergola position: a
   * project can have multiple houses, or a single house at a non-default
   * position, without depending on any pergola's frame.
   */
  position?: AssemblyPosition | null;
};

export type AssemblySupportCondition = {
  type: SupportConditionType;
  memberId: string;
  metadata?: GeometryMetadata;
};

export type QuantityHook = {
  key: string;
  quantity: number;
  unit: string;
};

export type GeometryQuantityTakeoffDiagnostic = {
  code: string;
  message: string;
};

export type GeometryQuantityTakeoffDimensionSet = {
  length: number;
  projection: number;
};

export type GeometryQuantityTakeoffMemberItem = {
  id: string;
  role: AssemblyMemberRole;
  lengthMm: number;
  lengthM: number;
  profile: AssemblyMemberProfile;
  profileKey: string;
  metadata?: GeometryMetadata;
};

export type GeometryQuantityTakeoffRoofPlane = {
  id: string;
  label?: string;
  areaMm2: number;
  areaM2: number;
  rafterCount: number;
  rafterBayCount: number;
  rafterProjectedRunMm: number | null;
  rafterProjectedRunM: number | null;
  rafterCutLengthMm: number | null;
  rafterCutLengthM: number | null;
  rafterTotalLengthMm: number;
  rafterTotalLengthM: number;
  rafterAverageLengthMm: number | null;
  rafterAverageLengthM: number | null;
  rafterAverageSpacingMm: number | null;
  rafterAverageSpacingM: number | null;
  claddingPanelCount: number;
  claddingAreaMm2: number;
  claddingAreaM2: number;
  claddingDownslopeLengthMm: number | null;
  claddingDownslopeLengthM: number | null;
  joinerCount: number;
  joinerTotalLengthMm: number;
  joinerTotalLengthM: number;
  joinerTargetLengthMm: number | null;
  joinerTargetLengthM: number | null;
  joinerAverageLengthMm: number | null;
  joinerAverageLengthM: number | null;
  metadata?: GeometryMetadata;
};

export type GeometryQuantityTakeoffRoofPlanes = {
  count: number;
  totalAreaMm2: number;
  totalAreaM2: number;
  items: GeometryQuantityTakeoffRoofPlane[];
};

export type GeometryQuantityTakeoffMemberBucket = {
  role: AssemblyMemberRole;
  count: number;
  totalLengthMm: number;
  totalLengthM: number;
  averageLengthMm: number | null;
  averageLengthM: number | null;
  firstProfile: AssemblyMemberProfile | null;
  profileKeys: string[];
  items: GeometryQuantityTakeoffMemberItem[];
};

export type GeometryQuantityTakeoffMembers = {
  totalCount: number;
  totalLengthMm: number;
  totalLengthM: number;
  items: GeometryQuantityTakeoffMemberItem[];
  byRole: Record<AssemblyMemberRole, GeometryQuantityTakeoffMemberBucket>;
};

export type GeometryQuantityTakeoffBeams = {
  ledgerLengthMm: number | null;
  ledgerLengthM: number | null;
  supportBeamLengthMm: number | null;
  supportBeamLengthM: number | null;
  ridgeLengthMm: number | null;
  ridgeLengthM: number | null;
  tieBeamLengthMm: number | null;
  tieBeamLengthM: number | null;
  totalBeamLengthMm: number | null;
  totalBeamLengthM: number | null;
  ledgerItems: GeometryQuantityTakeoffMemberItem[];
  supportBeamItems: GeometryQuantityTakeoffMemberItem[];
  ridgeItems: GeometryQuantityTakeoffMemberItem[];
  tieBeamItems: GeometryQuantityTakeoffMemberItem[];
};

export type GeometryQuantityTakeoffGutters = {
  ourGutterLengthMm: number | null;
  ourGutterLengthM: number | null;
  houseGutterLengthMm: number | null;
  houseGutterLengthM: number | null;
  totalLengthMm: number | null;
  totalLengthM: number | null;
  items: GeometryQuantityTakeoffMemberItem[];
  ourItems: GeometryQuantityTakeoffMemberItem[];
  houseItems: GeometryQuantityTakeoffMemberItem[];
};

export type GeometryQuantityTakeoffRoofCladdingMaterial = {
  material: RoofCladdingMaterial;
  panelCount: number;
  areaMm2: number;
  areaM2: number;
};

export type GeometryQuantityTakeoffRoofCladdingPanel = {
  id: string;
  material: RoofCladdingMaterial;
  areaMm2: number;
  areaM2: number;
  downslopeLengthMm: number;
  downslopeLengthM: number;
  projectedRunMm: number;
  projectedRunM: number;
  thicknessMm: number;
  roofPlaneId: string | null;
  metadata?: GeometryMetadata;
};

export type GeometryQuantityTakeoffRoofCladding = {
  panelCount: number;
  totalAreaMm2: number;
  totalAreaM2: number;
  effectiveRunMm: number | null;
  effectiveRunM: number | null;
  averageDownslopeLengthMm: number | null;
  averageDownslopeLengthM: number | null;
  acrylicRequiredDownslopeMm: number | null;
  acrylicRequiredDownslopeM: number | null;
  acrylicAreaMm2: number | null;
  acrylicAreaM2: number | null;
  items: GeometryQuantityTakeoffRoofCladdingPanel[];
  byMaterial: GeometryQuantityTakeoffRoofCladdingMaterial[];
};

export type GeometryQuantityTakeoffRafters = {
  count: number;
  totalLengthMm: number;
  totalLengthM: number;
  averageLengthMm: number | null;
  averageLengthM: number | null;
  averageProjectedRunMm: number | null;
  averageProjectedRunM: number | null;
  averageCutLengthMm: number | null;
  averageCutLengthM: number | null;
  effectiveRunMm: number | null;
  effectiveRunM: number | null;
  items: GeometryQuantityTakeoffMemberItem[];
};

export type GeometryQuantityTakeoffJoiners = {
  count: number;
  totalLengthMm: number;
  totalLengthM: number;
  averageLengthMm: number | null;
  averageLengthM: number | null;
  items: GeometryQuantityTakeoffMemberItem[];
};

export type GeometryQuantityTakeoffFlashingItem = {
  id: string;
  lengthMm: number;
  lengthM: number;
  girthMm: number | null;
  thicknessMm: number;
  wingCount: number;
  surfaceAreaMm2: number;
  surfaceAreaM2: number;
  metadata?: GeometryMetadata;
};

export type GeometryQuantityTakeoffFlashingGirthBucket = {
  girthMm: number | null;
  count: number;
  totalLengthMm: number;
  totalLengthM: number;
  totalSurfaceAreaMm2: number;
  totalSurfaceAreaM2: number;
  items: GeometryQuantityTakeoffFlashingItem[];
};

export type GeometryQuantityTakeoffFlashings = {
  count: number;
  totalLengthMm: number;
  totalLengthM: number;
  totalSurfaceAreaMm2: number;
  totalSurfaceAreaM2: number;
  items: GeometryQuantityTakeoffFlashingItem[];
  byGirthMm: Record<string, GeometryQuantityTakeoffFlashingGirthBucket>;
};

/**
 * Structured physical takeoff derived from Assembly3D.
 * This is geometry-owned physical truth only; pricing and BOM policy live in costing.
 */
export type GeometryQuantityTakeoff = {
  family: PergolaFamily;
  primaryDimensionsMm: GeometryQuantityTakeoffDimensionSet | null;
  primaryDimensionsM: GeometryQuantityTakeoffDimensionSet | null;
  secondaryDimensionsMm: GeometryQuantityTakeoffDimensionSet | null;
  secondaryDimensionsM: GeometryQuantityTakeoffDimensionSet | null;
  roofPlanes: GeometryQuantityTakeoffRoofPlanes;
  members: GeometryQuantityTakeoffMembers;
  rafters: GeometryQuantityTakeoffRafters;
  beams: GeometryQuantityTakeoffBeams;
  gutters: GeometryQuantityTakeoffGutters;
  roofCladding: GeometryQuantityTakeoffRoofCladding;
  joiners: GeometryQuantityTakeoffJoiners;
  flashings: GeometryQuantityTakeoffFlashings;
  quantityHooks: QuantityHook[];
  quantityHookMap: Record<string, number>;
  diagnostics: GeometryQuantityTakeoffDiagnostic[];
};

/**
 * Canonical structural 3D output for one spatial entity instance. This is
 * the geometry-owned source of truth.
 *
 * **Coordinate convention** — assembly-local: the family solver produces
 * coords with `datum.origin` at world `(0, 0, 0)` (assembly's local
 * origin). World space is reached by passing the assembly through
 * `applyAssemblyPosition3D` with the entity's world `position` (origin in
 * mm + rotation around +Z in degrees). When `position` is null the
 * post-solve transform is a no-op and the assembly is rendered at world
 * `(0, 0, 0)` — that's the legacy single-pergola path.
 *
 * **Plurality** — one project may carry many assemblies, one per spatial
 * entity (every pergola gets its own). Today the workbench solves
 * per-pergola module (`WorkbenchSolvedModule.assembly`), with the same
 * canonical house carried on each assembly's `house` field for legacy
 * compat. Step 5d's project-level reference shape aggregation
 * (`buildProjectReferenceShapes`) is the first consumer that operates on
 * the full list of assemblies; future slices retire the per-assembly
 * `house` duplication once a true project-level house input lands.
 *
 * **House transform** — milestone 12 closed audit row 5: `assembly.house`
 * carries its own `position` (independent of the pergola's `position`),
 * and `applyAssemblyPosition3D` translates the house at the boundary using
 * that position. When `assembly.house.position` is null the legacy world-
 * coord path applies (the house was pre-translated in `normalize.ts`).
 * The pergola transform and the house transform are independent: one can
 * be set without the other, and neither affects the other's output.
 */
export type Assembly3D = {
  family: PergolaFamily;
  datum: GeometryConfig["datum"];
  outline: Polygon3;
  attachmentEdge: Line3 | null;
  house: HouseReferenceGeometry;
  members: AssemblyMember3D[];
  roofPlanes: RoofPlane3D[];
  roofCladdingPanels: RoofCladdingPanel3D[];
  roofFlashings?: RoofFlashing3D[];
  supportConditions: AssemblySupportCondition[];
  quantityHooks: QuantityHook[];
  semantics: {
    connectionType: ConnectionType;
    roofType: PergolaFamily;
    structuralZones: string[];
    primaryDimensionsMm?: {
      length: number;
      projection: number;
    };
    secondaryDimensionsMm?: {
      length: number;
      projection: number;
    } | null;
  };
};

export type GeometryPlanMember2D = {
  id: string;
  role: AssemblyMemberRole;
  centerline: Line2;
  profile: AssemblyMemberProfile;
  lengthMm: number;
  metadata?: GeometryMetadata;
};

export type GeometryPlanSurface2D = {
  id: string;
  kind: "roof_plane" | "roof_cladding" | "house_footprint";
  boundary: Polygon2;
  metadata?: GeometryMetadata;
};

export type GeometryPlanHouseSurfaceKind =
  | "footprint"
  | "roof"
  | "soffit"
  | "fascia"
  | "deck"
  | "attachment_zone";

export type GeometryPlanHouseLineKind =
  | "wall_segment"
  | "roof_feature"
  | "gutter"
  | "attachment_target";

export type GeometryPlanHouseSurface2D = {
  id: string;
  kind: GeometryPlanHouseSurfaceKind;
  boundary: Polygon2;
  metadata?: GeometryMetadata;
};

export type GeometryPlanHouseLine2D = {
  id: string;
  kind: GeometryPlanHouseLineKind;
  line: Line2;
  metadata?: GeometryMetadata;
};

export type GeometryPlanRafterSpacingAnchor = {
  line: Line2;
  positionsMm: number[];
};

export type GeometryPlanViewModel = {
  family: PergolaFamily;
  connectionType: ConnectionType;
  roofForm: {
    mono: boolean;
    gable: boolean;
    box: boolean;
    hip?: boolean;
    hipCorner?: boolean;
  };
  outline: Polygon2;
  attachmentEdge: Line2 | null;
  house: {
    footprint: Polygon2 | null;
    fasciaLine: Line2 | null;
    roofEdgeLine: Line2 | null;
    wallReferenceLine: Line2 | null;
    surfaces?: GeometryPlanHouseSurface2D[];
    lines?: GeometryPlanHouseLine2D[];
  };
  members: {
    posts: GeometryPlanMember2D[];
    beams: GeometryPlanMember2D[];
    ledgers: GeometryPlanMember2D[];
    rafters: GeometryPlanMember2D[];
    gutters: GeometryPlanMember2D[];
    ridge: GeometryPlanMember2D[];
    joiners: GeometryPlanMember2D[];
  };
  surfaces: {
    roofPlanes: GeometryPlanSurface2D[];
    roofCladding: GeometryPlanSurface2D[];
  };
  anchors: {
    primarySize: {
      length: Line2 | null;
      projection: Line2 | null;
    };
    fall: {
      point: Point2;
      direction: Vector2;
      dual: boolean;
    } | null;
    rafterSpacing: GeometryPlanRafterSpacingAnchor | null;
    ridgeLine: Line2 | null;
    attachmentSide: {
      line: Line2;
    } | null;
  };
  extents: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    lengthMm: number;
    projectionMm: number;
  };
};

export type GeometryTopProjectionFamily = "pergola" | "house" | "reference";

export type GeometryTopProjectionSourceType =
  | ViewerSceneObject["type"]
  | "house_reference"
  | "pergola_reference";

export type GeometryTopProjectionShape = {
  id: string;
  sourceObjectId: string;
  sourceId?: string | null;
  sourceType: GeometryTopProjectionSourceType;
  family: GeometryTopProjectionFamily;
  kind: string;
  polygon: Polygon2;
  zOrder: number;
  zMin: number | null;
  zMax: number | null;
  metadata?: GeometryMetadata;
};

export type GeometryTopProjectionViewModel = {
  coordinateSpace: "world_xy_mm";
  screenAxis: {
    x: "world_x_right" | "world_x_left";
    y: "world_y_down";
  };
  shapes: GeometryTopProjectionShape[];
  extents: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    widthMm: number;
    heightMm: number;
  } | null;
};

export type GeometrySectionMember2D = {
  id: string;
  role: AssemblyMemberRole;
  projection: Line2;
  profile: AssemblyMemberProfile;
  metadata?: GeometryMetadata;
};

export type GeometrySectionLine2D = {
  id: string;
  kind: "roof_plane" | "roof_cladding" | "baseline" | "house_reference";
  line: Line2;
  metadata?: GeometryMetadata;
};

export type GeometrySectionHouseSurfaceKind =
  | "wall"
  | "roof"
  | "soffit"
  | "fascia"
  | "deck"
  | "attachment_zone";

export type GeometrySectionHouseLineKind =
  | "gutter"
  | "roof_feature"
  | "attachment_target"
  | "house_reference";

export type GeometrySectionHouseSurface2D = {
  id: string;
  kind: GeometrySectionHouseSurfaceKind;
  boundary: Polygon2;
  metadata?: GeometryMetadata;
};

export type GeometrySectionHouseLine2D = {
  id: string;
  kind: GeometrySectionHouseLineKind;
  line: Line2;
  metadata?: GeometryMetadata;
};

export type GeometrySectionViewModel = {
  family: PergolaFamily;
  connectionType: ConnectionType;
  sectionKind: "mono" | "gable";
  roofForm: {
    mono: boolean;
    gable: boolean;
    box: boolean;
    hip?: boolean;
    hipCorner?: boolean;
  };
  sliceXMm: number;
  baseline: Line2;
  house: {
    referenceLine: Line2 | null;
    surfaces?: GeometrySectionHouseSurface2D[];
    lines?: GeometrySectionHouseLine2D[];
  };
  members: {
    posts: GeometrySectionMember2D[];
    ledgers: GeometrySectionMember2D[];
    supportBeams: GeometrySectionMember2D[];
    gutters: GeometrySectionMember2D[];
    rafters: GeometrySectionMember2D[];
    ridge: GeometrySectionMember2D[];
    joiners: GeometrySectionMember2D[];
  };
  surfaces: {
    roofPlanes: GeometrySectionLine2D[];
    roofCladding: GeometrySectionLine2D[];
  };
  anchors: {
    span: Line2;
    leftEdgeHeight: { point: Point2; valueMm: number } | null;
    rightEdgeHeight: { point: Point2; valueMm: number } | null;
    ridgeHeight: { point: Point2; valueMm: number } | null;
    pitch: {
      point: Point2;
      degrees: number;
      fallDirection: RoofFallDirection;
    } | null;
  };
  metrics: {
    spanMm: number;
    leftEdgeHeightMm: number | null;
    rightEdgeHeightMm: number | null;
    ridgeHeightMm: number | null;
    pitchDeg: number | null;
    boxRiseMm: number | null;
  };
  extents: {
    minProjectionMm: number;
    maxProjectionMm: number;
    minHeightMm: number;
    maxHeightMm: number;
  };
};

export type GeometryValidationInvariant = {
  key: string;
  status: "pass" | "fail";
  message: string;
};

export type GeometryFixtureComparison = {
  fixtureId: string;
  status: "match" | "drift";
  message: string;
};

export type GeometryValidationReport = {
  status: "pass" | "fail" | "unsupported";
  invariants: GeometryValidationInvariant[];
  unsupportedReasons: string[];
  fixtureComparisons: GeometryFixtureComparison[];
};

export type ViewerSceneMemberRenderMode =
  | "prism"
  | "outline_extrusion"
  | "line_fallback";
export type ViewerSceneReferenceLineKind =
  | "attachment_edge"
  | "fascia"
  | "roof_edge";
export type ViewerSceneReferencePlaneKind = "house_wall";
export type ViewerSceneHouseSurfaceKind =
  | "wall"
  | "roof"
  | "soffit"
  | "fascia"
  | "deck"
  | "opening_marker"
  | "attachment_zone"
  | "attachment_plane";
export type ViewerSceneHouseLineKind =
  | "gutter"
  | "wall_segment"
  | "roof_outline"
  | "roof_feature"
  | "opening_outline"
  | "attachment_target";

export type ViewerSceneMemberPrismObject = {
  id: string;
  type: "member_prism";
  sourceId: string;
  role: AssemblyMemberRole;
  centerline: Line3;
  profile: AssemblyMemberProfile;
  localFrame: DatumFrame3;
  lengthMm: number;
  renderMode: ViewerSceneMemberRenderMode;
  endCuts?: AssemblyMemberEndCut[] | null;
  metadata?: GeometryMetadata;
};

export type ViewerSceneRoofPlaneObject = {
  id: string;
  type: "roof_plane";
  sourceId: string;
  boundary: Polygon3;
  plane: Plane3;
  fallVector: Vector3;
  metadata?: GeometryMetadata;
};

export type ViewerSceneRoofCladdingPanelObject = {
  id: string;
  type: "roof_cladding_panel";
  sourceId: string;
  material: RoofCladdingMaterial;
  boundary: Polygon3;
  thicknessMm: number;
  plane: Plane3;
  metadata?: GeometryMetadata;
};

export type ViewerSceneRoofFlashingObject = {
  id: string;
  type: "roof_flashing";
  sourceId: string;
  wings: RoofFlashingWing3D[];
  thicknessMm: number;
  metadata?: GeometryMetadata;
};

export type ViewerSceneHouseRoofMaterialObject = {
  id: string;
  type: "house_roof_material";
  sourceId: string;
  roofPlaneId: string;
  material: HouseRoofMaterial;
  profileKind: HouseRoofMaterialProfileKind;
  lines: Line3[];
  plane: Plane3;
  spacingMm: number;
  surfaceOffsetMm: number;
  metadata?: GeometryMetadata;
};

export type ViewerSceneReferenceLineObject = {
  id: string;
  type: "reference_line";
  sourceId?: string;
  kind: ViewerSceneReferenceLineKind;
  line: Line3;
  metadata?: GeometryMetadata;
};

export type ViewerSceneReferencePlaneObject = {
  id: string;
  type: "reference_plane";
  sourceId?: string;
  kind: ViewerSceneReferencePlaneKind;
  boundary: Polygon3;
  plane: Plane3;
  metadata?: GeometryMetadata;
};

export type ViewerSceneHouseSurfaceObject = {
  id: string;
  type: "house_surface";
  sourceId?: string;
  kind: ViewerSceneHouseSurfaceKind;
  boundary: Polygon3;
  plane: Plane3;
  metadata?: GeometryMetadata;
};

export type ViewerSceneHouseLineObject = {
  id: string;
  type: "house_line";
  sourceId?: string;
  kind: ViewerSceneHouseLineKind;
  line: Line3;
  metadata?: GeometryMetadata;
};

export type ViewerSceneHouseSurfaceSolidObject = {
  id: string;
  type: "house_surface_solid";
  sourceId?: string;
  kind: HouseSurfaceSolidKind;
  boundary: Polygon3;
  plane: Plane3;
  thicknessMm: number;
  renderMesh?: RenderMesh3D;
  metadata?: GeometryMetadata;
};

export type ViewerSceneHouseLinearSolidObject = {
  id: string;
  type: "house_linear_solid";
  sourceId?: string;
  kind: HouseLinearSolidKind;
  centerline: Line3;
  localFrame: DatumFrame3;
  profileWidthMm: number;
  profileDepthMm: number;
  renderMesh?: RenderMesh3D;
  metadata?: GeometryMetadata;
};

export type ViewerSceneObject =
  | ViewerSceneMemberPrismObject
  | ViewerSceneRoofPlaneObject
  | ViewerSceneRoofCladdingPanelObject
  | ViewerSceneRoofFlashingObject
  | ViewerSceneHouseRoofMaterialObject
  | ViewerSceneReferenceLineObject
  | ViewerSceneReferencePlaneObject
  | ViewerSceneHouseSurfaceObject
  | ViewerSceneHouseLineObject
  | ViewerSceneHouseSurfaceSolidObject
  | ViewerSceneHouseLinearSolidObject;

export type ViewerSceneLayer = {
  id: string;
  label: string;
  visibleByDefault: boolean;
  objects: ViewerSceneObject[];
};

/**
 * Hidden 3D viewer scene model derived directly from Assembly3D.
 */
export type ViewerSceneModel = {
  layers: ViewerSceneLayer[];
  metadata?: GeometryMetadata;
};
