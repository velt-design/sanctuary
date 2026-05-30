import { makeDefaultModule } from '@/app/staff/calculator/calculatorInputs';
import { makeDefaultFlashings } from '@/app/staff/calculator/calculatorFlashings';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import type { EstimateDrawingModule } from '@/lib/estimates/moduleDrawing';
import type {
  PergolaAttachment,
  PergolaObjectModel,
  WorkbenchProjectModel,
} from './objectFirstWorkbenchModel';

export type ObjectFirstPergolaSolveSource = {
  sourceKind: 'object_first_pergola';
  pergola: PergolaObjectModel;
  moduleInput: CalculatorModuleInputs;
};

function nonBlank(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function resolvePergolaFamilyFields(
  family: PergolaObjectModel['family'],
): Pick<CalculatorModuleInputs, 'pergolaStyle' | 'boxPerimeterEnabled' | 'internalRoofType'> {
  switch (family) {
    case 'gable':
      return { pergolaStyle: 'gable', boxPerimeterEnabled: false, internalRoofType: 'gable' };
    case 'hip':
      return { pergolaStyle: 'hip', boxPerimeterEnabled: false, internalRoofType: 'hip' };
    case 'hip_corner':
      return { pergolaStyle: 'hip_corner', boxPerimeterEnabled: false, internalRoofType: 'hip_corner' };
    case 'box':
      return { pergolaStyle: 'pitched', boxPerimeterEnabled: true, internalRoofType: 'pitched' };
    case 'mono':
    case 'unknown':
    default:
      return { pergolaStyle: 'pitched', boxPerimeterEnabled: false, internalRoofType: 'pitched' };
  }
}

function resolveConnectionFields(input: {
  attachment: PergolaAttachment | null | undefined;
  connectionKind: PergolaObjectModel['connectionKind'];
  strategy: PergolaObjectModel['strategy'];
}): Pick<CalculatorModuleInputs, 'houseConnectionType' | 'houseAttachmentStrategy'> {
  const attachment = input.attachment ?? null;
  if (attachment) {
    switch (attachment.spatialKind) {
      case 'wall':
        return { houseConnectionType: 'facade', houseAttachmentStrategy: 'facade_ledger' };
      case 'roof_edge':
        if (attachment.method === 'fascia_under_gutter') {
          return { houseConnectionType: 'fascia', houseAttachmentStrategy: 'fascia_under_gutter' };
        }
        return { houseConnectionType: 'soffit', houseAttachmentStrategy: 'soffit_brackets' };
      case 'pergola_outline':
      case 'freestanding':
      default:
        return { houseConnectionType: 'none', houseAttachmentStrategy: 'none' };
    }
  }

  switch (input.connectionKind) {
    case 'wall':
      return { houseConnectionType: 'facade', houseAttachmentStrategy: input.strategy ?? 'facade_ledger' };
    case 'fascia':
      return { houseConnectionType: 'fascia', houseAttachmentStrategy: input.strategy ?? 'fascia_under_gutter' };
    case 'soffit':
      return { houseConnectionType: 'soffit', houseAttachmentStrategy: input.strategy ?? 'soffit_brackets' };
    case 'freestanding':
    default:
      return { houseConnectionType: 'none', houseAttachmentStrategy: 'none' };
  }
}

function makeStableTransientFlashings(module: CalculatorModuleInputs, pergolaId: string): CalculatorModuleInputs['flashings'] {
  const flashings = makeDefaultFlashings(module);
  return {
    rows: flashings.rows.map((row, index) => ({
      ...row,
      id:
        index === 0
          ? `object-first:${pergolaId}:primary-flashing`
          : `object-first:${pergolaId}:flashing-${index + 1}`,
    })),
  };
}

function buildTransientModuleInput(input: {
  pergola: PergolaObjectModel;
}): CalculatorModuleInputs {
  const module = makeDefaultModule(input.pergola.id);
  const geometry = input.pergola.geometry ?? null;

  Object.assign(module, resolvePergolaFamilyFields(input.pergola.family));
  Object.assign(
    module,
    resolveConnectionFields({
      attachment: input.pergola.attachment,
      connectionKind: input.pergola.connectionKind,
      strategy: input.pergola.strategy,
    }),
  );

  module.pergolaId = input.pergola.id;
  module.attachmentSide = input.pergola.side;
  module.lengthM = nonBlank(geometry?.dimensions?.lengthM) ?? module.lengthM;
  module.projectionM = nonBlank(geometry?.dimensions?.projectionM) ?? module.projectionM;
  module.hipCornerLengthBM = nonBlank(geometry?.dimensions?.hipCornerLengthBM) ?? module.hipCornerLengthBM;
  module.hipCornerProjectionBM =
    nonBlank(geometry?.dimensions?.hipCornerProjectionBM) ?? module.hipCornerProjectionBM;
  module.roofMaterial = geometry?.roof?.material ?? module.roofMaterial;
  module.roofPitchDeg = nonBlank(geometry?.roof?.pitchDeg) ?? module.roofPitchDeg;
  module.boxPerimeterEnabled = geometry?.roof?.boxPerimeterEnabled ?? module.boxPerimeterEnabled;
  module.mixedAcrylicBaysMain =
    nonBlank(geometry?.roof?.mixedAcrylicBaysMain) ?? module.mixedAcrylicBaysMain;
  module.mixedAcrylicBaysA =
    nonBlank(geometry?.roof?.mixedAcrylicBaysA) ?? module.mixedAcrylicBaysA;
  module.mixedAcrylicBaysB =
    nonBlank(geometry?.roof?.mixedAcrylicBaysB) ?? module.mixedAcrylicBaysB;
  module.gableEndFramesMode = geometry?.gable?.endFramesMode ?? module.gableEndFramesMode;
  module.gableHouseEdgeGutter = geometry?.gable?.houseEaveGutterMode ?? module.gableHouseEdgeGutter;
  module.gableOuterEdgeGutter = geometry?.gable?.outerEaveGutterMode ?? module.gableOuterEdgeGutter;
  module.postConnectionType =
    geometry?.supports?.postConnectionType ?? module.postConnectionType;
  module.ground = geometry?.supports?.ground ?? module.ground;
  module.postCount = nonBlank(geometry?.supports?.postCount) ?? module.postCount;
  module.postCutHeightM = nonBlank(geometry?.supports?.postCutHeightM) ?? module.postCutHeightM;
  module.overrides = {
    ...(module.overrides ?? {}),
    ...(geometry?.overrides ?? {}),
  };

  if (module.houseConnectionType === 'none' && module.pergolaStyle === 'gable') {
    module.gableHouseEdgeGutter = 'our';
    module.gableOuterEdgeGutter = 'our';
  }

  module.flashings = makeStableTransientFlashings(module, input.pergola.id);

  return module;
}

function moduleBackedPergolaIds(drawingModules: ReadonlyArray<EstimateDrawingModule>): Set<string> {
  return new Set(
    drawingModules
      .map((module) => module.input.pergolaId)
      .filter((pergolaId): pergolaId is string => typeof pergolaId === 'string' && pergolaId.trim().length > 0),
  );
}

export function buildObjectFirstPergolaSolveSources(input: {
  projectModel: WorkbenchProjectModel;
  drawingModules: ReadonlyArray<EstimateDrawingModule>;
}): ObjectFirstPergolaSolveSource[] {
  const backedPergolaIds = moduleBackedPergolaIds(input.drawingModules);
  return input.projectModel.pergolas
    .filter((pergola) => !backedPergolaIds.has(pergola.id))
    .map((pergola) => ({
      sourceKind: 'object_first_pergola' as const,
      pergola,
      moduleInput: buildTransientModuleInput({
        pergola,
      }),
    }));
}

export function countObjectFirstPergolaSolveSources(input: {
  projectModel: WorkbenchProjectModel;
  drawingModules: ReadonlyArray<EstimateDrawingModule>;
}): number {
  const backedPergolaIds = moduleBackedPergolaIds(input.drawingModules);
  return input.projectModel.pergolas.filter((pergola) => !backedPergolaIds.has(pergola.id)).length;
}

export function buildCalculatorInputsForObjectFirstPergolaSolve(input: {
  baseInputs: CalculatorInputs | null;
  pergola: PergolaObjectModel;
  moduleInput: CalculatorModuleInputs;
}): CalculatorInputs {
  const baseInputs = input.baseInputs ?? {
    schemaVersion: 'v2' as const,
    projectName: 'Workbench',
    quoteRef: '',
    access: 'normal' as const,
    height: 'single_storey' as const,
    jobType: 'residential' as const,
    travelExGst: '0',
    extrasAllowanceExGst: '0',
    quoteDiscountPct: '0',
    pergolas: [],
    modules: [],
  };
  return {
    ...baseInputs,
    pergolas: [{ id: input.pergola.id, label: input.pergola.label }],
    modules: [input.moduleInput],
  };
}
