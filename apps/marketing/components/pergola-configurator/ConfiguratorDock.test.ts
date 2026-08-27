import { describe, expect, it } from 'vitest';
import { createDefaultCustomerPergolaConfigurationV1 } from '@sp/configurator/core';
import { getConfiguratorDockSummary } from './ConfiguratorDock';

describe('ConfiguratorDock summary', () => {
  it('is concise, text-first and includes selected option count', () => {
    const configuration = createDefaultCustomerPergolaConfigurationV1({
      configurationId: '89cfd799-363c-4e4b-bac2-ac7409dcbc7f',
      timestamp: '2026-08-25T00:00:00.000Z',
    });
    expect(getConfiguratorDockSummary({
      ...configuration,
      intent: {
        ...configuration.intent,
        pergola: {
          ...configuration.intent.pergola,
          family: 'gable',
          dimensions: { lengthMm: 5_500, projectionMm: 4_200, clearHeightMm: 2_400 },
          lighting: { ...configuration.intent.pergola.lighting, ledStripInterest: true },
          roof: { system: 'mixed', tint: 'clear', layout: 'central_skylight_standard' },
        },
      },
    })).toBe('Gable · 5.5 × 4.2 m · Timber + acrylic · 1 option');
  });
});
