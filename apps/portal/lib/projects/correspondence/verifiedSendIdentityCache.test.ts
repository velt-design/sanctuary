import { describe, expect, it } from 'vitest';
import { createVerifiedSendIdentityCache } from './verifiedSendIdentityCache';
const binding = { projectId: 'project-one', providerMessageId: 'provider-one', recipients: ['one@example.test'], providerKey: 'provider-secret', secret: 'a'.repeat(64) };
describe('encrypted verified send identity reuse', () => {
  it('reuses exact proof but isolates project, provider ID, recipients and rotated secrets', () => {
    const cache = createVerifiedSendIdentityCache();
    cache.set(binding, '<verified@example.test>');
    expect(cache.get(binding)).toBe('<verified@example.test>');
    for (const changed of [{ projectId: 'other' }, { providerMessageId: 'other' }, { recipients: ['other@example.test'] },
      { providerKey: 'rotated' }, { secret: 'b'.repeat(64) }]) expect(cache.get({ ...binding, ...changed })).toBeNull();
  });
  it('expires at fifteen minutes even when an instance was suspended', () => {
    let now = 0;
    const cache = createVerifiedSendIdentityCache(() => now);
    cache.set(binding, '<verified@example.test>');
    now = 899_999;
    expect(cache.get(binding)).not.toBeNull();
    now = 900_000;
    expect(cache.get(binding)).toBeNull();
  });
  it('bounds retained entries and treats a cold instance as a miss', () => {
    const cache = createVerifiedSendIdentityCache();
    for (let i = 0; i < 513; i++) cache.set({ ...binding, providerMessageId: String(i) }, `<id${i}@example.test>`);
    expect(cache.get({ ...binding, providerMessageId: '0' })).toBeNull();
    expect(cache.get({ ...binding, providerMessageId: '512' })).toBe('<id512@example.test>');
    expect(createVerifiedSendIdentityCache().get(binding)).toBeNull();
  });
  it('refuses missing encryption configuration and non-identity payloads', () => {
    const cache = createVerifiedSendIdentityCache();
    cache.set({ ...binding, secret: '' }, '<verified@example.test>');
    expect(cache.get({ ...binding, secret: '' })).toBeNull();
    cache.set(binding, 'Customer email body');
    expect(cache.get(binding)).toBeNull();
  });
});
