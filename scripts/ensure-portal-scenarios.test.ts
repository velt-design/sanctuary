import { describe, expect, it } from 'vitest';

import {
  readPortalScenarioConfig,
  redactPortalScenarioSecrets,
  stableScenarioUuid,
} from './ensure-portal-scenarios';

const validEnv = {
  PORTAL_TEST_EMAIL: 'agent@example.test',
  PORTAL_TEST_PASSWORD: 'do-not-log-this-password',
  PORTAL_TEST_SCENARIO_TARGET: 'local',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'do-not-log-service-role-key',
};

describe('readPortalScenarioConfig', () => {
  it('rejects missing credentials', () => {
    expect(() =>
      readPortalScenarioConfig({
        PORTAL_TEST_SCENARIO_TARGET: 'local',
        NEXT_PUBLIC_SUPABASE_URL: validEnv.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: validEnv.SUPABASE_SERVICE_ROLE_KEY,
      }),
    ).toThrow(/PORTAL_TEST_EMAIL, PORTAL_TEST_PASSWORD/);
  });

  it('rejects missing service-role env', () => {
    expect(() =>
      readPortalScenarioConfig({
        PORTAL_TEST_EMAIL: validEnv.PORTAL_TEST_EMAIL,
        PORTAL_TEST_PASSWORD: validEnv.PORTAL_TEST_PASSWORD,
        PORTAL_TEST_SCENARIO_TARGET: 'local',
        NEXT_PUBLIC_SUPABASE_URL: validEnv.NEXT_PUBLIC_SUPABASE_URL,
      }),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('rejects missing scenario target', () => {
    expect(() =>
      readPortalScenarioConfig({
        PORTAL_TEST_EMAIL: validEnv.PORTAL_TEST_EMAIL,
        PORTAL_TEST_PASSWORD: validEnv.PORTAL_TEST_PASSWORD,
        NEXT_PUBLIC_SUPABASE_URL: validEnv.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: validEnv.SUPABASE_SERVICE_ROLE_KEY,
      }),
    ).toThrow(/PORTAL_TEST_SCENARIO_TARGET/);
  });

  it('rejects production scenario target', () => {
    expect(() =>
      readPortalScenarioConfig({
        ...validEnv,
        PORTAL_TEST_SCENARIO_TARGET: 'production',
      }),
    ).toThrow(/production is not allowed/);
  });

  it('defaults prefix and seeded scenarios', () => {
    const config = readPortalScenarioConfig(validEnv);
    expect(config.scenarioPrefix).toBe('agent');
    expect(config.scenarios).toEqual(['project-with-estimate', 'quote-ready', 'workbench-multi-object']);
  });

  it('accepts a comma-separated scenario subset', () => {
    const config = readPortalScenarioConfig({
      ...validEnv,
      PORTAL_SCENARIOS: 'quote-ready, workbench-multi-object',
      PORTAL_SCENARIO_PREFIX: 'ci_agent',
    });
    expect(config.scenarioPrefix).toBe('ci_agent');
    expect(config.scenarios).toEqual(['quote-ready', 'workbench-multi-object']);
  });

  it('rejects planned scenarios until their domain-safe seeders exist', () => {
    expect(() =>
      readPortalScenarioConfig({
        ...validEnv,
        PORTAL_SCENARIOS: 'schedule-board-basic',
      }),
    ).toThrow(/not seedable/);
  });
});

describe('redactPortalScenarioSecrets', () => {
  it('does not include password or service-role key in output', () => {
    const text = redactPortalScenarioSecrets(
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

describe('stableScenarioUuid', () => {
  it('returns deterministic valid UUIDs', () => {
    const first = stableScenarioUuid('agent', 'quote-ready', 'project');
    const second = stableScenarioUuid('agent', 'quote-ready', 'project');
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('separates prefixes, scenarios, and entities', () => {
    const base = stableScenarioUuid('agent', 'project-with-estimate', 'project');
    expect(stableScenarioUuid('staging', 'project-with-estimate', 'project')).not.toBe(base);
    expect(stableScenarioUuid('agent', 'quote-ready', 'project')).not.toBe(base);
    expect(stableScenarioUuid('agent', 'project-with-estimate', 'estimate')).not.toBe(base);
  });
});
