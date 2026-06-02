import { describe, expect, it } from 'vitest';

import { readPortalTestUserConfig, redactPortalTestUserSecrets } from './ensure-portal-test-user';

const validEnv = {
  PORTAL_TEST_EMAIL: 'agent@example.test',
  PORTAL_TEST_PASSWORD: 'do-not-log-this-password',
  PORTAL_TEST_PROVISION_TARGET: 'local',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'do-not-log-service-role-key',
};

describe('readPortalTestUserConfig', () => {
  it('rejects missing email and password', () => {
    expect(() =>
      readPortalTestUserConfig({
        PORTAL_TEST_PROVISION_TARGET: 'local',
        NEXT_PUBLIC_SUPABASE_URL: validEnv.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: validEnv.SUPABASE_SERVICE_ROLE_KEY,
      }),
    ).toThrow(/PORTAL_TEST_EMAIL, PORTAL_TEST_PASSWORD/);
  });

  it('rejects missing service-role env', () => {
    expect(() =>
      readPortalTestUserConfig({
        PORTAL_TEST_EMAIL: validEnv.PORTAL_TEST_EMAIL,
        PORTAL_TEST_PASSWORD: validEnv.PORTAL_TEST_PASSWORD,
        PORTAL_TEST_PROVISION_TARGET: 'local',
        NEXT_PUBLIC_SUPABASE_URL: validEnv.NEXT_PUBLIC_SUPABASE_URL,
      }),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('rejects missing provision target', () => {
    expect(() =>
      readPortalTestUserConfig({
        PORTAL_TEST_EMAIL: validEnv.PORTAL_TEST_EMAIL,
        PORTAL_TEST_PASSWORD: validEnv.PORTAL_TEST_PASSWORD,
        NEXT_PUBLIC_SUPABASE_URL: validEnv.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: validEnv.SUPABASE_SERVICE_ROLE_KEY,
      }),
    ).toThrow(/PORTAL_TEST_PROVISION_TARGET/);
  });

  it('rejects production provision target', () => {
    expect(() =>
      readPortalTestUserConfig({
        ...validEnv,
        PORTAL_TEST_PROVISION_TARGET: 'production',
      }),
    ).toThrow(/production is not allowed/);
  });

  it('defaults the role to staff', () => {
    expect(readPortalTestUserConfig(validEnv).role).toBe('staff');
  });

  it('accepts admin role', () => {
    expect(readPortalTestUserConfig({ ...validEnv, PORTAL_TEST_ROLE: 'admin' }).role).toBe('admin');
  });

  it('rejects invalid roles', () => {
    expect(() => readPortalTestUserConfig({ ...validEnv, PORTAL_TEST_ROLE: 'owner' })).toThrow(/PORTAL_TEST_ROLE/);
  });
});

describe('redactPortalTestUserSecrets', () => {
  it('does not include password or service-role key in output', () => {
    const text = redactPortalTestUserSecrets(
      `failed with ${validEnv.PORTAL_TEST_PASSWORD} and ${validEnv.SUPABASE_SERVICE_ROLE_KEY}`,
      {
        password: validEnv.PORTAL_TEST_PASSWORD,
        serviceRoleKey: validEnv.SUPABASE_SERVICE_ROLE_KEY,
      },
    );

    expect(text).not.toContain(validEnv.PORTAL_TEST_PASSWORD);
    expect(text).not.toContain(validEnv.SUPABASE_SERVICE_ROLE_KEY);
    expect(text).toContain('[redacted]');
  });
});
