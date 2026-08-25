// @vitest-environment node

import { describe, expect, it } from 'vitest';
import config from './playwright.config';

describe('portal Playwright fixture server', () => {
  it('provides inert Supabase placeholders when local credentials are absent', () => {
    expect(Array.isArray(config.webServer)).toBe(false);
    const webServer = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;

    expect(webServer?.env).toMatchObject({
      ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES: '1',
      ENABLE_PORTAL_QA_FIXTURES: '1',
      NEXT_PUBLIC_SUPABASE_URL: expect.any(String),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: expect.any(String),
    });
  });
});
