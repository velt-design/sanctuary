import { describe, expect, it } from 'vitest';

import {
  assertPortalPageDebugExport,
  buildPortalPageDebugExport,
  isPortalPageDebugExportEnabled,
} from './portalPageDebugExport';

describe('portal page debug export contract', () => {
  it('requires an explicit non-production debug flag', () => {
    expect(
      isPortalPageDebugExportEnabled({
        NODE_ENV: 'production',
        ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(false);

    expect(
      isPortalPageDebugExportEnabled({
        NODE_ENV: 'development',
      } as NodeJS.ProcessEnv),
    ).toBe(false);

    expect(
      isPortalPageDebugExportEnabled({
        NODE_ENV: 'development',
        ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);

    expect(
      isPortalPageDebugExportEnabled({
        NODE_ENV: 'test',
        PORTAL_PAGE_DEBUG_EXPORTS: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('builds a valid shared payload', () => {
    const payload = buildPortalPageDebugExport({
      pageId: 'project-detail',
      route: '/staff/projects/proj_agent',
      capturedAt: '2026-06-02T00:00:00.000Z',
      environment: { nodeEnv: 'test', debugFlag: true },
      selectedIds: { projectId: 'proj_agent' },
      serverState: { projectName: '[Agent Scenario] Project' },
      clientState: {},
      diagnostics: { status: 'ready' },
      scenario: { scenarioId: 'project-with-estimate', label: '[Agent Scenario] Project' },
    });

    expect(() => assertPortalPageDebugExport(payload)).not.toThrow();
    expect(payload.version).toBe(1);
  });

  it('rejects missing required fields', () => {
    expect(() => assertPortalPageDebugExport({ version: 1, route: '/dashboard' })).toThrow(/pageId/);
    expect(() => assertPortalPageDebugExport({ version: 1, pageId: 'dashboard' })).toThrow(/route/);
    expect(() => assertPortalPageDebugExport({ version: 2, pageId: 'dashboard', route: '/dashboard' })).toThrow(
      /unsupported version/,
    );
  });
});
