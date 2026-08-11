import { suggestPergolaPostCountV1 } from '@sp/costing';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import { makeDefaultModule } from './calculatorInputs';

export type CalculatorJobTemplateKey =
  | 'attached_pitched_acrylic'
  | 'freestanding_pitched_acrylic'
  | 'attached_gable_acrylic';

type CalculatorJobTemplate = {
  key: CalculatorJobTemplateKey;
  label: string;
  description: string;
  buildModule: (pergolaId: string) => CalculatorModuleInputs;
};

function attachedPitchedAcrylic(pergolaId: string): CalculatorModuleInputs {
  return makeDefaultModule(pergolaId);
}

function freestandingPitchedAcrylic(pergolaId: string): CalculatorModuleInputs {
  return {
    ...makeDefaultModule(pergolaId),
    houseConnectionType: 'none',
    attachmentSide: 'rear',
    postCount: String(suggestPergolaPostCountV1(6, 'none')),
  };
}

function attachedGableAcrylic(pergolaId: string): CalculatorModuleInputs {
  return {
    ...makeDefaultModule(pergolaId),
    pergolaStyle: 'gable',
    internalRoofType: 'gable',
    projectionM: '4',
    roofPitchDeg: '',
    gableEndFramesMode: 'outer_end_only',
  };
}

export const CALCULATOR_JOB_TEMPLATES: CalculatorJobTemplate[] = [
  {
    key: 'attached_pitched_acrylic',
    label: 'Attached pitched acrylic · 6m × 3m',
    description: 'Facade connection, three suggested posts and standard acrylic starting selections.',
    buildModule: attachedPitchedAcrylic,
  },
  {
    key: 'freestanding_pitched_acrylic',
    label: 'Freestanding pitched acrylic · 6m × 3m',
    description: 'No house connection, three suggested posts on each support beam and standard acrylic starting selections.',
    buildModule: freestandingPitchedAcrylic,
  },
  {
    key: 'attached_gable_acrylic',
    label: 'Attached gable acrylic · 6m × 4m',
    description: 'Facade connection, acrylic roof and the configured default gable pitch.',
    buildModule: attachedGableAcrylic,
  },
];

export function applyCalculatorJobTemplate(
  values: CalculatorInputs,
  activeModuleIndex: number,
  templateKey: CalculatorJobTemplateKey,
): CalculatorInputs {
  const active = values.modules[activeModuleIndex];
  const template = CALCULATOR_JOB_TEMPLATES.find((entry) => entry.key === templateKey);
  if (!active || !template) return values;
  const pergolaId = active.pergolaId ?? values.pergolas?.[0]?.id ?? 'pergola-1';
  const modules = values.modules.slice();
  modules[activeModuleIndex] = template.buildModule(pergolaId);
  return { ...values, modules };
}
