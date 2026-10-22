import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { readSavedVisits } from '@/lib/siteVisits/readSavedVisits.server';
import { calendarVisitsSearch, type CalendarVisitsInitialRead, type CalendarVisitScope, type SavedVisitsResult } from '@/lib/siteVisits/savedVisitsContract';

/** The page must finish its fresh staff gate before starting this saved-calendar read. */
export function loadCalendarVisitsInitialRead(ownerId: string, host: string, scope: CalendarVisitScope): CalendarVisitsInitialRead {
  const result = (async (): Promise<SavedVisitsResult> => {
    try { return await readSavedVisits(await getSupabaseServerAuth(), calendarVisitsSearch(scope)); }
    catch { return { ok: false, status: 503, message: 'Site visits could not be loaded.' }; }
  })();
  return { id: randomUUID(), ownerId, host, ...scope, result };
}
