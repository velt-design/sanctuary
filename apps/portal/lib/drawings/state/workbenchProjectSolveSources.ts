import { solveProject, type Assembly3D, type GeometryConfig, type RawGeometryModuleInput, type RawHouseInput } from '@sp/geometry';
import type { EstimateDrawingModule } from '@/lib/estimates/moduleDrawing';
import {
  estimateDrawingDraftTouchesGeometry,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import { solveActiveGeometryModuleResult } from '@/lib/drawings/geometry/solveActiveGeometryModuleResult';
import {
  resolveWorkbenchGeometryModule,
  type WorkbenchGeometryModuleResolveResult,
} from '@/lib/drawings/geometry/resolveWorkbenchGeometryModule';
import { buildRawGeometryModuleInput } from '@/lib/drawings/geometry/buildRawGeometryModuleInput';
import { resolveModuleHouseForm } from '@/lib/drawings/geometry/resolveModuleHouseForm';
import { coerceHiddenWorkbenchGableBaseline } from '@/lib/drawings/geometry/hiddenWorkbenchGableBaseline';
import type { ObjectWorkbenchGeometryContext } from '@/lib/drawings/geometry/objectWorkbenchGeometryContext';
import { buildRawHouseInputFromHouseForm } from './houseFormRawGeometry';
import {
  buildCalculatorInputsForObjectFirstPergolaSolve,
  type ObjectFirstPergolaSolveSource,
} from './objectFirstPergolaSolveSources';
import type { HouseFormModel } from './objectFirstWorkbenchModel';

type WorkbenchProjectSolveSourceKind = 'drawing_module' | 'object_first_pergola';

export type WorkbenchProjectSolveSource = {
  index: number;
  label: string;
  sourceKind: WorkbenchProjectSolveSourceKind;
  drawingModule: EstimateDrawingModule;
  moduleResolution: WorkbenchGeometryModuleResolveResult;
  moduleInput: CalculatorModuleInputs | null;
  hostHouseForm: HouseFormModel | null;
  rawHouse: RawHouseInput | null;
  rawInput: RawGeometryModuleInput | null;
  projectSolveGroupKey: string | null;
};

export type WorkbenchProjectSolvedPergola = {
  source: 'project_solve';
  config: GeometryConfig;
  assembly: Assembly3D;
};

function buildObjectFirstPergolaModuleResolution(input: {
  snapshot: Record<string, unknown> | null;
  effectiveSnapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  baseInputs: CalculatorInputs | null;
  source: ObjectFirstPergolaSolveSource;
}): WorkbenchGeometryModuleResolveResult {
  const calculatorInputs = buildCalculatorInputsForObjectFirstPergolaSolve({
    baseInputs: input.baseInputs,
    pergola: input.source.pergola,
    moduleInput: input.source.moduleInput,
  });
  const draftTouchesGeometry = estimateDrawingDraftTouchesGeometry(input.draft, input.snapshot);
  const localResult = solveActiveGeometryModuleResult({
    calculatorInputs,
    moduleIndex: 0,
  });

  if (!localResult.ok) {
    return {
      ok: false,
      effectiveSnapshot: input.effectiveSnapshot,
      calculatorInputs,
      module: input.source.moduleInput,
      resultSource: 'local_resolve',
      draftTouchesGeometry,
      message: localResult.message,
    };
  }

  return {
    ok: true,
    effectiveSnapshot: input.effectiveSnapshot,
    calculatorInputs,
    module: input.source.moduleInput,
    moduleResult: localResult.moduleResult,
    resultSource: 'local_resolve',
    draftTouchesGeometry,
  };
}

function buildSourceRawInput(input: {
  index: number;
  label: string;
  sourceKind: WorkbenchProjectSolveSourceKind;
  drawingModule: EstimateDrawingModule;
  moduleResolution: WorkbenchGeometryModuleResolveResult;
  geometryIdentity: {
    projectId: string;
    estimateId: string;
    designRequestId: string | null;
  };
  geometryContext: ObjectWorkbenchGeometryContext;
  projectDecks: RawGeometryModuleInput['houseContext']['decks'];
  projectOpenings: RawGeometryModuleInput['houseContext']['openings'];
}): WorkbenchProjectSolveSource {
  const moduleInput = input.moduleResolution.module
    ? coerceHiddenWorkbenchGableBaseline(input.moduleResolution.module)
    : null;
  const hostHouseForm = moduleInput
    ? resolveModuleHouseForm({
        projectModel: input.geometryContext.projectModel ?? null,
        module: moduleInput,
        moduleId: input.drawingModule.id,
      })
    : null;
  const rawHouse = hostHouseForm ? buildRawHouseInputFromHouseForm(hostHouseForm) : null;
  const rawInput =
    input.moduleResolution.ok && moduleInput
      ? buildRawGeometryModuleInput({
          projectId: input.geometryIdentity.projectId,
          estimateId: input.geometryIdentity.estimateId,
          designRequestId: input.geometryIdentity.designRequestId,
          moduleId: input.drawingModule.id,
          module: moduleInput,
          result: input.moduleResolution.moduleResult,
          objectWorkbenchGeometryContext: input.geometryContext,
          projectDecks: input.projectDecks,
          projectOpenings: input.projectOpenings,
        })
      : null;

  return {
    index: input.index,
    label: input.label,
    sourceKind: input.sourceKind,
    drawingModule: input.drawingModule,
    moduleResolution: input.moduleResolution,
    moduleInput,
    hostHouseForm,
    rawHouse,
    rawInput,
    projectSolveGroupKey: rawHouse?.houseId ?? null,
  };
}

export function buildWorkbenchProjectSolveSources(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ignoreModuleResults?: boolean;
  moduleLabels?: string[];
  drawingModules: ReadonlyArray<EstimateDrawingModule>;
  objectFirstPergolaSources: ReadonlyArray<ObjectFirstPergolaSolveSource>;
  effectiveSnapshot: Record<string, unknown> | null;
  baseInputs: CalculatorInputs | null;
  geometryIdentity: {
    projectId: string;
    estimateId: string;
    designRequestId: string | null;
  };
  geometryContext: ObjectWorkbenchGeometryContext;
  projectDecks: RawGeometryModuleInput['houseContext']['decks'];
  projectOpenings: RawGeometryModuleInput['houseContext']['openings'];
}): WorkbenchProjectSolveSource[] {
  const sources: WorkbenchProjectSolveSource[] = input.drawingModules.map((drawingModule, index) =>
    buildSourceRawInput({
      index,
      label: input.moduleLabels?.[index] ?? drawingModule.label,
      sourceKind: 'drawing_module',
      drawingModule,
      moduleResolution: resolveWorkbenchGeometryModule({
        snapshot: input.snapshot,
        draft: input.draft,
        moduleIndex: index,
        ignoreModuleResults: input.ignoreModuleResults,
      }),
      geometryIdentity: input.geometryIdentity,
      geometryContext: input.geometryContext,
      projectDecks: input.projectDecks,
      projectOpenings: input.projectOpenings,
    }),
  );

  for (const source of input.objectFirstPergolaSources) {
    const index = sources.length;
    const moduleResolution = buildObjectFirstPergolaModuleResolution({
      snapshot: input.snapshot,
      effectiveSnapshot: input.effectiveSnapshot,
      draft: input.draft,
      baseInputs: input.baseInputs,
      source,
    });
    sources.push(
      buildSourceRawInput({
        index,
        label: source.pergola.label,
        sourceKind: 'object_first_pergola',
        drawingModule: {
          id: `object-pergola:${source.pergola.id}`,
          label: source.pergola.label,
          input: source.moduleInput,
          result: moduleResolution.ok ? moduleResolution.moduleResult : null,
          planModel: null,
          sectionModel: null,
        },
        moduleResolution,
        geometryIdentity: input.geometryIdentity,
        geometryContext: input.geometryContext,
        projectDecks: input.projectDecks,
        projectOpenings: input.projectOpenings,
      }),
    );
  }

  return sources;
}

export function solveWorkbenchProjectSources(
  sources: ReadonlyArray<WorkbenchProjectSolveSource>,
): Map<number, WorkbenchProjectSolvedPergola> {
  const groups = new Map<string, WorkbenchProjectSolveSource[]>();
  for (const source of sources) {
    if (!source.rawHouse || !source.rawInput || !source.projectSolveGroupKey) continue;
    const group = groups.get(source.projectSolveGroupKey) ?? [];
    group.push(source);
    groups.set(source.projectSolveGroupKey, group);
  }

  const solvedBySourceIndex = new Map<number, WorkbenchProjectSolvedPergola>();
  for (const group of groups.values()) {
    const rawHouse = group[0]?.rawHouse;
    if (!rawHouse) continue;
    const result = solveProject({
      rawHouse,
      rawPergolas: group.flatMap((source) => (source.rawInput ? [source.rawInput] : [])),
    });
    for (const pergolaResult of result.pergolas) {
      const source = group[pergolaResult.pergolaIndex];
      if (!source || !pergolaResult.ok) continue;
      solvedBySourceIndex.set(source.index, {
        source: 'project_solve',
        config: pergolaResult.config,
        assembly: pergolaResult.value,
      });
    }
  }
  return solvedBySourceIndex;
}
