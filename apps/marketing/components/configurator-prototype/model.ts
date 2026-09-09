import { createDefaultCustomerPergolaConfigurationV1 } from '@sp/configurator/core';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';

export const INITIAL_INPUT: SimpleCoverInput = {
  widthMm: 6000, projectionMm: 3000, level: 'ground', connection: 'facade',
};

// Owner-confirmed availability for this isolated customer preview.
export const PREVIEW_SOFFIT_MAX_PROJECTION_MM = 4000;
export function constrainPreviewConnection(input: SimpleCoverInput, family: 'mono'|'gable'|'box' = 'mono'): SimpleCoverInput {
  if (family === 'box' && (input.connection === 'fascia' || (input.connection === 'soffit' && input.projectionMm > PREVIEW_SOFFIT_MAX_PROJECTION_MM)))
    return { ...input, connection:'facade' };
  return input.connection === 'soffit' && input.projectionMm > PREVIEW_SOFFIT_MAX_PROJECTION_MM
    ? { ...input, connection: 'fascia' } : input;
}

// Map design choices only. Price and frozen calculation references stay in the
// existing Simple cover service; they are never geometry or customer intent.
export function configurationForSimpleCover(input: SimpleCoverInput) {
  const configuration = createDefaultCustomerPergolaConfigurationV1({
    configurationId: 'simple-cover-preview', timestamp: '2026-09-08T00:00:00.000Z',
  });
  configuration.intent.pergola.dimensions.lengthMm = input.widthMm;
  configuration.intent.pergola.dimensions.projectionMm = input.projectionMm;
  configuration.intent.pergola.placement.connectionIntent = input.connection === 'facade' ? 'wall' : input.connection;
  configuration.intent.site.level = input.level;
  return configuration;
}

export function sameSimpleCoverInput(a: SimpleCoverInput, b: SimpleCoverInput) {
  return a.widthMm === b.widthMm && a.projectionMm === b.projectionMm
    && a.connection === b.connection && a.level === b.level;
}

export const metres = (mm: number) => `${(mm / 1000).toFixed(1)} m`;
