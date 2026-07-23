import { describe, expect, it } from 'vitest';
import {
  COSTING_CONFIGURATION_NAME_MAX,
  COSTING_CONFIGURATION_PURPOSE_MAX,
  validateCostingConfigurationMetadata,
} from './configurationMetadata';

describe('costing configuration identity metadata', () => {
  it('trims and accepts bounded human-readable details', () => {
    expect(validateCostingConfigurationMetadata({
      name: '  August supplier update  ',
      purpose: '  Refresh confirmed supplier rates.  ',
    })).toEqual({
      ok: true,
      value: {
        name: 'August supplier update',
        purpose: 'Refresh confirmed supplier rates.',
      },
    });
  });

  it('rejects missing and oversized details with field-specific issues', () => {
    const result = validateCostingConfigurationMetadata({
      name: 'x'.repeat(COSTING_CONFIGURATION_NAME_MAX + 1),
      purpose: 'x'.repeat(COSTING_CONFIGURATION_PURPOSE_MAX + 1),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.path)).toEqual(['name', 'purpose']);
  });
});
