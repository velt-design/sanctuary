import { NextResponse } from 'next/server';
import type { QueueMode } from '@/lib/dashboard/types';
import { getDashboardData } from '@/lib/dashboard/getDashboardData';

function parseQueueMode(value: string | null): QueueMode {
  if (value === 'next7' || value === 'alldue') return value;
  return 'today';
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const queue = parseQueueMode(url.searchParams.get('queue'));
    const data = await getDashboardData({ queueMode: queue });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load dashboard data.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
