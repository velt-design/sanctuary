import {
  CUSTOMER_PERGOLA_CONFIGURATION_V1,
  type CustomerPergolaConfigurationV1,
} from './contracts';
import { CUSTOMER_EDGE_IDS } from './options';

export type CreateDefaultCustomerConfigurationOptions = {
  configurationId: string;
  timestamp: string;
};

export function createDefaultCustomerPergolaConfigurationV1({
  configurationId,
  timestamp,
}: CreateDefaultCustomerConfigurationOptions): CustomerPergolaConfigurationV1 {
  return {
    schemaVersion: CUSTOMER_PERGOLA_CONFIGURATION_V1,
    configurationId,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    source: {
      kind: 'blank',
      sourcePath: null,
      sourceSlug: null,
    },
    intent: {
      pergola: {
        id: 'pergola-1',
        family: 'mono',
        dimensions: {
          lengthMm: 4_000,
          projectionMm: 3_000,
          clearHeightMm: 2_400,
        },
        placement: {
          mode: 'attached',
          attachmentSide: 'rear',
          connectionIntent: 'unsure',
        },
        frame: {
          finish: 'black',
          otherColourName: null,
        },
        roof: {
          system: 'acrylic',
          tint: 'clear',
        },
        edgeTreatments: CUSTOMER_EDGE_IDS.map((edgeId) => ({
          edgeId,
          treatment: { kind: 'none' as const },
        })),
        lighting: {
          downlights: 'none',
          dimmerRequested: false,
          ledStripInterest: false,
        },
        heatingInterest: 'none',
      },
      site: {
        level: 'ground',
        house: {
          present: true,
          footprint: 'straight',
          storeys: 'one',
          roofForm: 'hipped',
        },
      },
    },
  };
}
