// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { Ga4ReportFailure, parseGa4Report, readGa4Report, reportIntent, reportPlan } from "./ga4";
import { periodDays, previousPeriod, validateQuery, type ReportQuery } from "./report";

const query: ReportQuery = { period: { start: "2026-08-10", end: "2026-08-11" }, comparison: { start: "2026-08-08", end: "2026-08-09" } };
const now = new Date("2026-09-09T00:00:00Z");
function fixture(comparison = true) {
  return { reports: ["date", "sessionDefaultChannelGroup", "landingPage", "eventName", null].map((dimension, i) => ({
    dimensionHeaders: [...(dimension ? [{ name: dimension }] : []), ...(comparison ? [{ name: "dateRange" }] : [])],
    metricHeaders: [{ name: i === 3 ? "keyEvents" : "sessions", type: "TYPE_INTEGER" }, ...(i === 3 ? [{ name: "eventCount", type: "TYPE_INTEGER" }] : [])],
    rows: (comparison ? ["selected", "prior"] : ["selected"]).map(range => ({
      dimensionValues: [...(dimension ? [{ value: i === 0 ? (range === "selected" ? "20260810" : "20260808") : i === 2 ? "/" : "fixture_label" }] : []), ...(comparison ? [{ value: range }] : [])],
      metricValues: [{ value: range === "selected" ? "10" : "0" }, ...(i === 3 ? [{ value: "12" }] : [])],
    })), rowCount: comparison ? 2 : 1, metadata: { timeZone: "Pacific/Auckland" },
  })) };
}
describe("GA4 fixed report consumer", () => {
  it("accepts complete expanded landing comparisons up to 200 groups, never partial or oversized groups", () => {
    const raw = fixture();
    const landing = raw.reports[2]!;
    landing.rows = Array.from({ length: 200 }, (_, page) => ["selected", "prior"].map(range => ({
      dimensionValues: [{ value: `/page-${page}` }, { value: range }], metricValues: [{ value: "1" }],
    }))).flat();
    landing.rowCount = 200;
    expect(parseGa4Report(raw, "123", query, now).landing).toHaveLength(200);
    landing.rows.pop();
    expect(() => parseGa4Report(raw, "123", query, now)).toThrow("inconsistent");
    landing.rows.push(landing.rows[0]!);
    expect(() => parseGa4Report(raw, "123", query, now)).toThrow("inconsistent");
    landing.rowCount = 201;
    expect(() => parseGa4Report(raw, "123", query, now)).toThrow();
  });
  it("constructs five fixed reports with exact shared dates, named periods and bounded terminal reads", () => {
    const plan = reportPlan(query);
    expect(plan.requests).toHaveLength(5);
    for (const request of plan.requests) { expect(request.limit).toBe("201"); expect(request.dateRanges).toEqual([{ startDate: "2026-08-10", endDate: "2026-08-11", name: "selected" }, { startDate: "2026-08-08", endDate: "2026-08-09", name: "prior" }]); }
    expect(plan.requests[2]!.dimensions).toEqual([{ name: "landingPage" }]);
    expect(JSON.stringify(plan)).not.toMatch(/landingPagePlusQueryString|enquiry|sales|leadDefinition/);
    expect(reportIntent("123", query).queryHash).not.toBe(reportIntent("124", query).queryHash);
  });
  it("preserves zero, absent daily observations, aligned comparison dates and independent totals", () => {
    const report = parseGa4Report(fixture(), "123", query, now);
    expect(report.sessions).toBe(10); expect(report.previousSessions).toBe(0);
    expect(report.traffic).toEqual([{ label: "2026-08-10", value: 10, previous: 0 }, { label: "2026-08-11", value: null, previous: null }]);
    expect(report.source).toBe("ga4"); expect(report.timezone).toBe("Pacific/Auckland");
  });
  it("accepts no comparison and empty report responses without inventing zeros", () => {
    const raw = fixture(false); for (const report of raw.reports) { report.rows = []; report.rowCount = 0; }
    const result = parseGa4Report(raw, "123", { ...query, comparison: null }, now);
    expect(result.sessions).toBeNull(); expect(result.channels).toEqual([]); expect(result.traffic.every(row => row.value === null)).toBe(true);
  });
  it("binds dimension values by their exact headers regardless of dateRange position", () => {
    const raw = fixture();
    for (const report of raw.reports) { report.dimensionHeaders.reverse(); for (const row of report.rows) row.dimensionValues.reverse(); }
    expect(parseGa4Report(raw, "123", query, now)).toEqual(parseGa4Report(fixture(), "123", query, now));
    raw.reports[0]!.dimensionHeaders[0]!.name = "date";
    expect(() => parseGa4Report(raw, "123", query, now)).toThrow("headers mismatch");
  });
  it("accepts only complete comparison products and discards zero date padding without inventing missing days", async () => {
    const raw = fixture(); const report = raw.reports[0]!;
    report.rows.push({ dimensionValues: [{ value: "20260808" }, { value: "selected" }], metricValues: [{ value: "0" }] },
      { dimensionValues: [{ value: "20260810" }, { value: "prior" }], metricValues: [{ value: "0" }] });
    for (const dimensionReport of raw.reports.slice(1, 4)) dimensionReport.rowCount = 1;
    expect(parseGa4Report(raw, "123", query, now)).toEqual(parseGa4Report(fixture(), "123", query, now));
    report.rows[2]!.metricValues[0]!.value = "1";
    try { await readGa4Report("private-token", "123", query, undefined, vi.fn(async () => Response.json(raw))); throw new Error("Expected rejection"); }
    catch (error) {
      expect(error).toBeInstanceOf(Ga4ReportFailure);
      const diagnostic = (error as Ga4ReportFailure).diagnostic;
      expect(diagnostic).toMatchObject({ reason: "date_outside_range", status: 200 });
      expect(diagnostic.structure?.[0]).toEqual({ reportIndex: 0, returnedRows: 4, reportedRows: 2, combinations: 2, ranges: 2, duplicatePair: false, outsideOwnRangeNonzero: true });
      expect(JSON.stringify(diagnostic)).not.toMatch(/private-token|202608|fixture_label|metricValues|dimensionValues/);
    }
    report.rows[2]!.metricValues[0]!.value = "0";
    report.rows[3] = report.rows[2]!;
    expect(() => parseGa4Report(raw, "123", query, now)).toThrow("inconsistent");
    report.rows = report.rows.slice(0, 2); report.rowCount = 3;
    expect(() => parseGa4Report(raw, "123", query, now)).toThrow("truncated");
  });
  it.each(["missing_pair", "wrong_range", "outside_union", "wrong_count", "total_count"])("rejects %s in expanded comparison responses", mode => {
    const raw = fixture(); const report = raw.reports[0]!;
    report.rows.push({ dimensionValues: [{ value: "20260808" }, { value: "selected" }], metricValues: [{ value: "0" }] },
      { dimensionValues: [{ value: "20260810" }, { value: "prior" }], metricValues: [{ value: "0" }] });
    if (mode === "missing_pair") report.rows.pop();
    if (mode === "wrong_range") report.rows[2]!.dimensionValues[1]!.value = "wrong";
    if (mode === "outside_union") { report.rows[0]!.dimensionValues[0]!.value = "20260801"; report.rows[3]!.dimensionValues[0]!.value = "20260801"; }
    if (mode === "wrong_count") report.rowCount = 3;
    if (mode === "total_count") raw.reports[4]!.rowCount = 1;
    expect(() => parseGa4Report(raw, "123", query, now)).toThrow();
  });
  it.each(["samplingMetadatas", "subjectToThresholding", "dataLossFromOtherRow"])("retains %s as a visible limitation and withdraws comparisons", key => {
    const raw = fixture(); Object.assign(raw.reports[1]!.metadata, { [key]: key === "samplingMetadatas" ? [{ samplesReadCount: "5", samplingSpaceSize: "10" }] : true });
    const result = parseGa4Report(raw, "123", query, now);
    expect(result.warnings).toHaveLength(1); expect(result.previousSessions).toBeNull(); expect(result.channels[0]?.previous).toBeNull();
  });
  it.each(["negative", "nan", "infinite", "overflow", "truncated", "headers", "range", "timezone", "date", "duplicate", "partial", "restricted", "query_path"])("fails closed on %s responses", mode => {
    const raw = fixture(); const r = raw.reports[0]!;
    if (mode === "negative") r.rows[0]!.metricValues[0]!.value = "-1";
    if (mode === "nan") r.rows[0]!.metricValues[0]!.value = "NaN";
    if (mode === "infinite") r.rows[0]!.metricValues[0]!.value = "Infinity";
    if (mode === "overflow") r.rows[0]!.metricValues[0]!.value = "999999999999999999999";
    if (mode === "truncated") r.rowCount = 201;
    if (mode === "headers") r.metricHeaders[0]!.name = "activeUsers";
    if (mode === "range") r.rows[0]!.dimensionValues.at(-1)!.value = "wrong";
    if (mode === "timezone") r.metadata.timeZone = "UTC";
    if (mode === "date") r.rows[0]!.dimensionValues[0]!.value = "20260812";
    if (mode === "duplicate") { r.rows.push(r.rows[0]!); r.rowCount++; }
    if (mode === "partial") raw.reports.pop();
    if (mode === "restricted") Object.assign(r.metadata, { schemaRestrictionResponse: { activeMetricRestrictions: [{}] } });
    if (mode === "query_path") raw.reports[2]!.rows[0]!.dimensionValues[0]!.value = "/?email=private";
    expect(() => parseGa4Report(raw, "123", query, now)).toThrow();
  });
  it("enforces completed days in the actual property timezone", () => {
    expect(() => parseGa4Report(fixture(), "123", query, new Date("2026-08-10T13:00:00Z"))).toThrow("completed days");
  });
  it("rejects impossible dates, unequal/overlapping periods and requests over 90 days", () => {
    expect(periodDays({ start: "2026-02-30", end: "2026-03-01" })).toBe(0);
    expect(previousPeriod({ start: "2024-03-01", end: "2024-03-02" })).toEqual({ start: "2024-02-28", end: "2024-02-29" });
    expect(validateQuery({ ...query, comparison: { start: "2026-08-08", end: "2026-08-08" } })).not.toBeNull();
    expect(validateQuery({ ...query, comparison: query.period })).not.toBeNull();
    expect(validateQuery({ period: { start: "2026-01-01", end: "2026-08-01" }, comparison: null })).not.toBeNull();
  });
  it("uses only the fixed property endpoint with a body, no retries and bounded transport", async () => {
    const fetcher = vi.fn(async () => Response.json(fixture()));
    await readGa4Report("fixture-secret", "123", query, undefined, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetcher).mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("https://analyticsdata.googleapis.com/v1beta/properties/123:batchRunReports");
    expect(url).not.toContain("fixture-secret"); expect(init.redirect).toBe("error"); expect(init.cache).toBe("no-store");
    await expect(readGa4Report("secret", "123", query, undefined, vi.fn(async () => new Response("x".repeat(262145))))).rejects.toMatchObject({ diagnostic: { reason: "response_limit" } });
  });
  it("gives the report batch a bounded deadline and classifies a timeout without retry or private values", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetcher = vi.fn(async () => { throw new DOMException("PRIVATE_TIMEOUT", "TimeoutError"); });
    try {
      await expect(readGa4Report("PRIVATE_TOKEN", "123", query, undefined, fetcher)).rejects.toMatchObject({ diagnostic: { reason: "provider_timeout" } });
      expect(timeout).toHaveBeenCalledWith(45000);
      expect(fetcher).toHaveBeenCalledOnce();
    } finally { timeout.mockRestore(); }
  });
  it("accepts a bounded five-report envelope larger than a credential response", async () => {
    const body = JSON.stringify(fixture()) + " ".repeat(262144 - JSON.stringify(fixture()).length);
    await expect(readGa4Report("secret", "123", query, undefined, vi.fn(async () => new Response(body)))).resolves.toMatchObject({ source: "ga4", sessions: 10 });
  });
  it("classifies failures without retaining provider bodies, metric values or credentials", async () => {
    const raw = fixture(); raw.reports[0]!.metricHeaders[0]!.type = "PRIVATE_VALUE";
    for (const [response, expected] of [[new Response("PRIVATE_VALUE", { status: 403 }), { reason: "provider_http", status: 403 }],
      [Response.json(raw), { reason: "response_schema", status: 200, schemaIssues: [{ report: 0, field: "metricHeaders.type", code: "invalid_value" }] }]] as const) {
      try { await readGa4Report("PRIVATE_TOKEN", "123", query, undefined, vi.fn(async () => response)); throw new Error("Expected failure"); }
      catch (error) { expect(error).toBeInstanceOf(Ga4ReportFailure); expect((error as Ga4ReportFailure).diagnostic).toEqual(expected); expect(JSON.stringify(error)).not.toMatch(/PRIVATE_VALUE|PRIVATE_TOKEN/); }
    }
  });
});
