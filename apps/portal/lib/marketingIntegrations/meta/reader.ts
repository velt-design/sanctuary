import "server-only";
import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { metaRead } from "./transport";
import type { Boundary } from "./boundary";
import { META_MAX_PAGES, META_PAGE_SIZE, META_REPORT_VERSION, metaReportSchema, validateMetaPeriod, type MetaPeriod, type MetaReport } from "./report";

export interface MetaReportIntent { target: string; queryHash: string; reportVersion: typeof META_REPORT_VERSION; startDate: string; endDate: string }
export class MetaReportFailure extends Error { constructor() { super("Meta report unavailable. No partial figures were returned."); } }
export const metaHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function metaReportIntent(target: string, period: MetaPeriod): MetaReportIntent {
  if (!/^[1-9]\d{0,19}$/.test(target)) throw new Error("Invalid account.");
  validateMetaPeriod(period);
  return { target, reportVersion: META_REPORT_VERSION, startDate: period.start, endDate: period.end,
    queryHash: metaHash([META_REPORT_VERSION, target, period.start, period.end, "adset-attribution", "impression"]) };
}
const integer = z.string().regex(/^(0|[1-9]\d{0,15})$/).transform(Number).refine(Number.isSafeInteger);
const money = z.string().regex(/^\d{1,12}(\.\d{1,6})?$/).transform(Number).refine(n => n <= 1e12);
const displayText = (value: string) => ![...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
const rowSchema = z.object({ account_id: z.string(), account_currency: z.string(), campaign_id: z.string().regex(/^[1-9]\d{0,19}$/),
  campaign_name: z.string().min(1).max(200).refine(displayText), date_start: z.iso.date(), date_stop: z.iso.date(),
  spend: money.optional(), impressions: integer.optional(), inline_link_clicks: integer.optional(),
  attribution_setting: z.string().min(1).max(160).refine(displayText).optional(),
  actions: z.array(z.object({ action_type: z.string().max(100), value: money })).max(100).optional(),
});
const pageSchema = z.object({ data: z.array(rowSchema).max(META_PAGE_SIZE), paging: z.object({
  next: z.string().max(16384).optional(), cursors: z.object({ after: z.string().regex(/^[A-Za-z0-9_=-]{1,2048}$/).optional() }).optional(),
}).optional() });

// Each provider page has its own durable boundary. Never follow a provider URL:
// only its validated opaque cursor may reach the same fixed account Insights path.
export async function readMetaCampaigns(token: string, target: string, secret: string, period: MetaPeriod,
  account: { timezone: string; currency: string }, boundary: Boundary, fetcher: typeof fetch = fetch): Promise<MetaReport> {
  validateMetaPeriod(period, new Date(), account.timezone);
  const intent = metaReportIntent(target, period);
  const rows: MetaReport["campaigns"] = [], ids = new Set<string>(), cursors = new Set<string>();
  let after: string | undefined;
  for (let page = 1; page <= META_MAX_PAGES; page++) {
    let complete = false;
    let finalReport: MetaReport | undefined;
    await boundary("report_read", async () => {
      try {
        const parameters = new URLSearchParams({ level: "campaign", limit: String(META_PAGE_SIZE), time_range: JSON.stringify({ since: period.start, until: period.end }),
          fields: "account_id,account_currency,campaign_id,campaign_name,date_start,date_stop,spend,impressions,inline_link_clicks,actions,attribution_setting",
          use_unified_attribution_setting: "true", action_report_time: "impression",
          appsecret_proof: createHmac("sha256", secret).update(token).digest("hex") });
        if (after) parameters.set("after", after);
        const result = pageSchema.parse((await metaRead(fetcher, `act_${target}/insights`, parameters, token)).body);
        complete = !result.paging?.next;
        if (!complete) {
          const cursor = result.paging?.cursors?.after;
          if (!cursor || cursors.has(cursor) || page === META_MAX_PAGES || !result.data.length) throw new Error("Incomplete report.");
          cursors.add(cursor); after = cursor;
        }
        for (const row of result.data) {
          if (row.account_id !== target || row.account_currency !== account.currency || row.date_start !== period.start || row.date_stop !== period.end || ids.has(row.campaign_id)) throw new Error("Report identity differs.");
          ids.add(row.campaign_id);
          const leads = row.actions?.filter(action => action.action_type === "offsite_conversion.fb_pixel_lead") ?? [];
          if (leads.length > 1) throw new Error("Duplicate metric.");
          rows.push({ id: row.campaign_id, name: row.campaign_name, spend: row.spend ?? null, impressions: row.impressions ?? null,
            linkClicks: row.inline_link_clicks ?? null, websiteLeads: leads[0]?.value ?? null, attribution: row.attribution_setting ?? null });
        }
        if (complete) finalReport = metaReportSchema.parse({ source: "meta", version: META_REPORT_VERSION, period,
          fetchedAt: new Date().toISOString(), timezone: account.timezone, currency: account.currency,
          complete: true, pages: page, attribution: "Ad-set attribution settings; impression-time reporting", campaigns: rows });
        return { outcome: complete ? "complete" as const : "page" as const, hash: metaHash(finalReport ?? rows), rows: rows.length };
      } catch { return { outcome: "unavailable" as const, hash: "", rows: 0 }; }
    }, { ...intent, pageIndex: page }, value => ({ ...intent, pageIndex: page, reportOutcome: value.outcome,
      ...(value.outcome === "unavailable" ? {} : { resultHash: value.hash, rowCount: value.rows, timezone: account.timezone, currency: account.currency }) }))
      .then(value => { if (value.outcome === "unavailable") throw new MetaReportFailure(); });
    if (complete && finalReport) return finalReport;
  }
  throw new MetaReportFailure();
}
