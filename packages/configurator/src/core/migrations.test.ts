// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  migrateCustomerPergolaConfiguration,
  migrateSerializedCustomerPergolaConfiguration,
} from './migrations';
import { createTestCustomerConfiguration } from './testFixtures';

describe('customer configuration migration harness', () => {
  it('recognizes the current version without rewriting it', () => {
    expect(migrateCustomerPergolaConfiguration(createTestCustomerConfiguration()))
      .toEqual({
        status: 'current',
        configuration: createTestCustomerConfiguration(),
        migrated: false,
      });
  });

  it('preserves an unknown future version for recovery without parsing or overwriting it', () => {
    const raw = {
      schemaVersion: 'customer_pergola_configuration.v2',
      futureChoice: { retained: true },
    };
    const result = migrateCustomerPergolaConfiguration(raw);

    expect(result).toEqual({
      status: 'future-version',
      schemaVersion: 'customer_pergola_configuration.v2',
      raw,
    });
    if (result.status === 'future-version') expect(result.raw).toBe(raw);
  });

  it('returns recoverable invalid results for corrupt JSON and unsupported old versions', () => {
    expect(migrateSerializedCustomerPergolaConfiguration('{broken')).toEqual({
      status: 'invalid',
      issues: [{ code: 'invalid_value', path: '$', message: 'Expected valid JSON.' }],
      raw: '{broken',
    });
    expect(migrateCustomerPergolaConfiguration({
      schemaVersion: 'customer_pergola_configuration.v0',
    })).toEqual(expect.objectContaining({ status: 'invalid' }));
  });
});
