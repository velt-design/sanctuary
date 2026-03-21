import type { CostOutputV1 } from '@sp/costing';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';

export type DrawingAssemblyFallVector = {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  source: 'plan_local';
};

export type DrawingAssemblyRoof = {
  pergolaStyle: CalculatorModuleInputs['pergolaStyle'];
  roofType: ModulePlanModel['roofType'] | ModuleSectionModel['roofType'] | null;
  sectionKind: ModuleSectionModel['sectionKind'] | null;
  boxPerimeterEnabled: boolean;
  slopeDirection: ModulePlanModel['slopeDirection'] | ModuleSectionModel['slopeDirection'] | null;
  fallVector: DrawingAssemblyFallVector;
  drawingRotationQuarterTurns: ModulePlanModel['drawingRotationQuarterTurns'] | 0;
  pitchDeg: number | null;
  overhangEnabled: boolean;
  overhangAmountM: number;
  footprint: {
    lengthA: number | null;
    spanA: number | null;
    lengthB: number | null;
    spanB: number | null;
  };
};

export type DrawingAssemblyHouseContext = {
  connectionType: CalculatorModuleInputs['houseConnectionType'];
  attachmentSide: ModulePlanModel['attachmentSide'] | ModuleSectionModel['attachmentSide'];
  supportsFootprints: boolean;
  footprintPreset: ModulePlanModel['houseFootprintPreset'] | null;
  footprintParams: ModulePlanModel['houseFootprintParams'] | null;
  attachmentEdgeLengthM: number | null;
  soffitBrackets: {
    offsetM: number | null;
    maxSpacingM: number | null;
    positionsM: number[];
    count: number;
  };
};

export type DrawingAssemblyStructure = {
  posts: {
    count: number | null;
    widthM: number | null;
    depthM: number | null;
  };
  rafters: {
    widthM: number | null;
    depthM: number | null;
    countA: number | null;
    spacingA: number | null;
    positionsA: number[];
    edgeLengthA: number | null;
    countB: number | null;
    spacingB: number | null;
    positionsB: number[];
  };
  ledgerBeam: {
    widthM: number | null;
    depthM: number | null;
  };
  supportBeam: {
    widthM: number | null;
    depthM: number | null;
  };
  gutter: {
    widthM: number | null;
    depthM: number | null;
  };
  ridgeBeam: {
    widthM: number | null;
    depthM: number | null;
    present: boolean;
  };
};

export type DrawingAssemblySupportConditions = {
  postConnectionType: CalculatorModuleInputs['postConnectionType'];
  houseConnectionType: CalculatorModuleInputs['houseConnectionType'];
  ground: CalculatorModuleInputs['ground'];
  postCount: number | null;
};

export type DrawingAssemblyCapabilities = {
  hasPlan: boolean;
  hasSection: boolean;
  supportsHouseFootprints: boolean;
  canEditHouseFootprint: boolean;
};

export type DrawingAssemblyModel = {
  id: string;
  label: string;
  moduleIndex: number;
  moduleInput: CalculatorModuleInputs;
  moduleResult: CostOutputV1 | null;
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
  roof: DrawingAssemblyRoof;
  houseContext: DrawingAssemblyHouseContext;
  structure: DrawingAssemblyStructure;
  supportConditions: DrawingAssemblySupportConditions;
  capabilities: DrawingAssemblyCapabilities;
};
