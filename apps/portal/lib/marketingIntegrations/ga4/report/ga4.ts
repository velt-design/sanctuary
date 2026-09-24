import { createHash } from "node:crypto";
import { z } from "zod";
import { boundedGoogleJson } from "./transport";
import { websiteJourney } from "./journey";
import { periodDays, shiftDate, validateQuery, validDate, type AnalyticsReport, type Measure, type PaneId, type ReportQuery } from "./report";

export const REPORT_VERSION = "sanctuary-ga4-v2";
const periodSchema = z.object({ start: z.string(), end: z.string() }).strict();
export const querySchema = z.object({ period: periodSchema, comparison: periodSchema.nullable() }).strict()
  .refine(query => validateQuery(query) === null);
const DEFINITIONS = [
  { id: "traffic", dimension: "date", metric: "sessions" },
  { id: "channels", dimension: "sessionDefaultChannelGroup", metric: "sessions" },
  { id: "landing", dimension: "landingPage", metric: "sessions" },
  { id: "events", dimension: "eventName", metric: "keyEvents" },
  { id: "total", dimension: null, metric: "sessions" },
] as const;

export function reportPlan(query: ReportQuery) {
  querySchema.parse(query);
  const dateRanges = [{ startDate: query.period.start, endDate: query.period.end, name: "selected" },
    ...(query.comparison ? [{ startDate: query.comparison.start, endDate: query.comparison.end, name: "prior" }] : [])];
  return { requests: DEFINITIONS.map(definition => ({
    dimensions: definition.dimension ? [{ name: definition.dimension }] : [], metrics: [{ name: definition.metric }, ...(definition.id === "events" ? [{ name: "eventCount" }] : [])], dateRanges,
    limit: "201", keepEmptyRows: true, returnPropertyQuota: true,
    ...(definition.dimension ? { orderBys: [{ dimension: { dimensionName: definition.dimension } }] } : {}),
  })) };
}
export const reportHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function reportIntent(property: string, query: ReportQuery) {
  return { property, queryHash: reportHash({ version: REPORT_VERSION, property, plan: reportPlan(query) }),
    startDate: query.period.start, endDate: query.period.end,
    comparisonStart: query.comparison?.start ?? null, comparisonEnd: query.comparison?.end ?? null, reportVersion: REPORT_VERSION };
}
const valueSchema = z.object({ value: z.string().max(512) });
const rowSchema = z.object({ dimensionValues: z.array(valueSchema).max(2).default([]), metricValues: z.array(valueSchema).min(1).max(2) });
const responseSchema = z.object({
  dimensionHeaders: z.array(z.object({ name: z.string() })).max(2).default([]),
  metricHeaders: z.array(z.object({ name: z.string(), type: z.enum(["TYPE_INTEGER", "TYPE_FLOAT"]) })).min(1).max(2),
  // GA4 can expand each of at most 200 dimension groups into two range rows.
  // completeComparisonRows below requires the exact complete product.
  rows: z.array(rowSchema).max(400).default([]), rowCount: z.number().int().min(0).max(200).default(0),
  metadata: z.object({ timeZone: z.string().min(1).max(80), dataLossFromOtherRow: z.boolean().default(false),
    subjectToThresholding: z.boolean().default(false), emptyReason: z.string().max(512).optional(),
    samplingMetadatas: z.array(z.object({ samplesReadCount: z.string().regex(/^\d+$/), samplingSpaceSize: z.string().regex(/^\d+$/) })).max(2).optional(),
    schemaRestrictionResponse: z.object({ activeMetricRestrictions: z.array(z.unknown()).max(10).optional() }).optional(),
  }),
});
const batchSchema = z.object({ reports: z.array(responseSchema).length(5), kind: z.literal("analyticsData#batchRunReports").optional() });
function numeric(value: string): number {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error("Invalid report value.");
  const number = Number(value);
  if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER) throw new Error("Invalid report value.");
  return number;
}

function completeComparisonRows(report: z.infer<typeof responseSchema>, headers: string[], query: ReportQuery, dimension: string | null): boolean {
  // Live Data API evidence: dimension reports count distinct dimension groups
  // before expanding the two named ranges. Accept only the complete product.
  if (dimension && query.comparison && report.rows.length === report.rowCount * 2) {
    const labels = new Set<string>(), pairs = new Set<string>();
    const complete = report.rows.every(row => {
      const label = row.dimensionValues[headers.indexOf(dimension)]?.value ?? "";
      const range = row.dimensionValues[headers.indexOf("dateRange")]?.value;
      if (!label || (range !== "selected" && range !== "prior")) return false;
      const pair = `${label}:${range}`; if (pairs.has(pair)) return false;
      pairs.add(pair); labels.add(label); return true;
    });
    return complete && labels.size === report.rowCount;
  }
  return false;
}

