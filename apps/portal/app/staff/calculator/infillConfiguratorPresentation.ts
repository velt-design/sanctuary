import type { InfillUiState, InfillWarningItem } from './infillCompute';

export type InfillConfiguratorStage = 'opening' | 'supports' | 'results';

export const INFILL_CONFIGURATOR_STAGES: Array<{ id: InfillConfiguratorStage; label: string }> = [
  { id: 'opening', label: 'Opening' },
  { id: 'supports', label: 'Existing supports' },
  { id: 'results', label: 'Results' },
];

export function stageForInfillWarning(warning: InfillWarningItem): InfillConfiguratorStage {
  return warning.target.section === 'supports' ? 'supports' : 'opening';
}

export function canVisitInfillStage(stage: InfillConfiguratorStage, openingComplete: boolean): boolean {
  return stage === 'opening' || openingComplete;
}

export function canOfferRafterMatching(location: string, openingWidthM: number, edgeLengthM: number): boolean {
  return (
    (location === 'front' || location === 'house') &&
    Number.isFinite(openingWidthM) &&
    openingWidthM > 0 &&
    Number.isFinite(edgeLengthM) &&
    edgeLengthM > 0 &&
    Math.abs(openingWidthM - edgeLengthM) <= 0.01
  );
}

export function isInfillOpeningComplete(ui: InfillUiState): boolean {
  const errors = ui.validation.errors;
  return ui.missingFields.length === 0 && ![
    errors.qty,
    errors.widthM,
    errors.heightM,
    errors.heightLowM,
    errors.heightHighM,
    errors.slopeDeg,
    errors.bottomOffsetM,
  ].some(Boolean);
}

export function infillResultStatus(ui: InfillUiState): {
  tone: 'ready' | 'needs_details' | 'blocked';
  title: string;
  message: string;
} {
  if (ui.estimate.takeoffStatus === 'blocked') {
    return {
      tone: 'blocked',
      title: 'Cannot manufacture',
      message: ui.estimate.takeoffWarnings[0]?.message ?? 'Review the highlighted opening or support details.',
    };
  }
  if (ui.status === 'draft') {
    return {
      tone: 'needs_details',
      title: 'Needs details',
      message: 'Complete the required opening measurements before reviewing the production result.',
    };
  }
  return {
    tone: 'ready',
    title: 'Ready',
    message: 'The pieces and purchase plan below are ready to use.',
  };
}

export function addedSupportSummary(count: number): string {
  if (count <= 0) return 'No additional 50×50 supports are required.';
  if (count === 1) return '1 additional 50×50 support is included in the purchase plan.';
  return `${count} additional 50×50 supports are included in the purchase plan.`;
}
