import fs from 'node:fs';
import path from 'node:path';

import type { PortalRouteCatalogEntry } from './portalRouteCatalog';

export type PortalScenarioId =
  | 'project-with-estimate'
  | 'quote-ready'
  | 'workbench-multi-object'
  | 'schedule-board-basic'
  | 'design-list-basic'
  | 'running-jobs-basic';

type PortalScenarioStatus = 'seeded' | 'planned';

interface PortalScenarioDefinition {
  id: PortalScenarioId;
  status: PortalScenarioStatus;
  requiredRole: 'staff';
  ownerDocs: readonly string[];
  expectedRecords: readonly string[];
  notes: string;
}

export interface PortalScenarioStateRecord {
  scenarioId: PortalScenarioId;
  contactId?: string;
  projectId?: string;
  estimateId?: string;
  quoteId?: string;
  quoteVersionId?: string;
  labels: {
    contactName?: string;
    projectName: string;
    quoteRef?: string;
  };
}

export interface PortalScenarioStateFile {
  generatedAt: string;
  target: 'local' | 'staging';
  prefix: string;
  scenarios: Partial<Record<PortalScenarioId, PortalScenarioStateRecord>>;
}

export const PORTAL_SCENARIO_STATE_PATH = path.resolve(process.cwd(), 'playwright/.auth/portal-scenarios.json');

export const portalScenarioRegistry = [
  {
    id: 'project-with-estimate',
    status: 'seeded',
    requiredRole: 'staff',
    ownerDocs: ['docs/projects-contacts-estimates-calculator.md'],
    expectedRecords: ['contacts', 'projects', 'estimates'],
    notes: 'Deterministic contact, project, and draft estimate for project and estimate route smoke.',
  },
  {
    id: 'quote-ready',
    status: 'seeded',
    requiredRole: 'staff',
    ownerDocs: ['docs/quotes-invoices-job-packs.md'],
    expectedRecords: ['contacts', 'projects', 'estimates', 'quotes', 'quote_versions', 'quote_line_items'],
    notes: 'Deterministic quote version with line items for quote route smoke.',
  },
  {
    id: 'workbench-multi-object',
    status: 'seeded',
    requiredRole: 'staff',
    ownerDocs: ['docs/design-workbench-architecture.md'],
    expectedRecords: ['contacts', 'projects', 'estimates'],
    notes:
      'Project-backed workbench carrier. Browser smoke opens the existing gated multi-object workbench fixture on this project route.',
  },
  {
    id: 'schedule-board-basic',
    status: 'planned',
    requiredRole: 'staff',
    ownerDocs: ['docs/schedule.md'],
    expectedRecords: ['schedule_items', 'crew_lanes'],
    notes: 'Planned until schedule writes have a narrow domain-safe seeding contract.',
  },
  {
    id: 'design-list-basic',
    status: 'planned',
    requiredRole: 'staff',
    ownerDocs: ['docs/design-list.md'],
    expectedRecords: ['design_package_requests'],
    notes: 'Planned until design-list operational state has a narrow domain-safe seeding contract.',
  },
  {
    id: 'running-jobs-basic',
    status: 'planned',
    requiredRole: 'staff',
    ownerDocs: ['docs/running-jobs.md'],
    expectedRecords: ['running_jobs'],
    notes: 'Planned until running-jobs operational state has a narrow domain-safe seeding contract.',
  },
] as const satisfies readonly PortalScenarioDefinition[];

export const seededPortalScenarios = portalScenarioRegistry.filter(
  (scenario): scenario is PortalScenarioDefinition & { status: 'seeded' } => scenario.status === 'seeded',
);

export function loadPortalScenarioState(filePath = PORTAL_SCENARIO_STATE_PATH): PortalScenarioStateFile {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Portal scenario state file is missing: ${path.relative(process.cwd(), filePath)}. Run npm run portal:scenarios:ensure before npm run portal:agent-scenarios.`,
    );
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as PortalScenarioStateFile;
  if (!parsed || typeof parsed !== 'object' || !parsed.scenarios || typeof parsed.scenarios !== 'object') {
    throw new Error(`Portal scenario state file is invalid: ${path.relative(process.cwd(), filePath)}.`);
  }

  return parsed;
}

export function getPortalScenarioState(
  state: PortalScenarioStateFile,
  scenarioId: PortalScenarioId,
): PortalScenarioStateRecord {
  const scenario = state.scenarios[scenarioId];
  if (!scenario) {
    throw new Error(`Portal scenario "${scenarioId}" is missing from the scenario state file.`);
  }
  return scenario;
}

export function routeForPortalScenario(entry: PortalRouteCatalogEntry, state: PortalScenarioStateFile): string {
  if (!entry.scenarioId) {
    throw new Error(`Portal route "${entry.id}" does not declare a scenario id.`);
  }

  const scenario = getPortalScenarioState(state, entry.scenarioId);
  const projectId = scenario.projectId;
  if (!projectId) {
    throw new Error(`Portal scenario "${scenario.scenarioId}" does not include a projectId for route "${entry.id}".`);
  }

  switch (entry.id) {
    case 'project-detail':
      return `/staff/projects/${encodeURIComponent(projectId)}`;
    case 'estimate-detail': {
      if (!scenario.estimateId) {
        throw new Error(`Portal scenario "${scenario.scenarioId}" does not include an estimateId.`);
      }
      return `/staff/projects/${encodeURIComponent(projectId)}/estimate/${encodeURIComponent(scenario.estimateId)}`;
    }
    case 'quote-detail': {
      const quoteVersionId = scenario.quoteVersionId;
      if (!quoteVersionId) {
        throw new Error(`Portal scenario "${scenario.scenarioId}" does not include a quoteVersionId.`);
      }
      return `/staff/projects/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(quoteVersionId)}`;
    }
    case 'design-workbench':
      return `/staff/projects/${encodeURIComponent(projectId)}/design-workbench?fixture=multi-house-u-two-pergola`;
    default:
      throw new Error(`Portal route "${entry.id}" is not wired to a seeded scenario route.`);
  }
}
