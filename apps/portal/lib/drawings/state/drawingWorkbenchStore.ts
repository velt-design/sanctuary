import type { ModuleViewsStatus } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import { buildAssemblyModel } from '@/lib/drawings/assembly/buildAssemblyModel';
import type { DrawingAssemblyModel } from '@/lib/drawings/assembly/types';
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
    const assemblyModel = buildAssemblyModel({
      id: drawingModule.id,
      label,
      moduleIndex: index,
      moduleInput: drawingModule.input,
      moduleResult: drawingModule.result,
      planModel: drawingModule.planModel,
      sectionModel: drawingModule.sectionModel,
    });

    return {
      id: drawingModule.id,
      label,
      drawingModule,
      assemblyModel,
      planViewModel: buildPlanViewModel(assemblyModel),
      planModel: drawingModule.planModel,
      sectionModel: drawingModule.sectionModel,
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
      status: activeModule && (activeModule.planModel || activeModule.sectionModel) ? 'ready' : 'empty',
    },
  };
}
