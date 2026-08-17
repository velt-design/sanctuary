import type {
  CustomerEdgeTreatmentV1,
  CustomerPergolaConfigurationV1,
} from './contracts';
import {
  CUSTOMER_CUSTOM_COLOUR_NAME_MAX_LENGTH,
  CUSTOMER_DIMENSION_BOUNDS,
  CUSTOMER_EDGE_IDS,
} from './options';

function normalizeDimension(
  value: number,
  field: keyof typeof CUSTOMER_DIMENSION_BOUNDS,
): number {
  const bounds = CUSTOMER_DIMENSION_BOUNDS[field];
  const integer = Math.round(Number.isFinite(value) ? value : bounds.minimum);
  return Math.min(bounds.maximum, Math.max(bounds.minimum, integer));
}

function normalizeEdges(
  treatments: CustomerEdgeTreatmentV1[],
  attachedEdge: CustomerEdgeTreatmentV1['edgeId'] | null,
): CustomerEdgeTreatmentV1[] {
  const byEdge = new Map(treatments.map((treatment) => [treatment.edgeId, treatment]));
  return CUSTOMER_EDGE_IDS.map((edgeId) => {
    if (edgeId === attachedEdge) return { edgeId, treatment: { kind: 'none' as const } };
    return byEdge.get(edgeId) ?? { edgeId, treatment: { kind: 'none' as const } };
  });
}

export function normalizeCustomerPergolaConfigurationV1(
  configuration: CustomerPergolaConfigurationV1,
): CustomerPergolaConfigurationV1 {
  const pergola = configuration.intent.pergola;
  const placement = pergola.placement;
  const frame = pergola.frame;
  const downlights = pergola.lighting.downlights;
  const attachedEdge = placement.mode === 'attached' ? placement.attachmentSide : null;
  const otherColourName = frame.finish === 'other'
    ? frame.otherColourName?.trim().replace(/\s+/g, ' ').slice(0, CUSTOMER_CUSTOM_COLOUR_NAME_MAX_LENGTH) ?? null
    : null;

  return {
    schemaVersion: configuration.schemaVersion,
    configurationId: configuration.configurationId,
    revision: Math.max(1, Math.round(configuration.revision)),
    createdAt: new Date(configuration.createdAt).toISOString(),
    updatedAt: new Date(configuration.updatedAt).toISOString(),
    source: { ...configuration.source },
    intent: {
      pergola: {
        id: 'pergola-1',
        family: pergola.family,
        dimensions: {
          lengthMm: normalizeDimension(pergola.dimensions.lengthMm, 'lengthMm'),
          projectionMm: normalizeDimension(pergola.dimensions.projectionMm, 'projectionMm'),
          clearHeightMm: normalizeDimension(pergola.dimensions.clearHeightMm, 'clearHeightMm'),
        },
        placement: {
          ...placement,
          connectionIntent: placement.mode === 'freestanding'
            ? 'none'
            : (placement.connectionIntent === 'none' ? 'unsure' : placement.connectionIntent),
        },
        frame: {
          finish: frame.finish,
          otherColourName,
        },
        roof: { ...pergola.roof },
        edgeTreatments: normalizeEdges(pergola.edgeTreatments, attachedEdge),
        lighting: {
          ...pergola.lighting,
          dimmerRequested: downlights === 'none' ? false : pergola.lighting.dimmerRequested,
        },
        heatingInterest: pergola.heatingInterest,
      },
      site: {
        level: configuration.intent.site.level,
        house: { ...configuration.intent.site.house },
      },
    },
  };
}
