import type { CostOutputV1 } from '@sp/costing';
import {
  buildPlanViewModel as buildGeometryPlanViewModel,
  buildSectionViewModel as buildGeometrySectionViewModel,
  buildTopProjectionViewModel as buildGeometryTopProjectionViewModel,
  normalizeGeometryConfig,
  solveAssembly3D,
  type Assembly3D,
  type GeometryConfig,
  type GeometryPlanViewModel,
  type GeometrySectionViewModel,
  type GeometryTopProjectionViewModel,
  type RawGeometryModuleInput,
} from '@sp/geometry';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import { buildRawGeometryModuleInput } from './buildRawGeometryModuleInput';
import { buildLegacyModulePlanModelFromGeometry } from '@/lib/drawings/views/plan/buildLegacyModulePlanModelFromGeometry';
import { buildLegacyModuleSectionModelFromGeometry } from '@/lib/drawings/views/section/buildLegacyModuleSectionModelFromGeometry';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { ObjectWorkbenchGeometryContext } from './objectWorkbenchGeometryContext';

export type WorkbenchPergolaRenderSource = 'geometry' | 'legacy';
export type WorkbenchPergolaRenderStatus =
  | 'geometry_ready'
  | 'legacy_unsupported_family'
  | 'invalid_geometry';

type WorkbenchGeometryDerivation =
  | {
      kind: 'geometry';
      renderSource: 'geometry';
      renderStatus: 'geometry_ready';
      config: GeometryConfig;
      assembly: Assembly3D;
      geometryPlan: GeometryPlanViewModel;
      geometrySection: GeometrySectionViewModel;
      geometryTopProjection: GeometryTopProjectionViewModel;
      planModel: ModulePlanModel;
      sectionModel: ModuleSectionModel;
    }
  | {
      kind: 'legacy_unsupported_family';
      renderSource: 'legacy';
      renderStatus: 'legacy_unsupported_family';
      code: 'unsupported_family';
      message: string;
      planModel: ModulePlanModel | null;
      sectionModel: ModuleSectionModel | null;
    }
  | {
      kind: 'invalid_geometry';
      renderSource: 'legacy';
      renderStatus: 'invalid_geometry';
      stage: 'normalize' | 'solve';
      code?: string;
      message: string;
    };

export function deriveWorkbenchGeometry(input: {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  moduleId: string;
  module: CalculatorModuleInputs;
  result: CostOutputV1 | null;
  objectWorkbenchGeometryContext?: ObjectWorkbenchGeometryContext | null;
  fallbackPlanModel?: ModulePlanModel | null;
  fallbackSectionModel?: ModuleSectionModel | null;
  /**
   * PR-G3b (2026-05-22): pre-computed project-level decks/openings, passed
   * through to `buildRawGeometryModuleInput` so a multi-module project
   * computes them once instead of M times.
   */
  projectDecks?: RawGeometryModuleInput['houseContext']['decks'];
  projectOpenings?: RawGeometryModuleInput['houseContext']['openings'];
  rawInput?: RawGeometryModuleInput | null;
  projectSolveResult?: { config: GeometryConfig; assembly: Assembly3D } | null;
}): WorkbenchGeometryDerivation {
  const rawInput =
    input.rawInput ??
    buildRawGeometryModuleInput({
      projectId: input.projectId,
      estimateId: input.estimateId,
      designRequestId: input.designRequestId ?? null,
      moduleId: input.moduleId,
      module: input.module,
      result: input.result,
      objectWorkbenchGeometryContext: input.objectWorkbenchGeometryContext ?? null,
      projectDecks: input.projectDecks,
      projectOpenings: input.projectOpenings,
    });
  const normalized = input.projectSolveResult
    ? { ok: true as const, value: input.projectSolveResult.config }
    : normalizeGeometryConfig(rawInput);

  if (!normalized.ok) {
    if (normalized.code === 'unsupported_family') {
      return {
        kind: 'legacy_unsupported_family',
        renderSource: 'legacy',
        renderStatus: 'legacy_unsupported_family',
        code: 'unsupported_family',
        message: normalized.error,
        planModel: input.fallbackPlanModel ?? null,
        sectionModel: input.fallbackSectionModel ?? null,
      };
    }

    return {
      kind: 'invalid_geometry',
      renderSource: 'legacy',
      renderStatus: 'invalid_geometry',
      stage: 'normalize',
      code: normalized.code,
      message: normalized.error,
    };
  }

  const solved = input.projectSolveResult
    ? { ok: true as const, value: input.projectSolveResult.assembly }
    : solveAssembly3D(normalized.value);
  if (!solved.ok) {
    return {
      kind: 'invalid_geometry',
      renderSource: 'legacy',
      renderStatus: 'invalid_geometry',
      stage: 'solve',
      message: solved.error,
    };
  }

  const geometryPlan = buildGeometryPlanViewModel(solved.value);
  const geometrySection = buildGeometrySectionViewModel(solved.value);
  const geometryTopProjection = buildGeometryTopProjectionViewModel(solved.value);
  return {
    kind: 'geometry',
    renderSource: 'geometry',
    renderStatus: 'geometry_ready',
    config: normalized.value,
    assembly: solved.value,
    geometryPlan,
    geometrySection,
    geometryTopProjection,
    planModel: buildLegacyModulePlanModelFromGeometry({
      geometryPlan,
      module: input.module,
      fallbackMetadata: input.fallbackPlanModel ?? null,
    }),
    sectionModel: buildLegacyModuleSectionModelFromGeometry({
      geometrySection,
      module: input.module,
      fallbackMetadata: input.fallbackSectionModel ?? null,
    }),
  };
}
