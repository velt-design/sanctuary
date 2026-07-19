import { NextResponse } from 'next/server';
import { requireStaffContext } from '@/lib/api/staffApi';
import { getDashboardData } from '@/lib/dashboard/getDashboardData';
import { parseDashboardQueueMode } from '@/lib/dashboard/queueMode';

export const runtime = 'nodejs';

const PRIVATE_NO_STORE_HEADERS = {
  'cache-control': 'private, no-store',
};

export async function GET(req: Request) {
  const auth = await requireStaffContext();
  if (!auth.ok) {
    auth.response.headers.set('cache-control', PRIVATE_NO_STORE_HEADERS['cache-control']);
    return auth.response;
  }

  try {
    const url = new URL(req.url);
    const queue = parseDashboardQueueMode(url.searchParams.get('queue'));
    const data = await getDashboardData({ queueMode: queue, userId: auth.session.user.id });
    return NextResponse.json(data, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load dashboard data.';
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
}
