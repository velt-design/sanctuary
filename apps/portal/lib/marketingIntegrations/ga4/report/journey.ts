import type { Measure, ReportQuery } from "./report";

// The verified production release began collecting these stages on this date.
// Earlier and release-day figures cannot establish a comparable complete day.
export const JOURNEY_COMPLETE_FROM = "2026-09-17";
export const JOURNEY_EVENTS = ["design_start", "design_edit", "design_review", "contact_start", "contact_success", "generate_lead"] as const;
export interface WebsiteJourney { counts: Measure[]; completeFrom: typeof JOURNEY_COMPLETE_FROM }

export function websiteJourney(rows: Measure[], query: ReportQuery): WebsiteJourney {
  return { completeFrom: JOURNEY_COMPLETE_FROM, counts: JOURNEY_EVENTS.map(label => {
    const row = rows.find(item => item.label === label);
    return { label, value: row?.value ?? null,
      previous: query.comparison && query.comparison.start >= JOURNEY_COMPLETE_FROM ? row?.previous ?? null : null };
  }) };
}
