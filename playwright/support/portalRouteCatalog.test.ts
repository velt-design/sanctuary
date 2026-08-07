import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PORTAL_INSTANT_ROUTE_DEFINITIONS,
  portalInstantRouteForPathname,
} from '../../apps/portal/lib/portalInstantRoutes';
import { portalScenarioRegistry, seededPortalScenarios } from './portalScenarioRegistry';
import { agentAccessSmokeRoutes, agentScenarioSmokeRoutes, portalRouteCatalog } from './portalRouteCatalog';

const categories = new Set(['core', 'project', 'commercial', 'schedule', 'workbench', 'admin', 'diagnostic']);
const roles = new Set(['public', 'staff', 'admin', 'fixture']);
const dataRequirements = new Set([
  'none',
  'visible_project',
  'project_id',
  'estimate_id',
  'quote_id',
  'redirect_only',
  'fixture_flag',
  'admin_role',
  'scenario_required',
]);
const smokeStatuses = new Set(['agent-access', 'scenario-required', 'admin-only', 'fixture-only', 'catalog-only']);
const shellMarkers = new Set([
  'public-auth-shell',
  'portal-shell',
  'admin-shell',
  'fixture-shell',
  'authenticated-standalone-shell',
]);
const debugExportStatuses = new Set(['exported', 'planned', 'not-applicable']);
const instantShellStatuses = new Set(['required', 'excluded', 'redirect']);

function collectPageRoutes(directory: string, routeSegments: string[] = []): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      const segment = entry.name.replace(/^\[(.+)\]$/, ':$1');
      return collectPageRoutes(path.join(directory, entry.name), [...routeSegments, segment]);
    }
    if (entry.name !== 'page.tsx') return [];
    return [`/${routeSegments.join('/')}`.replace(/\/$/, '') || '/'];
  });
}

function concreteRoutePath(routePattern: string): string {
  return routePattern
    .split('?')[0]
    .replace(/:[^/]+/g, 'fixture-id');
}

