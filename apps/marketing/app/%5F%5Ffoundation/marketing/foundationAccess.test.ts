import { describe, expect, it } from 'vitest';
import { shouldShowMarketingFoundation } from './foundationAccess';

describe('marketing foundation route access', () => {
  it('is available outside production for local design work', () => {
    expect(shouldShowMarketingFoundation({ nodeEnv: 'development', enabled: undefined })).toBe(true);
  });

  it('is hidden in production unless explicitly enabled', () => {
    expect(shouldShowMarketingFoundation({ nodeEnv: 'production', enabled: undefined })).toBe(false);
    expect(shouldShowMarketingFoundation({ nodeEnv: 'production', enabled: 'false' })).toBe(false);
    expect(shouldShowMarketingFoundation({ nodeEnv: 'production', enabled: 'true' })).toBe(true);
    expect(shouldShowMarketingFoundation({ nodeEnv: undefined, enabled: undefined })).toBe(false);
  });
});
