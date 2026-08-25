// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { solveCustomerConfigurationV1 } from '@sp/configurator/geometry';

describe('@sp/configurator/geometry Node entry', () => {
  it('resolves through the exact package subpath', () => {
    expect(typeof solveCustomerConfigurationV1).toBe('function');
  });
});
