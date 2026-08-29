import { describe, expect, it } from 'vitest';
import { createDefaultCustomerPergolaConfigurationV1 } from '@sp/configurator/core';
import {
  compareConfigurationFreshness,
  readStoredCustomerPergolaConfiguration,
  serializeStoredCustomerPergolaConfigurationEnvelopeV1,
} from './storage';

const document = createDefaultCustomerPergolaConfigurationV1({
  configurationId: '89cfd799-363c-4e4b-bac2-ac7409dcbc7f',
  timestamp: '2026-08-25T00:00:00.000Z',
});

describe('configurator storage envelope', () => {
  it('strictly restores and canonicalizes a current document', () => {
    const raw = JSON.stringify({
      storageVersion: 'sanctuary.pergola-config.v1',
      savedAt: '2026-08-25T01:00:00.000Z',
      document: {
        ...document,
        intent: {
          ...document.intent,
          pergola: {
            ...document.intent.pergola,
            edgeTreatments: [...document.intent.pergola.edgeTreatments].reverse(),
          },
        },
      },
    });
    const result = readStoredCustomerPergolaConfiguration(raw);
    expect(result.status).toBe('current');
    if (result.status !== 'current') return;
    expect(result.envelope.document.intent.pergola.edgeTreatments.map(({ edgeId }) => edgeId))
      .toEqual(['front', 'left', 'right', 'rear']);
    expect(result.needsCanonicalWrite).toBe(true);
    expect(readStoredCustomerPergolaConfiguration(result.canonicalSerialized)).toMatchObject({
      status: 'current',
      needsCanonicalWrite: false,
    });
  });

  it('rejects corrupt current envelopes and preserves unknown future versions', () => {
    expect(readStoredCustomerPergolaConfiguration(JSON.stringify({
      storageVersion: 'sanctuary.pergola-config.v1',
      savedAt: '2026-08-25T01:00:00.000Z',
      document,
      surprise: true,
    })).status).toBe('invalid');
    const future = JSON.stringify({ storageVersion: 'sanctuary.pergola-config.v2', opaque: true });
    expect(readStoredCustomerPergolaConfiguration(future)).toEqual({
      status: 'future-version',
      storageVersion: 'sanctuary.pergola-config.v2',
      preservedRaw: future,
    });
  });

  it('orders cross-tab candidates by updatedAt and then revision', () => {
    expect(compareConfigurationFreshness(
      { ...document, updatedAt: '2026-08-25T02:00:00.000Z', revision: 1 },
      { ...document, updatedAt: '2026-08-25T01:00:00.000Z', revision: 99 },
    )).toBeGreaterThan(0);
    expect(compareConfigurationFreshness(
      { ...document, revision: 3 },
      { ...document, revision: 2 },
    )).toBeGreaterThan(0);
  });

  it('writes one canonical versioned envelope', () => {
    expect(JSON.parse(serializeStoredCustomerPergolaConfigurationEnvelopeV1(
      document,
      '2026-08-25T01:00:00.000Z',
    ))).toEqual({
      storageVersion: 'sanctuary.pergola-config.v1',
      savedAt: '2026-08-25T01:00:00.000Z',
      document,
    });
  });
});
