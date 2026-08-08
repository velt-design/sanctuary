import { NextResponse } from 'next/server';
import { requireStaffContext } from '@/lib/api/staffApi';
import { getDashboardData } from '@/lib/dashboard/getDashboardData';
import { parseDashboardQueueMode } from '@/lib/dashboard/queueMode';
import {
  applyRouteDiagnostics,
  createRouteDiagnostics,
  logPortalServerError,
  measureRouteStep,
} from '@/lib/api/routeDiagnostics';

export const runtime = 'nodejs';

const PRIVATE_NO_STORE_HEADERS = {
  'cache-control': 'private, no-store',
};

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/dashboard');
  const auth = await measureRouteStep(diagnostics, 'auth', () => requireStaffContext(diagnostics));
  if (!auth.ok) {
    auth.response.headers.set('cache-control', PRIVATE_NO_STORE_HEADERS['cache-control']);
    return applyRouteDiagnostics(auth.response, diagnostics);
  }

  try {
    const url = new URL(req.url);
    const queue = parseDashboardQueueMode(url.searchParams.get('queue'));
    const data = await getDashboardData({
      queueMode: queue,
      userId: auth.session.user.id,
      supabase: auth.supabase,
      diagnostics,
    });
    return applyRouteDiagnostics(
      NextResponse.json(data, { headers: PRIVATE_NO_STORE_HEADERS }),
      diagnostics,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load dashboard data.';
    logPortalServerError(diagnostics, {
      status: 500,
      message: 'Failed to load dashboard data',
      error: err,
    });
    return applyRouteDiagnostics(
      NextResponse.json(
        { error: msg },
        { status: 500, headers: PRIVATE_NO_STORE_HEADERS },
      ),
      diagnostics,
    );
  }
}
