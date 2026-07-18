import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import {
  estimatePortalWebVitalBytes,
  PORTAL_WEB_VITAL_MAX_BYTES,
  sanitizePortalWebVitalEvent,
} from '@/lib/performance/webVitals';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/performance/web-vitals', 'POST');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;

  const raw = await req.text();
  if (estimatePortalWebVitalBytes(raw) > PORTAL_WEB_VITAL_MAX_BYTES) {
    return jsonError('Performance metric payload is too large.', 413, diagnostics);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return jsonError('Invalid JSON body', 400, diagnostics);
  }
  const event = sanitizePortalWebVitalEvent(parsed);
  if (!event) return jsonError('Invalid performance metric.', 400, diagnostics);

  const { error } = await auth.supabase.from('portal_performance_metrics').insert({
    metric_name: event.name,
    metric_value: event.value,
    rating: event.rating,
    route_template: event.routeTemplate,
    navigation_type: event.navigationType,
    device_class: event.deviceClass,
    build_id: event.buildId ?? null,
  });
  if (error) {
    console.error('[portal_performance] failed to retain Web Vital', {
      code: error.code ?? null,
      metric: event.name,
      routeTemplate: event.routeTemplate,
    });
    return jsonError('Performance metric could not be retained.', 503, diagnostics);
  }

  return jsonOk({ accepted: true }, 202, diagnostics);
}
