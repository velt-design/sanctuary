import type { VisitSnapshot } from './contract';

export type SavedVisitsResult =
  | { ok: true; data: VisitSnapshot }
  | { ok: false; status: number; message: string };
export type CalendarVisitScope = { project: string | null; visit: string | null };
export type CalendarVisitsInitialRead = CalendarVisitScope & {
  id: string; ownerId: string; host: string; result: Promise<SavedVisitsResult>;
};
export function calendarVisitsSearch(scope: CalendarVisitScope) {
  return new URLSearchParams({ ...scope.project ? { project: scope.project } : {}, ...scope.visit ? { visit: scope.visit } : {} });
}
