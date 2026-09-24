import type { Measure, ReportQuery } from "./report";
import type { readPraxisMarketing } from "../../../praxis/marketing-read";
type MarketingEvidence = Awaited<ReturnType<typeof readPraxisMarketing>>;

export interface BusinessOutcomes {
  source: "sanctuary"; timezone: "Pacific/Auckland"; fetchedAt: string; query: ReportQuery;
  counts: Measure[]; excludedTestRecords: number; warnings: string[];
}
export type BusinessEvidence = { status: "available"; binding: string; operations: string[]; report: BusinessOutcomes }
  | { status: "unavailable"; reason: "connection_unavailable" | "complete_snapshot_unavailable" };

// Consume the existing authoritative Sanctuary aggregate; no customer rows.
export function businessOutcomes(evidence: MarketingEvidence): BusinessOutcomes {
  return { source: "sanctuary", timezone: evidence.timezone, fetchedAt: evidence.source.asOf, query: evidence.query,
    counts: evidence.counts.map(row => { if (!row.label) throw new Error("Business outcome label unavailable."); return { ...row, label: row.label }; }), excludedTestRecords: evidence.excludedTestRecords,
    warnings: ["Counts describe activity within each period, not the same group of leads progressing through a funnel. Quotes can originate from earlier enquiries.",
      "Each quote is counted once per period for sent or accepted activity, even if multiple versions qualify. Acceptance is recorded activity, not proof of payment or a currently active contract.",
      "The exact labelled measurement-test enquiry and its project are excluded. Other test records have not been classified; no name-based guessing is applied."] };
}
