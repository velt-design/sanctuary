import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/dashboard/getDashboardData';
import { parseDashboardQueueMode } from '@/lib/dashboard/queueMode';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const queue = parseDashboardQueueMode(url.searchParams.get('queue'));
    const data = await getDashboardData({ queueMode: queue });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load dashboard data.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
