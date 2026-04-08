/**
 * Legacy 2D drawing-oriented contracts preserved for incremental migration only.
 * These types are not the canonical geometry truth.
 */

export type LegacyPoint2 = {
  x: number;
  y: number;
};

export type LegacyVector2 = {
  x: number;
  y: number;
};

export type LegacyLine2 = {
  start: LegacyPoint2;
  end: LegacyPoint2;
};

export type LegacyPolygon2 = LegacyPoint2[];

export type LegacyEdgeRef = {
  ring: 'outer' | 'inner';
  index: number;
  id?: string;
};

export type LegacyPergolaType = 'mono' | 'gable' | 'box';
export type LegacyRoofMaterial = 'acrylic' | 'insulated' | 'timber' | 'louvre';
export type LegacyDrawingView = 'plan' | 'section' | 'elevation' | 'detail';
export type LegacyViewportMode = 'model' | 'sheet';
export type LegacyConnectionType = 'fascia' | 'soffit' | 'wall' | 'freestanding';
export type LegacyAttachmentSide = 'left' | 'right' | 'rear' | 'front';
export type LegacyPostMode = 'standard' | 'custom';

export type LegacyRoofConfig = {
  material: LegacyRoofMaterial;
  mode?: string | null;
};

export type LegacyConnectionConfig = {
  type: LegacyConnectionType;
  attachmentSide?: LegacyAttachmentSide | null;
};

export type LegacySupportPosition = {
  x: number;
  y: number;
};

export type LegacySupportsConfig = {
  postMode: LegacyPostMode;
  postPositions?: LegacySupportPosition[];
};

export type LegacyHouseContextInput = {
  wallLine?: LegacyLine2 | null;
  fasciaLine?: LegacyLine2 | null;
  soffitDepthMm?: number | null;
  roofEdgeLine?: LegacyLine2 | null;
  footprint?: LegacyPolygon2 | null;
};

export type LegacyGeometryConfig = {
  projectId: string;
  estimateId: string;
  designRequestId: string;
  pergolaType: LegacyPergolaType;
  widthMm: number;
  projectionMm: number;
  roofPitchDeg?: number | null;
  roof: LegacyRoofConfig;
  connection: LegacyConnectionConfig;
  supports: LegacySupportsConfig;
  houseContext: LegacyHouseContextInput;
  viewState: {
    activeView: LegacyDrawingView;
    viewportMode: LegacyViewportMode;
  };
};

export type LegacyProfileMm = {
  widthMm: number;
  depthMm: number;
};

export type LegacyStructuralZone = {
  id: string;
  label: string;
  polygon: LegacyPolygon2;
};

export type LegacyMonoRoofForm = {
  kind: 'mono';
  outline: LegacyPolygon2;
  pitchDeg: number | null;
  eaveLine: LegacyLine2 | null;
  fallDirection: LegacyVector2;
  boxPerimeter: false;
};

export type LegacyGableRoofForm = {
  kind: 'gable';
  outline: LegacyPolygon2;
  pitchDeg: number | null;
  ridgeLine: LegacyLine2 | null;
  fallDirectionLeft: LegacyVector2;
  fallDirectionRight: LegacyVector2;
  boxPerimeter: false;
};

export type LegacyBoxRoofForm = {
  kind: 'box';
  outline: LegacyPolygon2;
  pitchDeg: number | null;
  perimeterEdges: LegacyEdgeRef[];
  innerFallDirection: LegacyVector2;
  boxPerimeter: true;
};

export type LegacyRoofForm = LegacyMonoRoofForm | LegacyGableRoofForm | LegacyBoxRoofForm;

export type LegacyHouseContextModel = {
  connectionType: LegacyConnectionType;
  attachmentSide: LegacyAttachmentSide | null;
  attachmentEdge: LegacyEdgeRef | null;
  wallLine?: LegacyLine2 | null;
  fasciaLine?: LegacyLine2 | null;
  roofEdgeLine?: LegacyLine2 | null;
  soffitDepthMm?: number | null;
  footprint?: LegacyPolygon2 | null;
};

export type LegacyPostRole = 'corner' | 'intermediate' | 'custom';

export type LegacyPostMember = {
  id: string;
  basePoint: LegacyPoint2;
  topPoint?: LegacyPoint2 | null;
  profile?: LegacyProfileMm | null;
  role: LegacyPostRole;
};

export type LegacyBeamRole = 'ledger' | 'support' | 'ridge' | 'box_perimeter' | 'tie';

export type LegacyBeamMember = {
  id: string;
  line: LegacyLine2;
  profile?: LegacyProfileMm | null;
  role: LegacyBeamRole;
};

export type LegacyRafterMember = {
  id: string;
  line: LegacyLine2;
  profile?: LegacyProfileMm | null;
  spacingMm?: number | null;
  zoneId?: string | null;
};

export type LegacyGutterEdge = 'house' | 'outer' | 'left' | 'right';

export type LegacyGutterMember = {
  id: string;
  line: LegacyLine2;
  profile?: LegacyProfileMm | null;
  edge: LegacyGutterEdge;
};

export type LegacySupportConditionKind = 'house_connection' | 'post_connection' | 'ground' | 'bracing' | 'custom';

export type LegacySupportCondition = {
  id: string;
  kind: LegacySupportConditionKind;
  label: string;
  value: string;
};

export type LegacyFallModel = {
  direction: LegacyVector2;
  label: 'FALL';
  source: 'roof_form' | 'connection' | 'input';
  magnitudeMm?: number | null;
};

export type LegacyAssemblySemantics = {
  connectionType: LegacyConnectionType;
  roofType: LegacyPergolaType;
  structuralZones: LegacyStructuralZone[];
  detailFamilies: string[];
};

export type LegacyAssemblyModel = {
  outline: LegacyPolygon2;
  roofForm: LegacyRoofForm;
  attachmentEdge: LegacyEdgeRef | null;
  houseContext: LegacyHouseContextModel;
  posts: LegacyPostMember[];
  beams: LegacyBeamMember[];
  rafters: LegacyRafterMember[];
  gutters: LegacyGutterMember[];
  supports: LegacySupportCondition[];
  fall: LegacyFallModel;
  semantics: LegacyAssemblySemantics;
};
