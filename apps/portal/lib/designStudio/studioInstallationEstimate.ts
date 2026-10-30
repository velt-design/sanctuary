import type { SiteOutputV1 } from '@sp/costing';

/** Operational days are safe for designers; crew hours and costs stay admin-only. */
export type StudioInstallationEstimate = { siteDays: number };

export function studioInstallationEstimate(output: Pick<SiteOutputV1, 'site_days'>): StudioInstallationEstimate | null {
  return Number.isSafeInteger(output.site_days) && Number(output.site_days) > 0
    ? { siteDays: output.site_days! } : null;
}
