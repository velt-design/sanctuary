import type { HubFilters, HubReport } from '@/lib/marketingPerformance/hub';
import { selectHub } from '@/lib/marketingPerformance/hub';

export function needsOverviewProjects(filters: HubFilters) {
  return Boolean(filters.source || filters.campaign || filters.owner || filters.stage || filters.state || filters.evidence !== 'all');
}

export function overviewProjectIds(hub: HubReport | null, filters: HubFilters): Set<string> | null {
  if (hub) return new Set(selectHub(hub, { ...filters, inspect: 'all' }).projects.map(project => project.id));
  return needsOverviewProjects(filters) ? new Set<string>() : null;
}