export function parseGa4Report(raw: unknown, property: string, query: ReportQuery, now = new Date()): AnalyticsReport {
  querySchema.parse(query);
  const batch = batchSchema.parse(raw);
  const timezone = batch.reports[0]!.metadata.timeZone;
  // Validate IANA timezone and prohibit current/future incomplete days in it.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (query.period.end >= today) throw new Error("Choose completed days in the property timezone.");
  const warnings = new Set<string>();
  if (query.period.end >= shiftDate(today, -3)) warnings.add("Recent dates are provisional: GA4 may still revise these figures.");
  const output: AnalyticsReport = { source: "ga4", property, timezone, fetchedAt: now.toISOString(), query,
    traffic: [], channels: [], landing: [], events: [], sessions: null, previousSessions: null, warnings: [] };
  let comparisonSafe = true;
  batch.reports.forEach((report, index) => {
    const definition = DEFINITIONS[index]!;
    const expectedHeaders: string[] = [...(definition.dimension ? [definition.dimension] : []), ...(query.comparison ? ["dateRange"] : [])];
    const headers = report.dimensionHeaders.map(header => header.name);
    if (JSON.stringify([...headers].sort()) !== JSON.stringify([...expectedHeaders].sort())) throw new Error("Report headers mismatch.");
    if (report.metricHeaders[0]!.name !== definition.metric || (definition.metric === "sessions" && report.metricHeaders[0]!.type !== "TYPE_INTEGER")) throw new Error("Report metric mismatch.");
    if (report.metricHeaders.length !== (definition.id === "events" ? 2 : 1)
      || (definition.id === "events" && (report.metricHeaders[1]?.name !== "eventCount" || report.metricHeaders[1]?.type !== "TYPE_INTEGER"))) throw new Error("Report metric mismatch.");
    const expandedRanges = report.rows.length !== report.rowCount && completeComparisonRows(report, headers, query, definition.dimension);
    if (report.rows.length !== report.rowCount && !expandedRanges) throw new Error(report.rows.length < report.rowCount ? "Report rows truncated." : "Report row count inconsistent.");
    if (report.metadata.timeZone !== timezone) throw new Error("Report timezone mismatch.");
    const metadata = report.metadata;
    if (metadata.schemaRestrictionResponse?.activeMetricRestrictions?.length) throw new Error("Report metrics are restricted.");
    if (metadata.emptyReason) warnings.add("GA4 reported an empty-data condition; missing observations are unavailable, not zero.");
    if (metadata.dataLossFromOtherRow) { warnings.add("GA4 grouped some data into (other). Comparisons are unavailable."); comparisonSafe = false; }
    if (metadata.subjectToThresholding) { warnings.add("GA4 applied privacy thresholds. Comparisons are unavailable."); comparisonSafe = false; }
    if (metadata.samplingMetadatas?.length) { warnings.add("GA4 returned sampled data. Comparisons are unavailable."); comparisonSafe = false; }
    const rows = new Map<string, Measure>();
    const eventRows = new Map<string, Measure>();
    const seen = new Set<string>();
    for (const row of report.rows) {
      if (row.metricValues.length !== report.metricHeaders.length) throw new Error("Report metric mismatch.");
      if (row.dimensionValues.length !== expectedHeaders.length) throw new Error("Report dimensions mismatch.");
      const range = query.comparison ? row.dimensionValues[headers.indexOf("dateRange")]!.value : "selected";
      if (range !== "selected" && range !== "prior") throw new Error("Unknown date range.");
      let label = definition.dimension ? row.dimensionValues[headers.indexOf(definition.dimension)]!.value : "total";
      if (!label || [...label].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error("Invalid dimension label.");
      if (definition.id === "traffic") {
        if (!/^\d{8}$/.test(label)) throw new Error("Invalid daily date.");
        label = `${label.slice(0, 4)}-${label.slice(4, 6)}-${label.slice(6, 8)}`;
        const period = range === "prior" ? query.comparison! : query.period;
        if (!validDate(label)) throw new Error("Invalid daily date.");
        if (label < period.start || label > period.end) {
          const other = range === "prior" ? query.period : query.comparison;
          // A provider-supplied zero in the other requested period is padding,
          // not an observation to align into this period. Missing days stay null.
          if (expandedRanges && other && label >= other.start && label <= other.end && numeric(row.metricValues[0]!.value) === 0) continue;
          throw new Error("Daily date outside request.");
        }
        if (range === "prior") label = shiftDate(query.period.start, periodDays({ start: period.start, end: label }) - 1);
      }
      if (definition.id === "landing" && (label.includes("?") || label.includes("#"))) throw new Error("Landing page contains query data.");
      const identity = `${range}:${label}`;
      if (seen.has(identity)) throw new Error("Duplicate report row.");
      seen.add(identity);
      const measure = rows.get(label) ?? { label, value: null, previous: null };
      measure[range === "selected" ? "value" : "previous"] = numeric(row.metricValues[0]!.value);
      if (definition.metric === "sessions" && !Number.isInteger(measure[range === "selected" ? "value" : "previous"])) throw new Error("Sessions must be integers.");
      rows.set(label, measure);
      if (definition.id === "events") {
        const occurrence = numeric(row.metricValues[1]!.value);
        if (!Number.isInteger(occurrence)) throw new Error("Invalid report value.");
        const event = eventRows.get(label) ?? { label, value: null, previous: null };
        event[range === "selected" ? "value" : "previous"] = occurrence;
        eventRows.set(label, event);
      }
    }
    if (definition.id === "total") {
      output.sessions = rows.get("total")?.value ?? null;
      output.previousSessions = rows.get("total")?.previous ?? null;
    } else if (definition.id === "traffic") {
      output.traffic = Array.from({ length: periodDays(query.period) }, (_, day) => {
        const label = shiftDate(query.period.start, day);
        return rows.get(label) ?? { label, value: null, previous: null };
      });
    } else output[definition.id] = [...rows.values()].filter(row => definition.id !== "events" || (row.value ?? 0) > 0 || (row.previous ?? 0) > 0).sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.label.localeCompare(b.label));
    if (definition.id === "events") output.journey = websiteJourney([...eventRows.values()], query);
  });
  if (!comparisonSafe) {
    output.previousSessions = null;
    for (const key of ["traffic", "channels", "landing", "events"] as PaneId[]) output[key] = output[key].map(row => ({ ...row, previous: null }));
    if (output.journey) output.journey.counts = output.journey.counts.map(row => ({ ...row, previous: null }));
  }
  output.warnings = [...warnings];
  return output;
}

