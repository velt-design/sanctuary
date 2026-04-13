/**
 * Canonical Sanctuary geometry contracts.
 *
 * World-space coordinates are locked as:
 * - X = pergola length
 * - Y = projection away from the attachment edge
 * - Z = height
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
export type PergolaFamily = "mono" | "gable" | "box";

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
export type HouseRoofForm = "hipped";
export type HouseRoofFeatureKind = "ridge" | "hip" | "valley";
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
export type HouseFootprintMode = "preset" | "orthogonal_polygon";

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
  eaveHeightMm?: number | null;
  wallHeightMm?: number | null;
  roofPitchDeg?: number | null;
  eave?: HouseEaveConfig | null;
  attachmentStrategy?: HouseAttachmentStrategy | null;
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
    footprintMode?: HouseFootprintMode | null;
    footprintPreset?: HouseFootprintPreset | null;
    footprintParams?: HouseFootprintParams | null;
    footprintPolygon?: HouseFootprintPolygonPointInput[] | null;
    storeyMode?: HouseStoreyMode | null;
    wallConstruction?: HouseWallConstruction | null;
    roofForm?: HouseRoofForm | null;
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
  dimensions: {
    lengthMm: number;
    projectionMm: number;
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

export type HouseSurfaceSolidKind = "wall" | "roof" | "soffit" | "fascia";
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

export type HouseModel3D = {
  footprint: Polygon3;
  wallSegments: HouseWallSegment3D[];
  roofPlanes: RoofPlane3D[];
  roofFeatures?: HouseRoofFeature3D[] | null;
  solids?: HouseEnvelopeSolids3D | null;
  eave: HouseEaveGeometry3D;
  attachmentTarget?: HouseAttachmentTarget3D | null;
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

/**
 * Canonical structural 3D output. This is the only geometry truth.
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
  | "attachment_zone"
  | "attachment_plane";
export type ViewerSceneHouseLineKind =
  | "gutter"
  | "roof_outline"
  | "roof_feature"
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
