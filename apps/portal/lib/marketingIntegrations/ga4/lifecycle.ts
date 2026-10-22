/** Source-owned refresh lifecycle. Consent and reconnection are operator work. */
export const GA4_READ_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
export type Ga4Step = 'vault_auth' | 'vault_read' | 'credential_read' | 'token_refresh' | 'property_read' | 'vault_write' | 'report_read';
export type Ga4Evidence = {
  credentialStore?: 'vercel'; credentialBinding?: string;
  vaultId?: string; itemId?: string; beforeVersion?: number; afterVersion?: number;
  scope?: string; expiresIn?: number; property?: string; refreshRotated?: boolean;
  queryHash?: string; startDate?: string; endDate?: string;
  comparisonStart?: string | null; comparisonEnd?: string | null;
  reportVersion?: string; resultHash?: string; rowCount?: number;
  warningCount?: number; timezone?: string; reportOutcome?: 'complete' | 'unavailable';
};
export type Ga4CredentialConfig = { propertyId: string; clientId: string; clientSecret: string } & (
  { credentialStore?: 'vault'; vaultId: string; itemId: string }
  | { credentialStore: 'vercel'; credentialBinding: string; refreshToken: string });
export interface Ga4Vault {
  authenticate(): Promise<void>;
  read(): Promise<{ refreshToken: string | null; version: number }>;
  write(refreshToken: string): Promise<{ version: number }>;
}
export interface Ga4Google {
  token(parameters: URLSearchParams): Promise<{ accessToken: string; refreshToken?: string; scope: string; expiresIn: number }>;
  property(accessToken: string, propertyId: string): Promise<void>;
}
export interface Ga4LifecycleStore {
  before(step: Ga4Step, evidence: Ga4Evidence): Promise<void>;
  after(step: Ga4Step, evidence: Ga4Evidence): Promise<void>;
  /** Durable state decides whether all credential effects have a known result. */
  finish(outcome: 'connected' | 'report_failed' | 'uncertain'): Promise<void>;
}

export async function refreshGa4Report<T>(input: {
  config: Ga4CredentialConfig; vault?: Ga4Vault; google: Ga4Google; store: Ga4LifecycleStore;
  signal: AbortSignal; intent: Ga4Evidence; read(accessToken: string): Promise<T>;
  evidence(value: T): Ga4Evidence;
}): Promise<T> {
  const { config, vault, google, store, signal } = input;
  async function effect<R>(step: Ga4Step, execute: () => Promise<R>, before: Ga4Evidence = {},
    after: (value: R) => Ga4Evidence = () => before): Promise<R> {
    signal.throwIfAborted();
    await store.before(step, before);
    // Cancellation between durable intent and execution must not start a new effect.
    signal.throwIfAborted();
    const result = await execute();
    // Record the result even if cancellation happened during the effect. A lost
    // response remains uncertain; cancellation cannot make it safe to replay.
    await store.after(step, after(result));
    signal.throwIfAborted();
    return result;
  }
  try {
    if (!/^[1-9]\d{0,19}$/.test(config.propertyId)) throw new Error('Invalid property.');
    let refreshToken: string, version = 0;
    if (config.credentialStore === 'vercel') {
      const reference = { credentialStore: 'vercel' as const, credentialBinding: config.credentialBinding };
      refreshToken = await effect('credential_read', async () => {
        if (!config.refreshToken || config.refreshToken.length > 16384) throw new Error('Credential unavailable.');
        return config.refreshToken;
      }, reference);
    } else {
      if (!vault) throw new Error('Vault unavailable.');
      await effect('vault_auth', () => vault.authenticate());
      const reference = { vaultId: config.vaultId, itemId: config.itemId };
      const saved = await effect('vault_read', () => vault.read(), reference,
        value => ({ ...reference, afterVersion: value.version }));
      if (!saved.refreshToken || !Number.isSafeInteger(saved.version) || saved.version < 1) throw new Error('Credential unavailable.');
      refreshToken = saved.refreshToken; version = saved.version;
    }
    const parameters = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
      grant_type: 'refresh_token', refresh_token: refreshToken });
    const token = await effect('token_refresh', () => google.token(parameters), {}, value => {
      if (value.scope !== GA4_READ_SCOPE || !value.accessToken || !Number.isInteger(value.expiresIn)
        || value.expiresIn < 1 || value.expiresIn > 86400 || value.refreshToken === '') throw new Error('Unexpected provider authority.');
      return { scope: value.scope, expiresIn: value.expiresIn,
        refreshRotated: Boolean(value.refreshToken && value.refreshToken !== refreshToken) };
    });
    const rotated = token.refreshToken && token.refreshToken !== refreshToken;
    if (rotated && config.credentialStore === 'vercel') {
      // Durable token result already requires credential recovery. No report,
      // vault fallback or invented persistence acknowledgement is permitted.
      try { console.warn('sanctuary_ga4_credential_failure', { reason: 'rotation_requires_recovery' }); } catch { /* Logging grants no authority. */ }
      throw new Error('Credential recovery required.');
    }
    await effect('property_read', () => google.property(token.accessToken, config.propertyId), { property: config.propertyId });
    if (rotated && config.credentialStore !== 'vercel') await effect('vault_write', () => vault!.write(token.refreshToken!),
      { vaultId: config.vaultId, itemId: config.itemId, beforeVersion: version }, value => {
        if (!Number.isSafeInteger(value.version) || value.version <= version) throw new Error('Credential write unconfirmed.');
        return { vaultId: config.vaultId, itemId: config.itemId, beforeVersion: version, afterVersion: value.version };
      });
    signal.throwIfAborted();
    await store.before('report_read', input.intent);
    signal.throwIfAborted();
    let report: T;
    try { report = await input.read(token.accessToken); }
    catch {
      await store.after('report_read', { ...input.intent, reportOutcome: 'unavailable' });
      throw new Error('Report unavailable.');
    }
    await store.after('report_read', { ...input.evidence(report), reportOutcome: 'complete' });
    signal.throwIfAborted();
    await store.finish('connected');
    signal.throwIfAborted();
    return report;
  } catch {
    // SQL atomically fences this executor when no token intent began, or when
    // credential effects settled. Otherwise quarantine; expiry is never a retry.
    await store.finish('report_failed').catch(async () => {
      await store.finish('uncertain').catch(() => undefined);
    });
    throw new Error('GA4 source read unconfirmed. Inspect operation evidence before retrying.');
  }
}
