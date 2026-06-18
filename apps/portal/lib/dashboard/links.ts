import type { ProjectStatus } from './types';

export function projectsHref(params: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined) return;
    sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `/staff/projects?${qs}` : '/staff/projects';
}

export function projectDetailHref(projectId: string) {
  return `/staff/projects/${projectId}`;
}

export function scheduleHref(view: 'board' | 'gantt') {
  return `/staff/schedule?view=${view}`;
}

export function siteVisitsHref() {
  return '/staff/schedule?view=site-visits';
}

export function statusHref(status: ProjectStatus | string) {
  return projectsHref({ status });
}
