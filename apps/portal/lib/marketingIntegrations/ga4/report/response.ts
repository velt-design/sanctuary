import { z } from "zod";
import { validateQuery, type AnalyticsReport, type ReportQuery } from "./report";
import { JOURNEY_COMPLETE_FROM, JOURNEY_EVENTS } from "./journey";
const period = z.object({ start: z.string(), end: z.string() }).strict();
const measure = z.object({ label: z.string().max(512), value: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(), previous: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable() }).strict();
const schema = z.object({ source: z.literal("ga4"), property: z.string().regex(/^[1-9]\d{0,19}$/), timezone: z.string().min(1).max(80), fetchedAt: z.iso.datetime(),
  query: z.object({ period, comparison: period.nullable() }).strict(), traffic: z.array(measure).max(90), channels: z.array(measure).max(200), landing: z.array(measure).max(200), events: z.array(measure).max(200),
  sessions: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(), previousSessions: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(), warnings: z.array(z.string().max(512)).max(10),
  journey: z.object({ completeFrom: z.literal(JOURNEY_COMPLETE_FROM), counts: z.array(measure.extend({ label: z.enum(JOURNEY_EVENTS), value: z.number().int().nonnegative().safe().nullable(), previous: z.number().int().nonnegative().safe().nullable() })).length(JOURNEY_EVENTS.length)
    .refine(rows => rows.every((row, index) => row.label === JOURNEY_EVENTS[index])) }).strict().optional(),
  business: z.discriminatedUnion("status", [
    z.object({ status: z.literal("unavailable"), reason: z.enum(["connection_unavailable", "complete_snapshot_unavailable"]) }).strict(),
    z.object({ status: z.literal("available"), binding: z.string().regex(/^[a-f0-9]{64}$/), operations: z.array(z.uuid()).min(1).max(3),
      report: z.object({ source: z.literal("sanctuary"), timezone: z.literal("Pacific/Auckland"), fetchedAt: z.iso.datetime({ offset: true }),
        query: z.object({ period, comparison: period.nullable() }).strict(), counts: z.array(measure).length(4),
        excludedTestRecords: z.number().int().nonnegative().safe(), warnings: z.array(z.string().max(512)).max(5) }).strict() }).strict(),
  ]).optional(),
}).strict();
export function parseReportResponse(value: unknown, query: ReportQuery): AnalyticsReport {
  const report = schema.parse(value);
  if (validateQuery(report.query) || JSON.stringify(report.query) !== JSON.stringify(query)) throw new Error("Report dates do not match the request.");
  if (report.business?.status === "available" && (JSON.stringify(report.business.report.query) !== JSON.stringify(query)
    || report.business.report.timezone !== report.timezone)) throw new Error("Business report dates or timezone differ.");
  return report;
}