export class Ga4ReportFailure extends Error {
  constructor(readonly diagnostic: { reason: string; status?: number; schemaIssues?: { report: number | null; field: string; code: string }[]; structure?: ReturnType<typeof reportStructure> }) { super("GA4 report unavailable."); }
}
function reportStructure(batch: z.infer<typeof batchSchema>, query: ReportQuery) {
  return batch.reports.map((report, reportIndex) => {
    const rangeIndex = report.dimensionHeaders.findIndex(header => header.name === "dateRange");
    const dateIndex = report.dimensionHeaders.findIndex(header => header.name === "date");
    const combinations = new Set<string>(), ranges = new Set<string>(), pairs = new Set<string>();
    let duplicatePair = false, outsideOwnRangeNonzero = false;
    for (const row of report.rows) {
      combinations.add(JSON.stringify(row.dimensionValues.filter((_, index) => index !== rangeIndex)));
      const range = rangeIndex < 0 ? "selected" : row.dimensionValues[rangeIndex]?.value;
      ranges.add(range ?? "");
      const pair = JSON.stringify(row.dimensionValues); if (pairs.has(pair)) duplicatePair = true; pairs.add(pair);
      if (dateIndex >= 0 && (range === "selected" || range === "prior")) {
        const date = row.dimensionValues[dateIndex]?.value ?? "";
        const period = range === "selected" ? query.period : query.comparison;
        if (period && /^\d{8}$/.test(date) && (date < period.start.replaceAll("-", "") || date > period.end.replaceAll("-", ""))
          && Number(row.metricValues[0]!.value) !== 0) outsideOwnRangeNonzero = true;
      }
    }
    return { reportIndex, returnedRows: report.rows.length, reportedRows: report.rowCount, combinations: combinations.size,
      ranges: ranges.size, duplicatePair, outsideOwnRangeNonzero };
  });
}
const validationReasons: Record<string, string> = {
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
export async function readGa4Report(accessToken: string, property: string, query: ReportQuery, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<AnalyticsReport> {
  if (!/^[1-9]\d{0,19}$/.test(property)) throw new Error("Invalid property.");
  let status: number | undefined;
  let raw: unknown;
  try {
    const observedFetch: typeof fetch = async (url, init) => { const response = await fetcher(url, init); status = response.status; return response; };
    raw = await boundedGoogleJson(observedFetch, `https://analyticsdata.googleapis.com/v1beta/properties/${property}:batchRunReports`, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(reportPlan(query)), signal,
    }, 262144, 45000);
    return parseGa4Report(raw, property, query);
  } catch (error) {
    // Only fixed classifications, HTTP status and structural counts/booleans;
    // private operational diagnostics never contain provider messages,
    // response values, URLs, credentials or Zod's verbose error serialization.
    const structural = batchSchema.safeParse(raw);
    const schemaIssues = error instanceof z.ZodError ? error.issues.slice(0, 8).map(issue => ({
      report: issue.path[0] === "reports" && typeof issue.path[1] === "number" ? issue.path[1] : null,
      field: ["rows", "rowCount", "metricHeaders", "dimensionHeaders", "metadata", "metricValues", "dimensionValues", "value", "type", "timeZone"].filter(field => issue.path.includes(field)).join(".") || "envelope",
      code: issue.code,
    })) : undefined;
    throw new Ga4ReportFailure({ reason: status !== undefined && (status < 200 || status >= 300) ? "provider_http"
      : error instanceof z.ZodError ? "response_schema" : error instanceof Error && error.name === "TimeoutError" ? "provider_timeout"
      : error instanceof Error ? validationReasons[error.message] ?? "transport_or_response" : "transport_or_response",
      ...(status !== undefined ? { status } : {}), ...(schemaIssues ? { schemaIssues } : {}), ...(structural.success ? { structure: reportStructure(structural.data, query) } : {}) });
  }
}
