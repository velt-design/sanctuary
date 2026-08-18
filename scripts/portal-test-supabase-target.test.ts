import { describe, expect, it } from 'vitest';

import { validatePortalTestSupabaseTarget } from './portal-test-supabase-target';

const STAGING_REF = 'tnsiprehuldksnuowubv';
const PRODUCTION_REF = 'iytanftukulcnavossmd';

describe('validatePortalTestSupabaseTarget', () => {
  it('accepts an explicit local Supabase origin', () => {
    expect(() => validatePortalTestSupabaseTarget({
      target: 'local',
      supabaseUrl: 'http://127.0.0.1:54321',
    })).not.toThrow();
  });

  it('refuses a hosted project disguised as local', () => {
    expect(() => validatePortalTestSupabaseTarget({
      target: 'local',
      supabaseUrl: `https://${PRODUCTION_REF}.supabase.co`,
    })).toThrow(/local portal test target/);
  });

  it('accepts only the exactly declared staging project', () => {
    expect(() => validatePortalTestSupabaseTarget({
      target: 'staging',
      supabaseUrl: `https://${STAGING_REF}.supabase.co`,
      stagingProjectRef: STAGING_REF,
      productionProjectRef: PRODUCTION_REF,
    })).not.toThrow();
  });

  it('requires both staging and production refusal references', () => {
    expect(() => validatePortalTestSupabaseTarget({
      target: 'staging',
      supabaseUrl: `https://${STAGING_REF}.supabase.co`,
    })).toThrow(/PORTAL_STAGING_SUPABASE_PROJECT_REF/);
  });

  it('refuses matching staging and production declarations', () => {
    expect(() => validatePortalTestSupabaseTarget({
      target: 'staging',
      supabaseUrl: `https://${STAGING_REF}.supabase.co`,
      stagingProjectRef: STAGING_REF,
      productionProjectRef: STAGING_REF,
    })).toThrow(/matches the declared production/);
  });

  it('refuses a staging label pointed at production', () => {
    expect(() => validatePortalTestSupabaseTarget({
      target: 'staging',
      supabaseUrl: `https://${PRODUCTION_REF}.supabase.co`,
      stagingProjectRef: STAGING_REF,
      productionProjectRef: PRODUCTION_REF,
    })).toThrow(/does not exactly match/);
  });
});
