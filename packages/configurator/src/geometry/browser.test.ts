// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { solveCustomerConfigurationV1 } from '@sp/configurator/geometry';

describe('@sp/configurator/geometry browser entry', () => {
  it('imports without Node-only or storage dependencies', () => {
    expect(window.document).toBeDefined();
    expect(typeof solveCustomerConfigurationV1).toBe('function');
  });
});
