import type { PortalScenarioId } from './portalScenarioRegistry';

type PortalRouteCategory = 'core' | 'project' | 'commercial' | 'schedule' | 'workbench' | 'admin' | 'diagnostic';

type PortalRouteRequiredRole = 'staff' | 'admin' | 'fixture';

type PortalRouteDataRequirement =
  | 'none'
  | 'visible_project'
  | 'project_id'
  | 'estimate_id'
  | 'quote_id'
  | 'fixture_flag'
  | 'admin_role'
  | 'scenario_required';

export type PortalRouteSmokeStatus = 'agent-access' | 'scenario-required' | 'admin-only' | 'fixture-only' | 'catalog-only';

export type PortalRouteDebugExportStatus = 'exported' | 'planned' | 'not-applicable';

type PortalShellMarker = 'portal-shell' | 'admin-shell' | 'fixture-shell';

export interface PortalRouteCatalogEntry {
  id: string;
  category: PortalRouteCategory;
  routePattern: string;
  runnableRoute?: string;
  requiredRole: PortalRouteRequiredRole;
  ownerDoc: string;
  expectedHeading?: string;
  expectedShell: PortalShellMarker;
  dataRequirement: PortalRouteDataRequirement;
  smokeStatus: PortalRouteSmokeStatus;
  debugExportStatus: PortalRouteDebugExportStatus;
  scenarioId?: PortalScenarioId;
  notes: string;
}

