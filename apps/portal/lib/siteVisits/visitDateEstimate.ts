import type { CalendarVisit } from './contract';

type DatedVisit = { origin?: string; day: string | null; at: string | null; basis?: string | null };

// A date edit invalidates the estimate unless its explicit provenance is updated too.
export function isQuoteDateEstimate(visit: DatedVisit): boolean {
  if (visit.origin !== 'history' || !visit.day || visit.at !== null) return false;
  const markers = [...(visit.basis ?? '').matchAll(/^Approximate visit date: (\d{4}-\d{2}-\d{2}) \(original quote date; owner-approved\)\.\r?$/gm)];
  return markers.length === 1 && markers[0][1] === visit.day;
}

export function isCalendarQuoteDateEstimate(visit: CalendarVisit): boolean {
  return isQuoteDateEstimate({ origin: visit.origin, day: visit.timing?.mode === 'date' ? visit.timing.date : null, at: null, basis: visit.correction?.basis });
}
