// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { safeParseCustomerPergolaConfigurationV1 } from './parser';
import { createTestCustomerConfiguration } from './testFixtures';

function cloneFixture(): Record<string, any> {
  return JSON.parse(JSON.stringify(createTestCustomerConfiguration()));
}

describe('customer configuration parser', () => {
  it('accepts the canonical V1 fixture without changing its shape', () => {
    const fixture = createTestCustomerConfiguration();
    const result = safeParseCustomerPergolaConfigurationV1(fixture);

    expect(result).toEqual({ success: true, data: fixture });
  });

  it.each([
    ['unknown root key', (value: Record<string, any>) => { value.price = 12_000; }, '$.price'],
    ['unknown nested key', (value: Record<string, any>) => { value.intent.pergola.postCount = 4; }, '$.intent.pergola.postCount'],
    ['app-owned executable enum', (value: Record<string, any>) => { value.intent.pergola.family = 'custom-calculator'; }, '$.intent.pergola.family'],
    ['non-UUID ID', (value: Record<string, any>) => { value.configurationId = 'customer@example.com'; }, '$.configurationId'],
    ['non-positive revision', (value: Record<string, any>) => { value.revision = 0; }, '$.revision'],
    ['invalid timestamp', (value: Record<string, any>) => { value.updatedAt = 'today'; }, '$.updatedAt'],
    ['future timestamp ordering', (value: Record<string, any>) => { value.createdAt = '2026-08-18T00:00:00.000Z'; }, '$.updatedAt'],
    ['fractional millimetres', (value: Record<string, any>) => { value.intent.pergola.dimensions.lengthMm = 4_000.5; }, '$.intent.pergola.dimensions.lengthMm'],
    ['undersized projection', (value: Record<string, any>) => { value.intent.pergola.dimensions.projectionMm = 1_499; }, '$.intent.pergola.dimensions.projectionMm'],
    ['oversized clear height', (value: Record<string, any>) => { value.intent.pergola.dimensions.clearHeightMm = 5_001; }, '$.intent.pergola.dimensions.clearHeightMm'],
    ['arbitrary source URL', (value: Record<string, any>) => { value.source = { kind: 'simple_cover_import', sourcePath: 'https://example.com', sourceSlug: null }; }, '$.source.sourcePath'],
    ['blank source metadata', (value: Record<string, any>) => { value.source.sourceSlug = 'gable'; }, '$.source'],
    ['missing seeded slug', (value: Record<string, any>) => { value.source = { kind: 'product_seed', sourcePath: '/products/pergolas/gable', sourceSlug: null }; }, '$.source.sourceSlug'],
    ['freestanding house connection', (value: Record<string, any>) => { value.intent.pergola.placement.mode = 'freestanding'; }, '$.intent.pergola.placement.connectionIntent'],
    ['attached none connection', (value: Record<string, any>) => { value.intent.pergola.placement.connectionIntent = 'none'; }, '$.intent.pergola.placement.connectionIntent'],
    ['standard finish custom name', (value: Record<string, any>) => { value.intent.pergola.frame.otherColourName = 'Bronze'; }, '$.intent.pergola.frame.otherColourName'],
    ['other finish missing name', (value: Record<string, any>) => { value.intent.pergola.frame = { finish: 'other', otherColourName: null }; }, '$.intent.pergola.frame.otherColourName'],
    ['custom text contact details', (value: Record<string, any>) => { value.intent.pergola.frame = { finish: 'other', otherColourName: 'email@example.com' }; }, '$.intent.pergola.frame.otherColourName'],
    ['dimmer without downlights', (value: Record<string, any>) => { value.intent.pergola.lighting.dimmerRequested = true; }, '$.intent.pergola.lighting.dimmerRequested'],
  ])('rejects %s', (_name, mutate, expectedPath) => {
    const value = cloneFixture();
    mutate(value);
    const result = safeParseCustomerPergolaConfigurationV1(value);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.map((entry) => entry.path)).toContain(expectedPath);
  });

  it('enforces exactly one complete and unique treatment set for the V1 pergola', () => {
    const missing = cloneFixture();
    missing.intent.pergola.edgeTreatments.pop();
    const duplicated = cloneFixture();
    duplicated.intent.pergola.edgeTreatments[3].edgeId = 'front';

    for (const value of [missing, duplicated]) {
      const result = safeParseCustomerPergolaConfigurationV1(value);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.some((entry) => (
          entry.path === '$.intent.pergola.edgeTreatments'
          && entry.code === 'invariant'
        ))).toBe(true);
      }
    }
  });

  it('rejects a treatment on the structurally attached edge', () => {
    const value = cloneFixture();
    value.intent.pergola.edgeTreatments[3].treatment = {
      kind: 'blind',
      fabric: 'mesh',
      operation: 'manual',
    };

    const result = safeParseCustomerPergolaConfigurationV1(value);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'invariant',
        path: '$.intent.pergola.edgeTreatments',
      }));
    }
  });

  it.each([
    [{ system: 'acrylic', tint: 'clear', layout: 'central_skylight_narrow' }, '$.intent.pergola.roof.layout'],
    [{ system: 'mixed', tint: 'clear' }, '$.intent.pergola.roof.layout'],
    [{ system: 'solid_timber_sarking', ceilingIntent: 'natural_timber', tint: 'clear' }, '$.intent.pergola.roof.tint'],
  ])('rejects fields outside the selected roof variant', (roof, expectedPath) => {
    const value = cloneFixture();
    value.intent.pergola.roof = roof;
    const result = safeParseCustomerPergolaConfigurationV1(value);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.map((entry) => entry.path)).toContain(expectedPath);
  });
});
