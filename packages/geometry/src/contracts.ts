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
export type PergolaFamily = 'mono' | 'gable' | 'box';

export type RoofMaterial = 'acrylic' | 'insulated' | 'timber' | 'louvre';
export type ConnectionType = 'fascia' | 'soffit' | 'wall' | 'freestanding';
export type AttachmentSide = 'left' | 'right' | 'rear' | 'front';
export type PostMode = 'standard' | 'custom';
export type FootingType = 'slab' | 'pier' | 'pile';
export type RoofFallDirection = 'positiveY' | 'negativeY' | 'dual';
export type GutterAssemblyMode = 'integrated' | 'separate' | 'none';
export type SupportConditionType = 'house_connection' | 'post_connection' | 'ground' | 'bracing' | 'custom';
export type AssemblyMemberRole = 'post' | 'beam' | 'ledger' | 'ridge' | 'rafter' | 'gutter' | 'brace';
export type ProfileShape = 'rectangular' | 'c-channel' | 'custom';
export type HouseFootprintPreset =
  | 'straight'
  | 'l_left'
  | 'l_right'
  | 'recess_left'
  | 'recess_right'
  | 'u_shape'
  | 'wrap_left'
  | 'wrap_right';

export type HouseFootprintParams = {
  bandDepthM: string;
  returnRunM: string;
  recessWidthM: string;
  recessDepthM: string;
  leftLegRunM: string;
  rightLegRunM: string;
  sideRunM: string;
};

export type RawPergolaStyle = 'pitched' | 'gable' | 'hip' | 'hip_corner' | 'box_perimeter';
export type RawRoofMaterial = 'acrylic' | 'timber' | 'mixed' | 'insulated' | 'louvre';
export type RawHouseConnectionType = 'soffit' | 'fascia' | 'facade' | 'none' | 'wall' | 'freestanding';
export type RawSlopeDirection = 'away_from_house' | 'toward_house';
export type RawPostConnectionType = 'pile_1m' | 'pile_1_5m' | 'deck_bracket' | 'slab_anchors';
export type RawGroundCondition = 'easy' | 'hard';
export type RawGableEndFramesMode = 'none' | 'outer_end_only' | 'both_ends';
export type RawGableEaveGutterMode = 'house' | 'our';
export type RawBoxGutterMode = 'house' | 'our' | 'none';

export type GeometryMetadataValue = string | number | boolean | null;
export type GeometryMetadata = Record<string, GeometryMetadataValue>;
export type GableEndFramesMode = RawGableEndFramesMode;
export type GableEaveGutterMode = RawGableEaveGutterMode;
export type BoxGutterMode = RawBoxGutterMode;

export type AssemblyMemberProfile = {
  shape: ProfileShape;
  widthMm: number;
  depthMm: number;
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
    footprintPreset?: HouseFootprintPreset | null;
    footprintParams?: HouseFootprintParams | null;
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
  };
};

/**
 * Structural member in world space. Heights and orientation must never be view-relative.
 */
export type AssemblyMember3D = {
  id: string;
  role: AssemblyMemberRole;
  centerline: Line3;
  profile: AssemblyMemberProfile;
  localFrame: DatumFrame3;
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

/**
 * House-side references only. No derived drawing annotations belong here.
 */
export type HouseReferenceGeometry = {
  wallPlane?: Plane3 | null;
  fasciaLine?: Line3 | null;
  roofEdgeLine?: Line3 | null;
  soffitDepthMm?: number | null;
  footprint?: Polygon3 | null;
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
  datum: GeometryConfig['datum'];
  outline: Polygon3;
  attachmentEdge: Line3 | null;
  house: HouseReferenceGeometry;
  members: AssemblyMember3D[];
  roofPlanes: RoofPlane3D[];
  supportConditions: AssemblySupportCondition[];
  quantityHooks: QuantityHook[];
  semantics: {
    connectionType: ConnectionType;
    roofType: PergolaFamily;
    structuralZones: string[];
  };
};

export type GeometryValidationInvariant = {
  key: string;
  status: 'pass' | 'fail';
  message: string;
};

export type GeometryFixtureComparison = {
  fixtureId: string;
  status: 'match' | 'drift';
  message: string;
};

export type GeometryValidationReport = {
  status: 'pass' | 'fail' | 'unsupported';
  invariants: GeometryValidationInvariant[];
  unsupportedReasons: string[];
  fixtureComparisons: GeometryFixtureComparison[];
};

export type ViewerSceneMemberRenderMode = 'prism' | 'line_fallback';
export type ViewerSceneReferenceLineKind = 'attachment_edge' | 'fascia' | 'roof_edge';
export type ViewerSceneReferencePlaneKind = 'house_wall';

export type ViewerSceneMemberPrismObject = {
  id: string;
  type: 'member_prism';
  sourceId: string;
  role: AssemblyMemberRole;
  centerline: Line3;
  profile: AssemblyMemberProfile;
  localFrame: DatumFrame3;
  lengthMm: number;
  renderMode: ViewerSceneMemberRenderMode;
  metadata?: GeometryMetadata;
};

export type ViewerSceneRoofPlaneObject = {
  id: string;
  type: 'roof_plane';
  sourceId: string;
  boundary: Polygon3;
  plane: Plane3;
  fallVector: Vector3;
  metadata?: GeometryMetadata;
};

export type ViewerSceneReferenceLineObject = {
  id: string;
  type: 'reference_line';
  sourceId?: string;
  kind: ViewerSceneReferenceLineKind;
  line: Line3;
  metadata?: GeometryMetadata;
};

export type ViewerSceneReferencePlaneObject = {
  id: string;
  type: 'reference_plane';
  sourceId?: string;
  kind: ViewerSceneReferencePlaneKind;
  boundary: Polygon3;
  plane: Plane3;
  metadata?: GeometryMetadata;
};

export type ViewerSceneObject =
  | ViewerSceneMemberPrismObject
  | ViewerSceneRoofPlaneObject
  | ViewerSceneReferenceLineObject
  | ViewerSceneReferencePlaneObject;

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
};
