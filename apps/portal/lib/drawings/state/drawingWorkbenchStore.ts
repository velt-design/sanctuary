import type { ModuleViewsStatus } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import {
  buildPlanViewModel as buildGeometryPlanViewModel,
  buildSectionViewModel as buildGeometrySectionViewModel,
  normalizeGeometryConfig,
  solveAssembly3D,
} from '@sp/geometry';
import { buildAssemblyModel } from '@/lib/drawings/assembly/buildAssemblyModel';
import type { DrawingAssemblyModel } from '@/lib/drawings/assembly/types';
import { buildRawGeometryModuleInput } from '@/lib/drawings/geometry/buildRawGeometryModuleInput';
import { coerceHiddenWorkbenchGableBaseline } from '@/lib/drawings/geometry/hiddenWorkbenchGableBaseline';
import { resolveWorkbenchGeometryModule } from '@/lib/drawings/geometry/resolveWorkbenchGeometryModule';
import { buildLegacyModulePlanModelFromGeometry } from '@/lib/drawings/views/plan/buildLegacyModulePlanModelFromGeometry';
import { buildLegacyModuleSectionModelFromGeometry } from '@/lib/drawings/views/section/buildLegacyModuleSectionModelFromGeometry';
import { buildPlanViewModel, type PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import { buildEstimateDrawingModules, type EstimateDrawingModule } from '@/lib/estimates/moduleDrawing';
import { mergeEstimateDrawingDraftIntoSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { normalizeDrawingWorkbenchUiState, type DrawingWorkbenchUiState } from './drawingWorkbenchUiState';

export type DrawingWorkbenchModuleEntry = {
  id: string;
  label: string;
  drawingModule: EstimateDrawingModule;
  assemblyModel: DrawingAssemblyModel;
  planViewModel: PlanViewModel | null;
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
};

export type DrawingWorkbenchStore = {
  persisted: {
    snapshot: Record<string, unknown> | null;
    ignoreModuleResults: boolean;
    modules: DrawingWorkbenchModuleEntry[];
  };
  ui: DrawingWorkbenchUiState;
  derived: {
    moduleCount: number;
    activeModuleIndex: number;
    activeModule: DrawingWorkbenchModuleEntry | null;
    activeAssemblyModel: DrawingAssemblyModel | null;
    activePlanViewModel: PlanViewModel | null;
    activePlanModel: ModulePlanModel | null;
    activeSectionModel: ModuleSectionModel | null;
    activeModuleLabel: string;
    status: ModuleViewsStatus;
  };
};

function buildGeometryDerivedModels(input: {
  drawingModule: EstimateDrawingModule;
  moduleInput: EstimateDrawingModule['input'];
  moduleResult: EstimateDrawingModule['result'];
}): {
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
} {
  const rawInput = buildRawGeometryModuleInput({
    projectId: 'hidden-workbench-project',
    estimateId: 'hidden-workbench-estimate',
    designRequestId: null,
    moduleId: input.drawingModule.id,
    module: input.moduleInput,
    result: input.moduleResult,
  });
  const normalized = normalizeGeometryConfig(rawInput);
  if (!normalized.ok) {
    return {
      planModel: null,
      sectionModel: null,
    };
  }

  const solved = solveAssembly3D(normalized.value);
  if (!solved.ok) {
    return {
      planModel: null,
      sectionModel: null,
    };
  }

  const geometryPlan = buildGeometryPlanViewModel(solved.value);
  const geometrySection = buildGeometrySectionViewModel(solved.value);
  return {
    planModel: buildLegacyModulePlanModelFromGeometry({
      geometryPlan,
      module: input.moduleInput,
      fallbackMetadata: input.drawingModule.planModel,
    }),
    sectionModel: buildLegacyModuleSectionModelFromGeometry({
      geometrySection,
      module: input.moduleInput,
      fallbackMetadata: input.drawingModule.sectionModel,
    }),
  };
}

export function buildDrawingWorkbenchStore(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ui: DrawingWorkbenchUiState;
  ignoreModuleResults?: boolean;
  moduleLabels?: string[];
}): DrawingWorkbenchStore {
  const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, input.draft);
  const drawingModules = buildEstimateDrawingModules(effectiveSnapshot, {
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const ui = normalizeDrawingWorkbenchUiState(input.ui, drawingModules.length);
  const modules = drawingModules.map((drawingModule, index) => {
    const label = input.moduleLabels?.[index] ?? drawingModule.label;
    const geometryModule = coerceHiddenWorkbenchGableBaseline(drawingModule.input);
    const resolved = resolveWorkbenchGeometryModule({
      snapshot: input.snapshot,
      draft: input.draft,
      moduleIndex: index,
      ignoreModuleResults: input.ignoreModuleResults,
    });
    const resolvedDrawingModule: EstimateDrawingModule = {
      ...drawingModule,
      result: resolved.ok ? resolved.moduleResult : null,
    };
    const geometryModels = resolved.ok
      ? buildGeometryDerivedModels({
          drawingModule: resolvedDrawingModule,
          moduleInput: geometryModule,
          moduleResult: resolved.moduleResult,
        })
      : {
          planModel: null,
          sectionModel: null,
        };
    const assemblyModel = buildAssemblyModel({
      id: drawingModule.id,
      label,
      moduleIndex: index,
      moduleInput: geometryModule,
      moduleResult: resolvedDrawingModule.result,
      planModel: geometryModels.planModel,
      sectionModel: geometryModels.sectionModel,
    });

    return {
      id: drawingModule.id,
      label,
      drawingModule: resolvedDrawingModule,
      assemblyModel,
      planViewModel: buildPlanViewModel({
        moduleId: drawingModule.id,
        moduleLabel: label,
        planModel: geometryModels.planModel,
        canEditHouseFootprint: assemblyModel.capabilities.canEditHouseFootprint,
      }),
      planModel: geometryModels.planModel,
      sectionModel: geometryModels.sectionModel,
    };
  });

  const activeModule = modules[ui.activeModuleIndex] ?? null;

  return {
    persisted: {
      snapshot: effectiveSnapshot,
      ignoreModuleResults: Boolean(input.ignoreModuleResults),
      modules,
    },
    ui,
    derived: {
      moduleCount: modules.length,
      activeModuleIndex: ui.activeModuleIndex,
      activeModule,
      activeAssemblyModel: activeModule?.assemblyModel ?? null,
      activePlanViewModel: activeModule?.planViewModel ?? null,
      activePlanModel: activeModule?.planModel ?? null,
      activeSectionModel: activeModule?.sectionModel ?? null,
      activeModuleLabel: activeModule?.label ?? 'Module',
      status:
        ui.activeView === 'section'
          ? activeModule?.sectionModel
            ? 'ready'
            : 'empty'
          : activeModule?.planModel
            ? 'ready'
            : 'empty',
    },
  };
}
