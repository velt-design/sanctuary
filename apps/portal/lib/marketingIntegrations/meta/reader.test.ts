import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readMetaCampaigns, metaReportIntent, metaHash } from "./reader";
import { recentMetaPeriod, validateMetaPeriod } from "./report";
import type { Boundary } from "./boundary";
const period = { start: "2026-08-01", end: "2026-08-07" };
const row = { account_id: "123", account_currency: "NZD", campaign_id: "1001", campaign_name: "Synthetic campaign", date_start: period.start, date_stop: period.end,
  spend: "32.45", impressions: "1000", inline_link_clicks: "30", actions: [{ action_type: "offsite_conversion.fb_pixel_lead", value: "2.5" }], attribution_setting: "7-day click" };
const response = (body: unknown) => Response.json([{ code: 200, body: JSON.stringify(body) }]);
function fixture(bodies: unknown[]) {
  const fetcher = vi.fn<typeof fetch>(); bodies.forEach(body => fetcher.mockResolvedValueOnce(response(body)));
  const receipts: unknown[] = [];
  const boundary: Boundary = async (step, execute, before, after) => { receipts.push({ step, before }); const value = await execute(); receipts.push(after?.(value)); return value; };
  return { fetcher, receipts, read: (fence = boundary) => readMetaCampaigns("fixture-token", "123", "fixture-secret", period, { timezone: "Pacific/Auckland", currency: "NZD" }, fence, fetcher) };
}
describe("bounded campaign report", () => {
  it("projects account metadata without leaking the transport receipt into the report", async () => {
    const account = { timezone: "Pacific/Auckland", currency: "NZD", requestId: "synthetic-receipt" };
    const boundary: Boundary = async (_step, execute) => execute();
    const report = await readMetaCampaigns("fixture-token", "123", "fixture-secret", period, account, boundary, vi.fn().mockResolvedValue(response({ data: [row] })));
    expect(report.currency).toBe("NZD"); expect(report).not.toHaveProperty("requestId");
  });
  it("uses seven completed Auckland days across the UTC boundary and leap dates", () => {
    const now = new Date("2026-09-16T13:00:00Z");
    expect(recentMetaPeriod(now)).toEqual({ start: "2026-09-10", end: "2026-09-16" });
    expect(() => validateMetaPeriod({ start: "2026-09-11", end: "2026-09-17" }, now)).toThrow();
    expect(() => validateMetaPeriod({ start: "2026-02-23", end: "2026-03-01" }, now)).not.toThrow();
    expect(() => validateMetaPeriod({ start: "2026-02-29", end: "2026-03-07" }, now)).toThrow();
    expect(() => validateMetaPeriod({ ...period, account: "other" }, now)).toThrow();
  });
  it("keeps source settings, decimals and missing values without leaking credentials in receipts", async () => {
    const f = fixture([{ data: [row, { ...row, campaign_id: "1002", spend: "0", actions: undefined, inline_link_clicks: undefined, attribution_setting: undefined }] }]);
    const result = await f.read();
    expect(result.campaigns[0]).toMatchObject({ spend: 32.45, websiteLeads: 2.5, attribution: "7-day click" });
    expect(result.campaigns[1]).toMatchObject({ spend: 0, websiteLeads: null, linkClicks: null, attribution: null });
    expect(result).toMatchObject({ complete: true, pages: 1, currency: "NZD", timezone: "Pacific/Auckland" });
    const [url, init] = f.fetcher.mock.calls[0]!;
    expect(url).toBe("https://graph.facebook.com/v26.0/");
    const batch = JSON.parse((init!.body as URLSearchParams).get("batch")!);
    const query = new URL(`https://example.test/${batch[0].relative_url}`);
    expect(query.pathname).toBe("/act_123/insights"); expect(query.searchParams.get("action_report_time")).toBe("impression");
    expect(query.searchParams.get("use_unified_attribution_setting")).toBe("true");
    expect(JSON.stringify(f.receipts)).not.toMatch(/fixture-token|fixture-secret|Synthetic campaign/);
    expect(f.receipts.at(-1)).toMatchObject({ reportOutcome: "complete", pageIndex: 1, rowCount: 2 });
    expect(f.receipts.at(-1)).toMatchObject({ resultHash: metaHash(result) });
    expect(metaHash({ ...result, fetchedAt: "2020-01-01T00:00:00Z" })).not.toBe(metaHash(result));
  });
  it("audits each page and uses only the cursor rather than following a supplied next URL", async () => {
    const f = fixture([{ data: [row], paging: { next: "https://attacker.invalid/?token=secret", cursors: { after: "opaque_1" } } }, { data: [{ ...row, campaign_id: "1002" }] }]);
    expect((await f.read()).pages).toBe(2);
    expect(f.fetcher.mock.calls.every(([url]) => url === "https://graph.facebook.com/v26.0/")).toBe(true);
    expect(f.receipts[1]).toMatchObject({ reportOutcome: "page", pageIndex: 1 });
    expect(f.receipts[3]).toMatchObject({ reportOutcome: "complete", pageIndex: 2 });
  });
  it.each(["account", "currency", "date", "duplicate", "negative", "missing-cursor", "duplicate-action"])("withholds the whole report on %s", async reason => {
    const changed = { ...row, ...(reason === "account" ? { account_id: "999" } : reason === "currency" ? { account_currency: "USD" } : reason === "date" ? { date_stop: "2026-08-08" } : reason === "negative" ? { spend: "-1" } : reason === "duplicate-action" ? { actions: [...row.actions, ...row.actions] } : {}) };
    const f = fixture([{ data: reason === "duplicate" ? [row, row] : [changed], ...(reason === "missing-cursor" ? { paging: { next: "https://provider.test/next" } } : {}) }]);
    await expect(f.read()).rejects.toThrow("No partial"); expect(f.receipts.at(-1)).toMatchObject({ reportOutcome: "unavailable" });
  });
  it("withholds incomplete capped or cyclic pagination", async () => {
    for (const cyclic of [true, false]) {
      const f = fixture([1, 2, 3].map(n => ({ data: [{ ...row, campaign_id: String(1000 + n) }], paging: { next: "https://provider.test/next", cursors: { after: cyclic ? "same" : `page${n}` } } })));
      await expect(f.read()).rejects.toThrow(); expect(f.fetcher.mock.calls.length).toBeLessThanOrEqual(3);
    }
  });
  it("never dispatches a page after an authority boundary denies it", async () => {
    const f = fixture([{ data: [row] }]);
    await expect(f.read(async () => { throw new Error("Stopped"); })).rejects.toThrow("Stopped"); expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("does not return a finished report when the final receipt boundary denies publication", async () => {
    const f = fixture([{ data: [row] }]);
    await expect(f.read(async (_step, execute) => { await execute(); throw new Error("Final audit denied"); })).rejects.toThrow("Final audit denied");
  });
  it("binds intent to account, dates and fixed report definition", () => {
    expect(metaReportIntent("123", period).queryHash).not.toBe(metaReportIntent("124", period).queryHash);
  });
});
