import type { CostOutputV1 } from '@sp/costing';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { HouseModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import { buildObjectFirstWorkbenchProjectModel } from '@/lib/drawings/state/objectFirstWorkbenchAdapter';
import type { WorkbenchProjectModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  deriveWorkbenchGeometry as deriveObjectFirstWorkbenchGeometry,
  type WorkbenchGeometryDerivation,
} from '../deriveWorkbenchGeometry';
import type { ObjectWorkbenchGeometryContext } from './objectWorkbenchGeometryContext';

export type {
  WorkbenchGeometryDerivation,
  WorkbenchPergolaRenderSource,
  WorkbenchPergolaRenderStatus,
} from '../deriveWorkbenchGeometry';

function buildProjectModelFromCompatibilityHouse(
  house: HouseModel | null | undefined,
): WorkbenchProjectModel | null {
  if (!house) return null;
  return buildObjectFirstWorkbenchProjectModel({
    compatibilityProjectModel: {
      source: 'legacy_estimate_snapshot',
      house,
      pergolas: [],
      warnings: [],
    },
  });
}

export function deriveWorkbenchGeometry(input: {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  moduleId: string;
  module: CalculatorModuleInputs;
  result: CostOutputV1 | null;
  objectWorkbenchGeometryContext?: ObjectWorkbenchGeometryContext | null;
  sharedHouse?: HouseModel | null;
  fallbackPlanModel?: ModulePlanModel | null;
  fallbackSectionModel?: ModuleSectionModel | null;
}): WorkbenchGeometryDerivation {
  const projectModel =
    input.objectWorkbenchGeometryContext?.projectModel ??
    buildProjectModelFromCompatibilityHouse(input.objectWorkbenchGeometryContext?.house ?? input.sharedHouse);

  return deriveObjectFirstWorkbenchGeometry({
    projectId: input.projectId,
    estimateId: input.estimateId,
    designRequestId: input.designRequestId ?? null,
    moduleId: input.moduleId,
    module: input.module,
    result: input.result,
    objectWorkbenchGeometryContext: {
      projectModel,
    },
    fallbackPlanModel: input.fallbackPlanModel ?? null,
    fallbackSectionModel: input.fallbackSectionModel ?? null,
  });
}
