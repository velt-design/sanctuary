const PROJECT_ROUTE_TABS = [
  { key: 'activity', label: 'Overview', navigationKey: 'activity' },
  { key: 'estimates', label: 'Calculator', navigationKey: 'estimates' },
  { key: 'quotes', label: 'Commercial', navigationKey: 'quotes' },
  { key: 'invoices', label: 'Commercial', navigationKey: 'quotes' },
  { key: 'job-packs', label: 'Job Packs', navigationKey: 'job-packs' },
] as const;

export type ProjectTabKey = (typeof PROJECT_ROUTE_TABS)[number]['key'];
export type ProjectNavigationTabKey = (typeof PROJECT_ROUTE_TABS)[number]['navigationKey'];

const PROJECT_TAB_KEYS = new Set<ProjectTabKey>(PROJECT_ROUTE_TABS.map((tab) => tab.key));
const PROJECT_NAVIGATION_TABS = PROJECT_ROUTE_TABS.filter((tab) => tab.key === tab.navigationKey);

export function isProjectTabKey(value: string | null | undefined): value is ProjectTabKey {
  return Boolean(value && PROJECT_TAB_KEYS.has(value as ProjectTabKey));
}

export function getAvailableProjectTabs(hasJobPacks: boolean) {
  return PROJECT_NAVIGATION_TABS.filter((tab) => tab.key !== 'job-packs' || hasJobPacks);
}

export function isProjectNavigationTabSelected(
  navigationKey: ProjectNavigationTabKey,
  activeTab: ProjectTabKey,
): boolean {
  return PROJECT_ROUTE_TABS.find((tab) => tab.key === activeTab)?.navigationKey === navigationKey;
}

export function coerceProjectTab(
  value: string | null | undefined,
  hasJobPacks: boolean,
): ProjectTabKey {
  if (!isProjectTabKey(value)) return 'activity';
  if (value === 'job-packs' && !hasJobPacks) return 'activity';
  return value;
}
