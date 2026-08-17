// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_CONFIGURATION_PATCH_V1,
  CUSTOMER_CONFIGURATION_SEED_V1,
  type CustomerConfigurationPatchV1,
  type CustomerConfigurationSeedV1,
} from './contracts';
import {
  applyCustomerConfigurationPatchV1,
  applyCustomerConfigurationSeedV1,
} from './patches';
import { summarizeCustomerPergolaConfigurationV1 } from './summary';
import { createTestCustomerConfiguration } from './testFixtures';

describe('customer configuration patches and seeds', () => {
  it('applies only typed customer intent and advances revision once', () => {
    const fixture = createTestCustomerConfiguration();
    const patch: CustomerConfigurationPatchV1 = {
      schemaVersion: CUSTOMER_CONFIGURATION_PATCH_V1,
      pergola: {
        family: 'gable',
        dimensions: { lengthMm: 5_000 },
        lighting: { downlights: 'subtle', dimmerRequested: true },
      },
    };
    const updated = applyCustomerConfigurationPatchV1(fixture, patch, {
      updatedAt: '2026-08-17T01:00:00.000Z',
    });

    expect(updated.revision).toBe(2);
    expect(updated.intent.pergola.family).toBe('gable');
    expect(updated.intent.pergola.dimensions).toEqual({
      lengthMm: 5_000,
      projectionMm: 3_000,
      clearHeightMm: 2_400,
    });
    expect(updated.intent.pergola.lighting).toEqual({
      downlights: 'subtle',
      dimmerRequested: true,
      ledStripInterest: false,
    });
  });

  it('records seed provenance without copying marketing content into the contract', () => {
    const seed: CustomerConfigurationSeedV1 = {
      schemaVersion: CUSTOMER_CONFIGURATION_SEED_V1,
      source: 'product_seed',
      sourceSlug: 'gable',
      patch: {
        schemaVersion: CUSTOMER_CONFIGURATION_PATCH_V1,
        pergola: { family: 'gable' },
      },
    };
    const updated = applyCustomerConfigurationSeedV1(
      createTestCustomerConfiguration(),
      seed,
      { updatedAt: '2026-08-17T01:00:00.000Z' },
    );

    expect(updated.source).toEqual({
      kind: 'product_seed',
      sourcePath: null,
      sourceSlug: 'gable',
    });
    expect(updated.intent.pergola.family).toBe('gable');
    expect(updated).not.toHaveProperty('marketingCopy');
  });

  it('produces a customer-safe textual summary without price or technical assumptions', () => {
    const summary = summarizeCustomerPergolaConfigurationV1(createTestCustomerConfiguration());
    const text = JSON.stringify(summary);

    expect(summary.compact).toContain('Pitched');
    expect(summary.lines.map((line) => line.label)).toContain('Approximate clear height');
    expect(text).not.toMatch(/price|rafter|post count|engineering/i);
  });
});
