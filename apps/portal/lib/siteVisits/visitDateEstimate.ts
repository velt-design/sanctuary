import type { CalendarVisit } from './contract';

type DatedVisit = { origin?: string; day: string | null; at: string | null; basis?: string | null };
export type VisitDateEstimateKind = 'quote' | 'acceptance';

// One current provenance line is required. A stale or conflicting marker invalidates the estimate.
export function visitDateEstimate(visit: DatedVisit): VisitDateEstimateKind | null {
  if (visit.origin !== 'history' || !visit.day || visit.at !== null) return null;
  const markers = (visit.basis ?? '').split(/\r?\n/).filter(line => line.startsWith('Approximate visit date:'));
  if (markers.length !== 1) return null;
  const match = /^Approximate visit date: (\d{4}-\d{2}-\d{2}) \((original quote date|acceptance date); owner-approved\)\.$/.exec(markers[0]);
  return match?.[1] === visit.day ? match[2] === 'original quote date' ? 'quote' : 'acceptance' : null;
}

export function calendarVisitDateEstimate(visit: CalendarVisit): VisitDateEstimateKind | null {
  return visitDateEstimate({ origin: visit.origin, day: visit.timing?.mode === 'date' ? visit.timing.date : null, at: null, basis: visit.correction?.basis });
}

export function visitDateEstimateLabel(kind: VisitDateEstimateKind | null): string {
  return kind === 'quote' ? ' (approx. quote date)' : kind === 'acceptance' ? ' (approx. visit date)' : '';
}
