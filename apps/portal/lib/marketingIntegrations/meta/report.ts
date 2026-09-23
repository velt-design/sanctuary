import { z } from "zod";

export const META_REPORT_VERSION = "sanctuary-meta-campaigns-v1";
export const META_MAX_PAGES = 3;
export const META_PAGE_SIZE = 100;
export const metaPeriodSchema = z.object({ start: z.iso.date(), end: z.iso.date() }).strict();
export type MetaPeriod = z.infer<typeof metaPeriodSchema>;
export function validateMetaPeriod(value: unknown, now = new Date(), timezone = "Pacific/Auckland"): MetaPeriod {
  const period = metaPeriodSchema.parse(value);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (Date.parse(period.end) - Date.parse(period.start) !== 6 * 86400000 || period.end >= today) throw new Error("Choose seven completed days.");
  return period;
}
export function recentMetaPeriod(now = new Date(), timezone = "Pacific/Auckland"): MetaPeriod {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const end = new Date(Date.parse(today) - 86400000);
  return { start: new Date(end.getTime() - 6 * 86400000).toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable();
export const metaReportSchema = z.object({
  source: z.literal("meta"), version: z.literal(META_REPORT_VERSION), period: metaPeriodSchema,
  fetchedAt: z.iso.datetime(), timezone: z.string().min(1).max(80), currency: z.string().regex(/^[A-Z]{3}$/),
  complete: z.literal(true), pages: z.number().int().min(1).max(META_MAX_PAGES),
  attribution: z.literal("Ad-set attribution settings; impression-time reporting"),
  campaigns: z.array(z.object({ id: z.string().regex(/^[1-9]\d{0,19}$/), name: z.string().min(1).max(200),
    spend: z.number().nonnegative().max(1e12).nullable(), impressions: count, linkClicks: count, websiteLeads: z.number().nonnegative().max(1e12).nullable(),
    attribution: z.string().min(1).max(160).nullable(),
  }).strict()).max(META_MAX_PAGES * META_PAGE_SIZE),
}).strict();
export type MetaReport = z.infer<typeof metaReportSchema>;
export const metaReplySchema = z.object({ operation: z.uuid(), report: metaReportSchema }).strict();
export function sampleMetaReport(period: MetaPeriod): MetaReport {
  return { source: "meta", version: META_REPORT_VERSION, period, fetchedAt: "2026-09-01T00:00:00.000Z", timezone: "Pacific/Auckland", currency: "NZD",
    complete: true, pages: 1, attribution: "Ad-set attribution settings; impression-time reporting",
    campaigns: [{ id: "101", name: "Synthetic garden campaign", spend: 420, impressions: 18000, linkClicks: 240, websiteLeads: 4, attribution: "7-day click, 1-day view" },
      { id: "102", name: "Synthetic return visitors", spend: 60, impressions: 3000, linkClicks: 30, websiteLeads: null, attribution: null }] };
}
