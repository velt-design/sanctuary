// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  createDefaultCustomerPergolaConfigurationV1,
  safeParseCustomerPergolaConfigurationV1,
  serializeCustomerPergolaConfigurationV1,
} from '@sp/configurator/core';

describe('@sp/configurator/core browser entry', () => {
  it('imports and runs without Node-only or browser-storage dependencies', () => {
    const configuration = createDefaultCustomerPergolaConfigurationV1({
      configurationId: '123e4567-e89b-42d3-a456-426614174000',
      timestamp: '2026-08-17T00:00:00.000Z',
    });
    const serialized = serializeCustomerPergolaConfigurationV1(configuration);

    expect(window.document).toBeDefined();
    expect(safeParseCustomerPergolaConfigurationV1(JSON.parse(serialized)))
      .toEqual({ success: true, data: configuration });
    expect(serialized).not.toContain('localStorage');
  });
});