export const portalRouteCatalog = [
  {
    id: 'dashboard',
    category: 'core',
    routePattern: '/dashboard',
    runnableRoute: '/dashboard',
    requiredRole: 'staff',
    ownerDoc: 'docs/platform-workflow.md',
    expectedHeading: 'Dashboard',
    expectedShell: 'portal-shell',
    dataRequirement: 'none',
    smokeStatus: 'agent-access',
    debugExportStatus: 'not-applicable',
    notes: 'Core authenticated landing page and pipeline summary.',
  },
  {
    id: 'projects-index',
    category: 'project',
    routePattern: '/staff/projects',
    runnableRoute: '/staff/projects',
    requiredRole: 'staff',
    ownerDoc: 'docs/projects-contacts-estimates-calculator.md',
    expectedHeading: 'Projects',
    expectedShell: 'portal-shell',
    dataRequirement: 'visible_project',
    smokeStatus: 'agent-access',
    debugExportStatus: 'not-applicable',
    notes: 'Project list and current source for first visible project discovery.',
  },
  {
    id: 'contacts-index',
    category: 'project',
    routePattern: '/staff/contacts',
    runnableRoute: '/staff/contacts',
    requiredRole: 'staff',
    ownerDoc: 'docs/projects-contacts-estimates-calculator.md',
    expectedHeading: 'Contacts',
    expectedShell: 'portal-shell',
    dataRequirement: 'none',
    smokeStatus: 'agent-access',
    debugExportStatus: 'not-applicable',
    notes: 'Contact list; deeper create/detail scenarios belong to seeded coverage.',
  },
  {
    id: 'schedule',
    category: 'schedule',
    routePattern: '/staff/schedule',
    runnableRoute: '/staff/schedule',
    requiredRole: 'staff',
    ownerDoc: 'docs/schedule.md',
    expectedHeading: 'Schedule',
    expectedShell: 'portal-shell',
    dataRequirement: 'none',
    smokeStatus: 'agent-access',
    debugExportStatus: 'planned',
    notes: 'Schedule shell plus readiness API are covered by auth-runtime.',
  },
  {
    id: 'project-detail',
    category: 'project',
    routePattern: '/staff/projects/:projectId',
    requiredRole: 'staff',
    ownerDoc: 'docs/projects-contacts-estimates-calculator.md',
    expectedShell: 'portal-shell',
    dataRequirement: 'project_id',
    smokeStatus: 'scenario-required',
    debugExportStatus: 'exported',
    scenarioId: 'project-with-estimate',
    notes: 'Requires a known project id before reliable agent smoke coverage.',
  },
  {
    id: 'estimate-detail',
    category: 'commercial',
    routePattern: '/staff/projects/:projectId/estimate/:estimateId',
    requiredRole: 'staff',
    ownerDoc: 'docs/projects-contacts-estimates-calculator.md',
    expectedShell: 'portal-shell',
    dataRequirement: 'estimate_id',
    smokeStatus: 'scenario-required',
    debugExportStatus: 'exported',
    scenarioId: 'project-with-estimate',
    notes: 'Requires a project with a durable estimate scenario.',
  },
  {
    id: 'quote-detail',
    category: 'commercial',
    routePattern: '/staff/projects/:projectId/quotes/:quoteId',
    requiredRole: 'staff',
    ownerDoc: 'docs/quotes-invoices-job-packs.md',
    expectedShell: 'portal-shell',
    dataRequirement: 'quote_id',
    smokeStatus: 'scenario-required',
    debugExportStatus: 'exported',
    scenarioId: 'quote-ready',
    notes: 'Requires a quote-ready seeded scenario.',
  },
  {
    id: 'design-workbench',
    category: 'workbench',
    routePattern: '/staff/projects/:projectId/design-workbench',
    requiredRole: 'staff',
    ownerDoc: 'docs/design-workbench-architecture.md',
    expectedShell: 'portal-shell',
    dataRequirement: 'project_id',
    smokeStatus: 'scenario-required',
    debugExportStatus: 'exported',
    scenarioId: 'workbench-multi-object',
    notes: 'Project-backed workbench coverage requires a known project/design state.',
  },
  {
    id: 'design-list',
    category: 'project',
    routePattern: '/staff/projects/design-packages',
    requiredRole: 'staff',
    ownerDoc: 'docs/design-list.md',
    expectedHeading: 'Design Packages',
    expectedShell: 'portal-shell',
    dataRequirement: 'scenario_required',
    smokeStatus: 'catalog-only',
    debugExportStatus: 'planned',
    notes: 'Operational list; route is cataloged now and should join smoke after stable seeded data exists.',
  },
  {
    id: 'running-jobs',
    category: 'project',
    routePattern: '/staff/projects/running-jobs',
    requiredRole: 'staff',
    ownerDoc: 'docs/running-jobs.md',
    expectedHeading: 'Running Jobs',
    expectedShell: 'portal-shell',
    dataRequirement: 'scenario_required',
    smokeStatus: 'catalog-only',
    debugExportStatus: 'planned',
    notes: 'Operational spreadsheet; route is cataloged now and should join smoke after stable seeded data exists.',
  },
  {
    id: 'calculator',
    category: 'commercial',
    routePattern: '/staff/calculator',
    requiredRole: 'staff',
    ownerDoc: 'docs/projects-contacts-estimates-calculator.md',
    expectedHeading: 'Calculator',
    expectedShell: 'portal-shell',
    dataRequirement: 'estimate_id',
    smokeStatus: 'scenario-required',
    debugExportStatus: 'planned',
    scenarioId: 'project-with-estimate',
    notes: 'Authenticated calculator trust coverage uses a valid V2 project estimate scenario.',
  },
  {
    id: 'admin-home',
    category: 'admin',
    routePattern: '/admin',
    requiredRole: 'admin',
    ownerDoc: 'docs/environment-auth-supabase.md',
    expectedShell: 'admin-shell',
    dataRequirement: 'admin_role',
    smokeStatus: 'admin-only',
    debugExportStatus: 'planned',
    notes: 'Admin-only shell; skip for the default staff test account.',
  },
  {
    id: 'pricebook',
    category: 'admin',
    routePattern: '/pricebook',
    requiredRole: 'admin',
    ownerDoc: 'docs/costing-and-geometry.md',
    expectedShell: 'admin-shell',
    dataRequirement: 'admin_role',
    smokeStatus: 'admin-only',
    debugExportStatus: 'planned',
    notes: 'Admin pricebook route; staff sessions may redirect to calculator.',
  },
  {
    id: 'admin-cost-materials',
    category: 'admin',
    routePattern: '/admin/costs/materials',
    requiredRole: 'admin',
    ownerDoc: 'docs/costing-and-geometry.md',
    expectedShell: 'admin-shell',
    dataRequirement: 'admin_role',
    smokeStatus: 'admin-only',
    debugExportStatus: 'planned',
    notes: 'Admin cost material maintenance route.',
  },
  {
    id: 'admin-cost-actions',
    category: 'admin',
    routePattern: '/admin/costs/actions',
    requiredRole: 'admin',
    ownerDoc: 'docs/costing-and-geometry.md',
    expectedShell: 'admin-shell',
    dataRequirement: 'admin_role',
    smokeStatus: 'admin-only',
    debugExportStatus: 'planned',
    notes: 'Admin install-action maintenance route.',
  },
  {
    id: 'admin-cost-overheads',
    category: 'admin',
    routePattern: '/admin/costs/overheads',
    requiredRole: 'admin',
    ownerDoc: 'docs/costing-and-geometry.md',
    expectedShell: 'admin-shell',
    dataRequirement: 'admin_role',
    smokeStatus: 'admin-only',
    debugExportStatus: 'planned',
    notes: 'Admin overhead maintenance route.',
  },
  {
    id: 'admin-imports',
    category: 'admin',
    routePattern: '/admin/imports',
    requiredRole: 'admin',
    ownerDoc: 'docs/supabase-schema-map.md',
    expectedShell: 'admin-shell',
    dataRequirement: 'admin_role',
    smokeStatus: 'admin-only',
    debugExportStatus: 'planned',
    notes: 'Admin import tooling; mutating flows need explicit scenario planning.',
  },
  {
    id: 'qa-design-workbench-fixture',
    category: 'diagnostic',
    routePattern: '/qa/design-workbench-fixture?fixture=:fixtureSlug',
    requiredRole: 'fixture',
    ownerDoc: 'docs/design-workbench-architecture.md',
    expectedShell: 'fixture-shell',
    dataRequirement: 'fixture_flag',
    smokeStatus: 'fixture-only',
    debugExportStatus: 'exported',
    notes: 'Hidden fixture route gated by ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES.',
  },
] as const satisfies readonly PortalRouteCatalogEntry[];

export const agentAccessSmokeRoutes = portalRouteCatalog.filter(
  (entry): entry is PortalRouteCatalogEntry & { runnableRoute: string; expectedHeading: string } =>
    entry.smokeStatus === 'agent-access' && Boolean(entry.runnableRoute) && Boolean(entry.expectedHeading),
);

export const agentScenarioSmokeRoutes = portalRouteCatalog.filter(
  (entry): entry is PortalRouteCatalogEntry & { scenarioId: PortalScenarioId } =>
    entry.smokeStatus === 'scenario-required' && Boolean(entry.scenarioId),
);
