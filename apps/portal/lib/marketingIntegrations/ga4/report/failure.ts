import { z } from 'zod';

const stages = ['core_authority', 'core_request', 'core_response', 'acquisition_authority', 'acquisition_request', 'acquisition_response', 'collection', 'normalization'] as const;
export type ReportFailureStage = typeof stages[number];
export type ReportFailureContext = { stage: ReportFailureStage; status?: number };
export class Ga4ReportFailure extends Error {
  constructor(readonly diagnostic: ReportFailureContext & { reason: string; schemaIssues?: { report: number | null; field: string; code: string }[];
    structure?: { reportIndex: number; returnedRows: number; reportedRows: number; combinations: number; ranges: number; duplicatePair: boolean; outsideOwnRangeNonzero: boolean }[] }) { super('GA4 report unavailable.'); }
}
export const validationReasons: Record<string, string> = {
  "Invalid report value.": "invalid_metric", "Choose completed days in the property timezone.": "incomplete_dates",
  "Report headers mismatch.": "report_headers", "Report metric mismatch.": "report_metric",
  "Report rows truncated.": "report_rows_truncated", "Report row count inconsistent.": "report_row_count_inconsistent",
  "Report timezone mismatch.": "report_timezone",
  "Report metrics are restricted.": "restricted_metrics",
  "Report dimensions mismatch.": "dimension_count", "Unknown date range.": "unknown_range",
  "Invalid dimension label.": "invalid_label", "Invalid daily date.": "invalid_date",
  "Daily date outside request.": "date_outside_range", "Landing page contains query data.": "query_bearing_path",
  "Duplicate report row.": "duplicate_row", "Sessions must be integers.": "fractional_sessions",
  "Provider response exceeded limit.": "response_limit", "Provider response missing.": "response_missing",
};
const reasons = new Set([...Object.values(validationReasons), 'provider_http', 'response_schema', 'provider_timeout', 'transport_or_response', 'report_validation']);

/** Private runtime logs receive a projection, never an Error or diagnostic spread. */
export function reportFailureLog(error: unknown, fallback: 'collection' | 'normalization') {
  const diagnostic = error instanceof Ga4ReportFailure ? error.diagnostic : undefined;
  const stage = diagnostic && stages.includes(diagnostic.stage) ? diagnostic.stage : fallback;
  const reason = diagnostic && reasons.has(diagnostic.reason) ? diagnostic.reason
    : error instanceof z.ZodError ? 'response_schema' : fallback === 'normalization' ? 'report_validation' : 'transport_or_response';
  const status = diagnostic?.status;
  return { stage, reason, ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}) };
}
