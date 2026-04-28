import type {
  CalculatorDrawingRotationQuarterTurns,
  CalculatorHouseAttachmentStrategy,
  CalculatorHouseFootprintMode,
  CalculatorHouseFootprintParams,
  CalculatorHouseFootprintPolygonPoint,
  CalculatorHouseFootprintPreset,
  CalculatorHouseRoofMaterial,
  CalculatorHouseStoreyMode,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type {
  DeckElevationMode,
  DeckKind,
  DeckPresetType,
  DeckShape,
  DeckSurfaceMaterial,
  HouseAttachmentZoneKind,
  HouseRoofAppendageForm,
  HouseRoofForm,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  SliderPanelCount,
  WallOpeningKind,
} from './houseFirstWorkbenchModel';

export type WorkbenchObjectFamily = 'house_forms' | 'decks' | 'openings' | 'pergolas';

export type WorkbenchObjectRef = {
  family: WorkbenchObjectFamily;
  objectId: string | null;
};

export type HouseFormTransformModel = {
  offsetXM: number;
  offsetYM: number;
  rotationQuarterTurns: CalculatorDrawingRotationQuarterTurns;
};

export type HouseFormFootprintModel = {
  mode: CalculatorHouseFootprintMode;
  preset: CalculatorHouseFootprintPreset;
  params: CalculatorHouseFootprintParams;
  polygon: CalculatorHouseFootprintPolygonPoint[];
  attachmentSide: NonNullable<CalculatorModuleInputs['attachmentSide']>;
};

export type HouseFormRoofIntentModel = {
  form: HouseRoofForm;
  material: CalculatorHouseRoofMaterial;
  primaryPitchDeg: string;
  primaryFallDirection: HouseRoofPrimaryFallDirection;
  ridgeAxis: HouseRoofRidgeAxis;
  openGableEndIds: string[];
  appendage: {
    enabled: boolean;
    form: HouseRoofAppendageForm;
    hostEdge: NonNullable<CalculatorModuleInputs['attachmentSide']>;
    pitchDeg: string;
    dropMm: string;
  };
};

export type HouseFormModel = {
  id: string;
  label: string;
  transform: HouseFormTransformModel;
  footprint: HouseFormFootprintModel;
  roofIntent: HouseFormRoofIntentModel;
  storeyMode: CalculatorHouseStoreyMode;
  attachmentStrategy: CalculatorHouseAttachmentStrategy | null;
  eaveHeightM?: string | null;
  wallHeightM?: string | null;
  soffitDepthMm?: string | null;
  fasciaHeightMm?: string | null;
  gutterWidthMm?: string | null;
  gutterDepthMm?: string | null;
  gutterProjectionMm?: string | null;
  eaveOverhangMm?: string | null;
  sourceModuleIndexes?: number[];
  sourceModuleIds?: string[];
};

export type DerivedWallModel = {
  id: string;
  label: string;
  sourceFormIds: string[];
  hostEdgeIds: string[];
  kind: 'exterior';
  polygon: CalculatorHouseFootprintPolygonPoint[];
};

export type DerivedWallGraphModel = {
  walls: DerivedWallModel[];
  mergeGroups: Array<{
    id: string;
    sourceFormIds: string[];
    wallIds: string[];
  }>;
};

export type DerivedRoofZoneModel = {
  id: string;
  label: string;
  sourceFormIds: string[];
  boundary: CalculatorHouseFootprintPolygonPoint[];
};

export type DerivedAttachmentZoneModel = {
  id: string;
  label: string;
  kind: HouseAttachmentZoneKind;
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  sourceFormIds: string[];
  hostWallId: string | null;
  hostRoofZoneId: string | null;
};

export type DerivedBuildingEnvelopeModel = {
  mergedFormIds: string[];
  footprint: CalculatorHouseFootprintPolygonPoint[];
  wallGraph: DerivedWallGraphModel;
  roofZones: DerivedRoofZoneModel[];
  attachmentZones: DerivedAttachmentZoneModel[];
};

export type DeckObjectModel = {
  id: string;
  label: string;
  kind: DeckKind;
  shape: DeckShape;
  presetType: DeckPresetType | null;
  outline: CalculatorHouseFootprintPolygonPoint[];
  elevationMode: DeckElevationMode;
  levelOffsetMm: string;
  isAttached: boolean;
  surfaceMaterial: DeckSurfaceMaterial;
  hostEdgeId: string | null;
};

export type OpeningObjectModel = {
  id: string;
  label: string;
  kind: WallOpeningKind;
  panelCount: SliderPanelCount | null;
  hostWallId: string | null;
  sourceFormId?: string | null;
  widthM: string;
  heightM: string;
  sillHeightM: string;
  offsetAlongWallM: string;
};

export type PergolaObjectModel = {
  id: string;
  label: string;
  family: 'mono' | 'gable' | 'box' | 'hip' | 'hip_corner' | 'unknown';
  attachmentEdgeId: string | null;
  attachmentZoneId: string | null;
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  strategy: CalculatorHouseAttachmentStrategy | null;
};

export type HouseAssemblyModel = {
  id: string;
  label: string;
  houseForms: HouseFormModel[];
  derivedEnvelope: DerivedBuildingEnvelopeModel | null;
};

export type ObjectFirstWorkbenchProjectModel = {
  source: 'legacy_estimate_snapshot';
  houseAssembly: HouseAssemblyModel | null;
  decks: DeckObjectModel[];
  openings: OpeningObjectModel[];
  pergolas: PergolaObjectModel[];
  warnings: string[];
};

export type ObjectFirstWorkbenchDraftVNext = {
  houseAssembly?: {
    houseForms?: HouseFormModel[] | null;
  } | null;
  decks?: DeckObjectModel[] | null;
  openings?: OpeningObjectModel[] | null;
  pergolas?: PergolaObjectModel[] | null;
  ui?: {
    activeObjectFamily?: WorkbenchObjectFamily | null;
    activeObjectRef?: WorkbenchObjectRef | null;
  } | null;
};

// Migration boundary notes:
// - The current hidden workbench still runs from `houseFirstWorkbenchModel.ts`.
// - These object-first contracts are the canonical vNext type authority for future work.
// - This file does not imply dual-runtime support.
// - Persistence migration into `EstimateDrawingDraft` is intentionally deferred.
