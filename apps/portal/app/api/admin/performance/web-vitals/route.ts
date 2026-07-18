import { jsonError, jsonOk, requireAdminContext } from '@/lib/api/adminApi';
import { createRouteDiagnostics } from '@/lib/api/routeDiagnostics';

export const runtime = 'nodejs';

type PerformanceSummaryRow = {
  route_template?: unknown;
  metric_name?: unknown;
  sample_count?: unknown;
  p75?: unknown;
  p95?: unknown;
  poor_count?: unknown;
};

function summaryDays(url: string): 7 | 30 | null {
  const raw = new URL(url).searchParams.get('days') ?? '7';
  return raw === '7' ? 7 : raw === '30' ? 30 : null;
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/admin/performance/web-vitals', 'GET');
  const auth = await requireAdminContext(diagnostics);
  if (!auth.ok) return auth.response;
  const days = summaryDays(req.url);
  if (!days) return jsonError('days must be 7 or 30.', 400, diagnostics);

  const { data, error } = await auth.supabase.rpc('portal_performance_summary', { p_days: days });
  if (error) return jsonError('Performance summary could not be loaded.', 503, diagnostics);
  const rows = ((data ?? []) as PerformanceSummaryRow[]).map((row) => ({
    routeTemplate: String(row.route_template ?? ''),
    metricName: String(row.metric_name ?? ''),
    sampleCount: finiteNumber(row.sample_count),
    p75: finiteNumber(row.p75),
    p95: finiteNumber(row.p95),
    poorCount: finiteNumber(row.poor_count),
  }));
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1_000);
  return jsonOk({
    days,
    from: from.toISOString(),
    to: to.toISOString(),
    rows,
  }, 200, diagnostics);
}
