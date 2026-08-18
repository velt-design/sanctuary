// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { normalizeCustomerPergolaConfigurationV1 } from './normalize';
import { parseCustomerPergolaConfigurationV1 } from './parser';
import { serializeCustomerPergolaConfigurationV1 } from './serialize';
import { createTestCustomerConfiguration } from './testFixtures';

describe('customer configuration normalization and serialization', () => {
  it('normalizes direct invariants without introducing downstream geometry fields', () => {
    const fixture = createTestCustomerConfiguration();
    fixture.intent.pergola.placement.mode = 'freestanding';
    fixture.intent.pergola.frame = {
      finish: 'other',
      otherColourName: '  Warm   bronze  ',
    };
    fixture.intent.pergola.edgeTreatments.reverse();

    const normalized = normalizeCustomerPergolaConfigurationV1(fixture);
    expect(normalized.intent.pergola.placement.connectionIntent).toBe('none');
    expect(normalized.intent.pergola.frame.otherColourName).toBe('Warm bronze');
    expect(normalized.intent.pergola.edgeTreatments.map((edge) => edge.edgeId))
      .toEqual(['front', 'left', 'right', 'rear']);
    expect(normalized).not.toHaveProperty('geometry');
    expect(normalized).not.toHaveProperty('price');
    expect(() => parseCustomerPergolaConfigurationV1(normalized)).not.toThrow();
  });

  it('round-trips a canonical fixture with deterministic bytes', () => {
    const fixture = createTestCustomerConfiguration();
    const first = serializeCustomerPergolaConfigurationV1(fixture);
    const parsed = parseCustomerPergolaConfigurationV1(JSON.parse(first));
    const second = serializeCustomerPergolaConfigurationV1(parsed);

    expect(second).toBe(first);
    expect(JSON.parse(second)).toEqual(fixture);
  });
});
