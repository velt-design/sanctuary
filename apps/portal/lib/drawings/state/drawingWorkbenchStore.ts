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
import { buildLegacyModulePlanModelFromGeometry } from '@/lib/drawings/views/plan/buildLegacyModulePlanModelFromGeometry';
import { buildLegacyModuleSectionModelFromGeometry } from '@/lib/drawings/views/section/buildLegacyModuleSectionModelFromGeometry';
import { buildPlanViewModel, type PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import { buildEstimateDrawingModules, type EstimateDrawingModule } from '@/lib/estimates/moduleDrawing';
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
}): {
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
} {
  const rawInput = buildRawGeometryModuleInput({
    projectId: 'hidden-workbench-project',
    estimateId: 'hidden-workbench-estimate',
    designRequestId: null,
    moduleId: input.drawingModule.id,
    module: input.drawingModule.input,
    result: input.drawingModule.result,
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
      module: input.drawingModule.input,
      fallbackMetadata: input.drawingModule.planModel,
    }),
    sectionModel: buildLegacyModuleSectionModelFromGeometry({
      geometrySection,
      module: input.drawingModule.input,
      fallbackMetadata: input.drawingModule.sectionModel,
    }),
  };
}

export function buildDrawingWorkbenchStore(input: {
  snapshot: Record<string, unknown> | null;
  ui: DrawingWorkbenchUiState;
  ignoreModuleResults?: boolean;
  moduleLabels?: string[];
}): DrawingWorkbenchStore {
  const drawingModules = buildEstimateDrawingModules(input.snapshot, {
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const ui = normalizeDrawingWorkbenchUiState(input.ui, drawingModules.length);
  const modules = drawingModules.map((drawingModule, index) => {
    const label = input.moduleLabels?.[index] ?? drawingModule.label;
    const geometryModels = buildGeometryDerivedModels({
      drawingModule,
    });
    const assemblyModel = buildAssemblyModel({
      id: drawingModule.id,
      label,
      moduleIndex: index,
      moduleInput: drawingModule.input,
      moduleResult: drawingModule.result,
      planModel: geometryModels.planModel,
      sectionModel: geometryModels.sectionModel,
    });

    return {
      id: drawingModule.id,
      label,
      drawingModule,
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
      snapshot: input.snapshot,
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
