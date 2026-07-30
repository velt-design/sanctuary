import 'server-only';

import {
  recentMarketingConversionOccurrence,
  recordMarketingConversionEvent,
} from './server';

export async function recordPersistedConfirmedSiteVisitConversion(params: {
  projectId: string;
  status: unknown;
  confirmedAt: unknown;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}): Promise<boolean> {
  if (String(params.status ?? '').toUpperCase() !== 'CONFIRMED') return false;
  const occurredAt = recentMarketingConversionOccurrence(params.confirmedAt);
  if (!occurredAt) return false;

  await recordMarketingConversionEvent({
    type: 'marketing.site_visit_booked',
    projectId: params.projectId,
    payload: {
      status: 'CONFIRMED',
      scheduledStart: params.scheduledStart,
      scheduledEnd: params.scheduledEnd,
    },
    occurredAt,
  });
  return true;
}
