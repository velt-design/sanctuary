const PROJECT_TABS = [
  { key: 'activity', label: 'Overview' },
  { key: 'estimates', label: 'Designs' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'job-packs', label: 'Job Packs' },
  { key: 'emails', label: 'Emails' },
] as const;

export type ProjectTabKey = (typeof PROJECT_TABS)[number]['key'];

const PROJECT_TAB_KEYS = new Set<ProjectTabKey>(PROJECT_TABS.map((tab) => tab.key));

export function isProjectTabKey(value: string | null | undefined): value is ProjectTabKey {
  return Boolean(value && PROJECT_TAB_KEYS.has(value as ProjectTabKey));
}

export function getAvailableProjectTabs(hasJobPacks: boolean) {
  return PROJECT_TABS.filter((tab) => tab.key !== 'job-packs' || hasJobPacks);
}

export function coerceProjectTab(
  value: string | null | undefined,
  hasJobPacks: boolean,
): ProjectTabKey {
  if (!isProjectTabKey(value)) return 'activity';
  if (value === 'job-packs' && !hasJobPacks) return 'activity';
  return value;
}
