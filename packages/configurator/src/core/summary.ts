import type { CustomerPergolaConfigurationV1 } from './contracts';

export type CustomerConfigurationSummaryV1 = {
  compact: string;
  lines: Array<{
    label: string;
    value: string;
  }>;
};

const FAMILY_LABELS = {
  mono: 'Pitched',
  gable: 'Gable',
  hip: 'Hip',
  box: 'Box perimeter',
} as const;

const ROOF_LABELS = {
  acrylic: 'Acrylic',
  solid_timber_sarking: 'Solid timber sarking',
  mixed: 'Mixed acrylic and timber sarking',
} as const;

function formatMillimetres(value: number): string {
  return `${new Intl.NumberFormat('en-NZ').format(value)} mm`;
}

export function summarizeCustomerPergolaConfigurationV1(
  configuration: CustomerPergolaConfigurationV1,
): CustomerConfigurationSummaryV1 {
  const pergola = configuration.intent.pergola;
  const activeEdges = pergola.edgeTreatments.filter((edge) => edge.treatment.kind !== 'none');
  const placement = pergola.placement.mode === 'attached' ? 'Attached' : 'Freestanding';
  const family = FAMILY_LABELS[pergola.family];
  const roof = ROOF_LABELS[pergola.roof.system];

  return {
    compact: `${family}, ${formatMillimetres(pergola.dimensions.lengthMm)} x ${formatMillimetres(pergola.dimensions.projectionMm)}, ${placement.toLowerCase()}`,
    lines: [
      { label: 'Pergola form', value: family },
      {
        label: 'Size',
        value: `${formatMillimetres(pergola.dimensions.lengthMm)} x ${formatMillimetres(pergola.dimensions.projectionMm)}`,
      },
      { label: 'Approximate clear height', value: formatMillimetres(pergola.dimensions.clearHeightMm) },
      { label: 'Placement', value: placement },
      { label: 'Roof', value: roof },
      { label: 'Edge options', value: activeEdges.length === 0 ? 'None selected' : `${activeEdges.length} selected` },
      { label: 'Outdoor area level', value: configuration.intent.site.level },
    ],
  };
}
