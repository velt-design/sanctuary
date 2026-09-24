import { describe, expect, it, vi } from 'vitest';
import { GA4_READ_SCOPE, refreshGa4Report, type Ga4LifecycleStore } from './lifecycle';

function setup() {
  const events: string[] = [];
  const controller = new AbortController();
  const store: Ga4LifecycleStore = {
    before: vi.fn(async step => { events.push(`before:${step}`); }),
    after: vi.fn(async step => { events.push(`after:${step}`); }),
    finish: vi.fn(async outcome => { events.push(`finish:${outcome}`); }),
  };
  const vault = { authenticate: vi.fn(async () => undefined), read: vi.fn(async () => ({ refreshToken: 'synthetic-refresh', version: 4 })),
    write: vi.fn(async () => ({ version: 5 })) };
  const google = { token: vi.fn(async (_parameters: URLSearchParams) => ({ accessToken: 'synthetic-access', refreshToken: undefined as string | undefined,
    scope: GA4_READ_SCOPE, expiresIn: 3600 })), property: vi.fn(async () => undefined) };
  const input = { config: { propertyId: '123', clientId: 'synthetic-client', clientSecret: 'synthetic-secret', vaultId: 'vault', itemId: 'item' },
    store, vault, google, signal: controller.signal, intent: { queryHash: 'a'.repeat(64) },
    read: vi.fn(async () => ({ sessions: 12 })), evidence: () => ({ resultHash: 'b'.repeat(64) }) };
  return { input, events, controller, store, vault, google };
}

describe('Sanctuary GA4 credential and report lifecycle', () => {
  it('uses the exact read-only grant and property with ordered audited effects', async () => {
    const f = setup();
    expect(await refreshGa4Report(f.input)).toEqual({ sessions: 12 });
    expect(f.events).toEqual(['before:vault_auth', 'after:vault_auth', 'before:vault_read', 'after:vault_read',
      'before:token_refresh', 'after:token_refresh', 'before:property_read', 'after:property_read',
      'before:report_read', 'after:report_read', 'finish:connected']);
    expect(f.google.token.mock.calls[0]?.[0]).toBeInstanceOf(URLSearchParams);
    expect(f.google.property).toHaveBeenCalledWith('synthetic-access', '123');
    expect(f.vault.write).not.toHaveBeenCalled();
    expect(JSON.stringify([vi.mocked(f.store.before).mock.calls, vi.mocked(f.store.after).mock.calls])).not.toContain('synthetic-refresh');
  });
  it('verifies the property before persisting a rotated token and then reads', async () => {
    const f = setup(); f.google.token.mockResolvedValue({ accessToken: 'synthetic-access', refreshToken: 'rotated', scope: GA4_READ_SCOPE, expiresIn: 3600 });
    await refreshGa4Report(f.input);
    expect(f.events.indexOf('after:property_read')).toBeLessThan(f.events.indexOf('before:vault_write'));
    expect(f.events.indexOf('after:vault_write')).toBeLessThan(f.events.indexOf('before:report_read'));
    expect(f.vault.write).toHaveBeenCalledWith('rotated');
  });
  it('quarantines a lost token response rather than executing a second refresh', async () => {
    const f = setup(); f.google.token.mockRejectedValue(new Error('uncertain'));
    vi.mocked(f.store.finish).mockImplementation(async outcome => { if (outcome === 'report_failed') throw new Error('Unresolved credential boundary'); });
    await expect(refreshGa4Report(f.input)).rejects.toThrow('unconfirmed');
    expect(f.store.finish).toHaveBeenLastCalledWith('uncertain');
    expect(f.google.token).toHaveBeenCalledTimes(1); expect(f.input.read).not.toHaveBeenCalled();
  });
  it('does not write or read after excess scope or wrong property', async () => {
    for (const defect of ['scope', 'property']) {
      const f = setup();
      f.google.token.mockResolvedValue({ accessToken: 'synthetic-access', refreshToken: 'rotated',
        scope: defect === 'scope' ? `${GA4_READ_SCOPE} extra` : GA4_READ_SCOPE, expiresIn: 3600 });
      if (defect === 'property') f.google.property.mockRejectedValue(new Error('wrong property'));
      await expect(refreshGa4Report(f.input)).rejects.toThrow('unconfirmed');
      expect(f.vault.write).not.toHaveBeenCalled(); expect(f.input.read).not.toHaveBeenCalled();
    }
  });
  it('does not report success for an unchanged vault version', async () => {
    const f = setup(); f.google.token.mockResolvedValue({ accessToken: 'synthetic-access', refreshToken: 'rotated', scope: GA4_READ_SCOPE, expiresIn: 3600 });
    f.vault.write.mockResolvedValue({ version: 4 });
    await expect(refreshGa4Report(f.input)).rejects.toThrow('unconfirmed');
    expect(f.store.after).not.toHaveBeenCalledWith('vault_write', expect.anything()); expect(f.input.read).not.toHaveBeenCalled();
  });
  it('does not issue an effect when cancellation arrives during its durable intent', async () => {
    const f = setup(); vi.mocked(f.store.before).mockImplementation(async step => { if (step === 'token_refresh') f.controller.abort(); });
    await expect(refreshGa4Report(f.input)).rejects.toThrow('unconfirmed'); expect(f.google.token).not.toHaveBeenCalled();
  });
  it('records a settled effect before honoring cancellation, and withholds the report', async () => {
    const f = setup(); f.google.property.mockImplementation(async () => { f.controller.abort(); });
    await expect(refreshGa4Report(f.input)).rejects.toThrow('unconfirmed');
    expect(f.store.after).toHaveBeenCalledWith('property_read', { property: '123' }); expect(f.input.read).not.toHaveBeenCalled();
  });
  it('records report failure without automatically invalidating a proven saved grant', async () => {
    const f = setup(); f.input.read.mockRejectedValue(new Error('provider unavailable'));
    await expect(refreshGa4Report(f.input)).rejects.toThrow('unconfirmed');
    expect(f.store.after).toHaveBeenCalledWith('report_read', { queryHash: 'a'.repeat(64), reportOutcome: 'unavailable' });
    expect(f.store.finish).toHaveBeenLastCalledWith('report_failed');
  });
});
