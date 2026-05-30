import { NextResponse } from 'next/server';
import { requireStaffContext } from '@/lib/api/staffApi';
import { getDashboardData } from '@/lib/dashboard/getDashboardData';
import { parseDashboardQueueMode } from '@/lib/dashboard/queueMode';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const queue = parseDashboardQueueMode(url.searchParams.get('queue'));
    const data = await getDashboardData({ queueMode: queue, userId: auth.session.user.id });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load dashboard data.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
