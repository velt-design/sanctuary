import type { SimpleCoverHandoff } from './simpleCoverHandoff';

export function buildSimpleCoverEnquiryPayload(estimate: SimpleCoverHandoff | null) {
  const input = estimate?.input ?? null;
  const hasPricedReference = estimate?.status === 'priced' && Boolean(estimate.calculationRef);

  return {
    dimensions: {
      widthM: input && !hasPricedReference ? input.widthMm / 1_000 : null,
      depthM: input && !hasPricedReference ? input.projectionMm / 1_000 : null,
      heightM: null,
    },
    style: 'pitched',
    roofMaterials: ['acrylic'],
    calculationRef: hasPricedReference ? estimate?.calculationRef ?? null : null,
    simpleCoverStatus: estimate?.status ?? 'unconfigured',
    projectDetails: {
      simpleCover: input ? {
        status: estimate?.status ?? 'unconfigured',
        calculationAttached: estimate?.status === 'priced',
        ...(!hasPricedReference ? {
          deckLevel: input.level,
          connection: input.connection,
        } : {}),
      } : null,
    },
  };
}
