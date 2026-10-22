import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphAccessToken } from './accessToken';
import type { SharePointConfig } from './config';

const cfg = { tenantId: 'tenant', clientId: 'client', binding: 'source' } as SharePointConfig;
const assertion = (seconds = 7200, suffix = 'signature') => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.${suffix}`;
const success = () => ({ access_token: 'opaque-provider-token', token_type: 'Bearer', expires_in: 3600 });
const signal = () => AbortSignal.timeout(5000);
const transport = () => vi.fn() as unknown as typeof fetch;
afterEach(() => vi.useRealTimers());

describe('Graph access token reuse', () => {
  it('coalesces concurrent exact assertions and reuses only the acquired bearer', async () => {
    const fetcher = transport(), oidc = assertion(), exchange = vi.fn(async () => success());
    const [a, b] = await Promise.all([graphAccessToken(cfg, oidc, signal(), fetcher, exchange), graphAccessToken(cfg, oidc, signal(), fetcher, exchange)]);
    const c = await graphAccessToken(cfg, oidc, signal(), fetcher, exchange);
    expect([a.value, b.value, c.value]).toEqual(Array(3).fill('opaque-provider-token'));
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('never accepts another unverified assertion or changed source/client/tenant through an existing entry', async () => {
    const fetcher = transport(), oidc = assertion(), exchange = vi.fn(async () => success());
    await graphAccessToken(cfg, oidc, signal(), fetcher, exchange);
    const reject = vi.fn(async () => { throw new Error('Entra denied new assertion'); });
    await expect(graphAccessToken(cfg, assertion(7200, 'different'), signal(), fetcher, reject)).rejects.toThrow('Entra denied');
    for (const changed of [{ ...cfg, binding: 'other' }, { ...cfg, clientId: 'other' }, { ...cfg, tenantId: 'other' }]) await graphAccessToken(changed, oidc, signal(), fetcher, exchange);
    expect(exchange).toHaveBeenCalledTimes(4);
    expect(reject).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, 0, -1, Infinity, '3600'])('does not retain a token without a usable expires_in=%s', async lifetime => {
    const fetcher = transport(), oidc = assertion(), exchange = vi.fn(async () => ({ ...success(), expires_in: lifetime }));
    await graphAccessToken(cfg, oidc, signal(), fetcher, exchange);
    await graphAccessToken(cfg, oidc, signal(), fetcher, exchange);
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('expires before both token and assertion expiry, including exchange time and skew', async () => {
    vi.useFakeTimers();
    const fetcher = transport(), oidc = assertion(200), exchange = vi.fn(async () => success());
    await graphAccessToken(cfg, oidc, signal(), fetcher, exchange);
    vi.advanceTimersByTime(139_000);
    await graphAccessToken(cfg, oidc, signal(), fetcher, exchange);
    expect(exchange).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    await graphAccessToken(cfg, oidc, signal(), fetcher, exchange);
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('bounds a long-lived assertion by token expiry and keeps opaque/non-JWT assertions on direct exchange', async () => {
    vi.useFakeTimers();
    const fetcher = transport(), oidc = assertion(), exchange = vi.fn(async () => ({ ...success(), expires_in: 120 }));
    await graphAccessToken(cfg, oidc, signal(), fetcher, exchange);
    vi.advanceTimersByTime(61_000);
    await graphAccessToken(cfg, oidc, signal(), fetcher, exchange);
    await graphAccessToken(cfg, 'opaque-assertion', signal(), fetcher, exchange);
    await graphAccessToken(cfg, 'opaque-assertion', signal(), fetcher, exchange);
    expect(exchange).toHaveBeenCalledTimes(4);
  });

  it('isolates caller cancellation from another waiter and retains successful exchange', async () => {
    const fetcher = transport(), oidc = assertion(), controller = new AbortController();
    let finish!: (value: ReturnType<typeof success>) => void;
    const exchange = vi.fn((_exchangeSignal: AbortSignal) => new Promise<ReturnType<typeof success>>(resolve => { finish = resolve; }));
    const a = graphAccessToken(cfg, oidc, controller.signal, fetcher, exchange);
    const b = graphAccessToken(cfg, oidc, signal(), fetcher, exchange);
    const cancelled = expect(a).rejects.toThrow('Cancelled caller');
    controller.abort(new Error('Cancelled caller')); await cancelled;
    expect(exchange.mock.calls[0]?.[0]?.aborted).toBe(false);
    finish(success()); expect((await b).value).toBe('opaque-provider-token');
    await graphAccessToken(cfg, oidc, signal(), fetcher, exchange);
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('does not retain exchange failures or malformed tokens and permits an ordinary retry', async () => {
    const fetcher = transport(), oidc = assertion();
    const exchange = vi.fn().mockRejectedValueOnce(new Error('Source failure')).mockResolvedValueOnce({ access_token: '', token_type: 'Bearer' }).mockResolvedValue(success());
    await expect(graphAccessToken(cfg, oidc, signal(), fetcher, exchange)).rejects.toThrow('Source failure');
    await expect(graphAccessToken(cfg, oidc, signal(), fetcher, exchange)).rejects.toMatchObject({ code: 'source_invalid' });
    expect((await graphAccessToken(cfg, oidc, signal(), fetcher, exchange)).value).toBe('opaque-provider-token');
    expect(exchange).toHaveBeenCalledTimes(3);
  });

  it('evicts bounded entries and invalidation of an old handle cannot delete its replacement', async () => {
    const fetcher = transport(), exchange = vi.fn(async () => success()), first = assertion(7200, 'first');
    const old = await graphAccessToken(cfg, first, signal(), fetcher, exchange);
    for (let i = 0; i < 8; i++) await graphAccessToken(cfg, assertion(7200, `key${i}`), signal(), fetcher, exchange);
    await graphAccessToken(cfg, first, signal(), fetcher, exchange);
    old.invalidate();
    await graphAccessToken(cfg, first, signal(), fetcher, exchange);
    expect(exchange).toHaveBeenCalledTimes(10);
  });
});
