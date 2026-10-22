// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { ga4Config, ga4ControlConfig, ga4VercelBinding } from './config';
const value = { actor: '10000000-0000-4000-8000-000000000001', propertyId: '123',
  vaultId: 'a'.repeat(26), itemId: 'b'.repeat(26), clientId: 'synthetic-client', clientSecret: 'synthetic-secret', vaultToken: 'synthetic-token' };
const env = { SANCTUARY_GA4_REPORTS_ENABLED: 'true', SANCTUARY_GA4_ACTOR_ID: value.actor,
  SANCTUARY_GA4_PROPERTY_ID: value.propertyId, SANCTUARY_GA4_BINDING_SHA256: createHash('sha256').update(JSON.stringify(value)).digest('hex'),
  SANCTUARY_GA4_VAULT_ID: value.vaultId, SANCTUARY_GA4_CREDENTIAL_ITEM_ID: value.itemId,
  SANCTUARY_GA4_CLIENT_ID: value.clientId, SANCTUARY_GA4_CLIENT_SECRET: value.clientSecret, SANCTUARY_GA4_SERVICE_ACCOUNT_TOKEN: value.vaultToken };
it('requires exact deployed authority binding', () => {
  expect(ga4Config(env).propertyId).toBe('123');
  for (const key of ['SANCTUARY_GA4_CLIENT_SECRET', 'SANCTUARY_GA4_SERVICE_ACCOUNT_TOKEN', 'SANCTUARY_GA4_CLIENT_ID']) {
    expect(() => ga4Config({ ...env, [key]: 'changed' })).toThrow('binding changed');
  }
});
it('permits deletion control without enabled collection or provider credentials', () => {
  const control = { SANCTUARY_GA4_ACTOR_ID: value.actor, SANCTUARY_GA4_PROPERTY_ID: '123', SANCTUARY_GA4_BINDING_SHA256: env.SANCTUARY_GA4_BINDING_SHA256 };
  expect(() => ga4ControlConfig(control)).toThrow('capability unavailable');
  expect(ga4ControlConfig(control, true).property).toBe('123');
});
it('does not expose rejected credential values in errors', () => {
  expect(() => ga4Config({ ...env, SANCTUARY_GA4_CLIENT_SECRET: 'private-marker'.repeat(500) })).toThrow('GA4 credential configuration unavailable.');
});
it('loads Vercel credentials only in production without requiring the legacy vault', () => {
  const migrated = { ...env, VERCEL_ENV: 'production', SANCTUARY_GA4_CREDENTIAL_STORE: 'vercel',
    SANCTUARY_GA4_REFRESH_TOKEN: 'synthetic-refresh', SANCTUARY_GA4_SERVICE_ACCOUNT_TOKEN: undefined,
    SANCTUARY_GA4_VAULT_ID: undefined, SANCTUARY_GA4_CREDENTIAL_ITEM_ID: undefined };
  const config = ga4Config(migrated);
  expect(config.credentialStore).toBe('vercel'); expect(config.binding).toBe(env.SANCTUARY_GA4_BINDING_SHA256);
  expect(config).not.toHaveProperty('vaultToken');
  for (const VERCEL_ENV of ['preview', 'development', undefined]) expect(() => ga4Config({ ...migrated, VERCEL_ENV })).toThrow('environment unavailable');
  expect(() => ga4Config({ ...migrated, SANCTUARY_GA4_REFRESH_TOKEN: '' })).toThrow('configuration unavailable');
  expect(() => ga4Config({ ...migrated, SANCTUARY_GA4_CREDENTIAL_STORE: 'unknown' })).toThrow('store unavailable');
  if (config.credentialStore !== 'vercel') throw new Error('Wrong mode');
  for (const patch of [{ refreshToken: 'different' }, { clientSecret: 'different' }, { clientId: 'different' }, { propertyId: '456' }, { actor: 'different' }]) {
    expect(ga4VercelBinding(config.binding, { ...config, ...patch })).not.toBe(config.credentialBinding);
  }
});
