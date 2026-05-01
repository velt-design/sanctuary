import type { CostOutputV1 } from '@sp/costing';
import type { RawGeometryModuleInput } from '@sp/geometry';
import type { HouseModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import { buildObjectFirstWorkbenchProjectModel } from '@/lib/drawings/state/legacyObjectFirstCompatibilityAdapter';
import type { WorkbenchProjectModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  buildRawGeometryModuleInput as buildObjectFirstRawGeometryModuleInput,
} from '../buildRawGeometryModuleInput';
import type { ObjectWorkbenchGeometryContext } from './objectWorkbenchGeometryContext';

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

export function buildRawGeometryModuleInput(input: {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
  moduleId?: string | null;
  module: CalculatorModuleInputs;
  result: CostOutputV1 | null;
  objectWorkbenchGeometryContext?: ObjectWorkbenchGeometryContext | null;
  sharedHouse?: HouseModel | null;
}): RawGeometryModuleInput {
  const projectModel =
    input.objectWorkbenchGeometryContext?.projectModel ??
    buildProjectModelFromCompatibilityHouse(input.objectWorkbenchGeometryContext?.house ?? input.sharedHouse);

  return buildObjectFirstRawGeometryModuleInput({
    projectId: input.projectId,
    estimateId: input.estimateId,
    designRequestId: input.designRequestId ?? null,
    moduleId: input.moduleId ?? null,
    module: input.module,
    result: input.result,
    objectWorkbenchGeometryContext: {
      projectModel,
    },
  });
}