describe('portalRouteCatalog', () => {
  it('has valid metadata and owner docs for every cataloged route', () => {
    const ids = new Set<string>();

    for (const entry of portalRouteCatalog) {
      expect(entry.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(ids.has(entry.id), `Duplicate portal route catalog id: ${entry.id}`).toBe(false);
      ids.add(entry.id);

      expect(entry.routePattern, entry.id).toMatch(/^\//);
      expect(categories.has(entry.category), entry.id).toBe(true);
      expect(roles.has(entry.requiredRole), entry.id).toBe(true);
      expect(dataRequirements.has(entry.dataRequirement), entry.id).toBe(true);
      expect(smokeStatuses.has(entry.smokeStatus), entry.id).toBe(true);
      expect(shellMarkers.has(entry.expectedShell), entry.id).toBe(true);
      expect(debugExportStatuses.has(entry.debugExportStatus), entry.id).toBe(true);
      expect(instantShellStatuses.has(entry.instantShell.status), entry.id).toBe(true);
      expect(entry.notes.trim().length, entry.id).toBeGreaterThan(0);

      expect(entry.ownerDoc, entry.id).toMatch(/^docs\/.+\.md$/);
      expect(existsSync(path.resolve(process.cwd(), entry.ownerDoc)), entry.ownerDoc).toBe(true);

      if (entry.scenarioId) {
        expect(
          portalScenarioRegistry.some((scenario) => scenario.id === entry.scenarioId),
          `${entry.id} references unknown scenario ${entry.scenarioId}`,
        ).toBe(true);
      }
    }
  });

  it('inventories every application page route', () => {
    const filesystemRoutes = collectPageRoutes(path.resolve(process.cwd(), 'apps/portal/app')).sort();
    const catalogRoutes = portalRouteCatalog.map((entry) => entry.routePattern.split('?')[0]).sort();
    expect(catalogRoutes).toEqual(filesystemRoutes);
  });

  it('keeps every required application route aligned with the instant-shell registry', () => {
    const requiredEntries = portalRouteCatalog.filter(
      (entry) => entry.instantShell.status === 'required',
    );

    for (const entry of requiredEntries) {
      const pathname = concreteRoutePath(entry.routePattern);
      expect(portalInstantRouteForPathname(pathname), entry.id).toBe(entry.instantShell.route);
    }

    expect(
      [...new Set(requiredEntries.map((entry) => entry.instantShell.route))].sort(),
    ).toEqual(Object.keys(PORTAL_INSTANT_ROUTE_DEFINITIONS).sort());
  });

  it('requires normal authenticated pages while keeping diagnostics explicitly excluded', () => {
    for (const entry of portalRouteCatalog) {
      if (
        (entry.requiredRole === 'staff' || entry.requiredRole === 'admin')
        && entry.category !== 'diagnostic'
        && entry.instantShell.status !== 'redirect'
      ) {
        expect(entry.instantShell.status, entry.id).toBe('required');
      }
    }

    expect(portalRouteCatalog.find((entry) => entry.id === 'sidebar-lab')?.instantShell)
      .toEqual({ status: 'excluded' });
  });

  it('keeps the initial authenticated agent smoke intentionally small', () => {
    expect(agentAccessSmokeRoutes.map((entry) => entry.id)).toEqual([
      'dashboard',
      'ui-foundation',
      'projects-index',
      'contacts-index',
      'schedule',
    ]);

    for (const entry of agentAccessSmokeRoutes) {
      expect(entry.requiredRole).toBe('staff');
      expect(entry.expectedShell).toBe('portal-shell');
      expect(entry.runnableRoute).toMatch(/^\//);
      expect(entry.expectedHeading.trim().length).toBeGreaterThan(0);
    }
  });

  it('does not accidentally make scenario, admin, or fixture routes runnable as staff smoke', () => {
    for (const entry of portalRouteCatalog) {
      if (entry.smokeStatus === 'scenario-required') {
        expect(entry.runnableRoute, `${entry.id} should wait for seeded scenarios`).toBeUndefined();
        expect(entry.scenarioId, `${entry.id} should declare the scenario that owns its seeded route`).toBeTruthy();
      }

      if (entry.smokeStatus === 'admin-only') {
        expect(entry.requiredRole, entry.id).toBe('admin');
        expect(entry.dataRequirement, entry.id).toBe('admin_role');
      }

      if (entry.smokeStatus === 'fixture-only') {
        expect(entry.requiredRole, entry.id).toBe('fixture');
        expect(entry.dataRequirement, entry.id).toBe('fixture_flag');
      }
    }
  });

  it('keeps dynamic agent scenario smoke tied to seeded scenarios', () => {
    expect(agentScenarioSmokeRoutes.map((entry) => entry.id)).toEqual([
      'project-detail',
      'estimate-detail',
      'quote-detail',
      'design-workbench',
      'calculator',
    ]);

    const seededIds = new Set(seededPortalScenarios.map((scenario) => scenario.id));
    for (const entry of agentScenarioSmokeRoutes) {
      expect(entry.requiredRole).toBe('staff');
      expect(entry.expectedShell).toBe('portal-shell');
      expect(seededIds.has(entry.scenarioId), entry.id).toBe(true);
    }
  });
});

describe('portalScenarioRegistry', () => {
  it('has valid unique metadata and owner docs for every scenario', () => {
    const ids = new Set<string>();

    for (const scenario of portalScenarioRegistry) {
      expect(scenario.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(ids.has(scenario.id), `Duplicate portal scenario id: ${scenario.id}`).toBe(false);
      ids.add(scenario.id);

      expect(['seeded', 'planned']).toContain(scenario.status);
      expect(scenario.requiredRole).toBe('staff');
      expect(scenario.expectedRecords.length, scenario.id).toBeGreaterThan(0);
      expect(scenario.notes.trim().length, scenario.id).toBeGreaterThan(0);

      for (const ownerDoc of scenario.ownerDocs) {
        expect(ownerDoc, scenario.id).toMatch(/^docs\/.+\.md$/);
        expect(existsSync(path.resolve(process.cwd(), ownerDoc)), ownerDoc).toBe(true);
      }
    }
  });
});
