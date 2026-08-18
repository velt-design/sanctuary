// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_PERGOLA_CONFIGURATION_V1,
  createDefaultCustomerPergolaConfigurationV1,
} from '@sp/configurator/core';

describe('@sp/configurator/core Node entry', () => {
  it('resolves through the exact server-safe package subpath', () => {
    const configuration = createDefaultCustomerPergolaConfigurationV1({
      configurationId: '123e4567-e89b-42d3-a456-426614174000',
      timestamp: '2026-08-17T00:00:00.000Z',
    });

    expect(configuration.schemaVersion).toBe(CUSTOMER_PERGOLA_CONFIGURATION_V1);
  });
});
