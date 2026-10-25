import { NextResponse } from 'next/server';
import { requireStaffContext } from '@/lib/api/staffApi';
import { getDashboardData, startDashboardRead } from '@/lib/dashboard/getDashboardData';
import { READ_PARTS_MEDIA_TYPE } from '@/lib/api/readParts';
import { dashboardPartsResponse } from '@/lib/dashboard/dashboardPartResponse.server';
import { parseDashboardQueueMode } from '@/lib/dashboard/queueMode';

export const runtime = 'nodejs';

const PRIVATE_NO_STORE_HEADERS = {
  'cache-control': 'private, no-store',
  'vary':'Accept',
};

export async function GET(req: Request) {
  const auth = await requireStaffContext();
  if (!auth.ok) {
    auth.response.headers.set('cache-control', PRIVATE_NO_STORE_HEADERS['cache-control']);
    auth.response.headers.set('vary','Accept');
    return auth.response;
  }

  try {
    const url = new URL(req.url);
    const queue = parseDashboardQueueMode(url.searchParams.get('queue'));
    if(req.headers.get('accept')?.split(',').some(type=>type.trim()===READ_PARTS_MEDIA_TYPE)) {
      return dashboardPartsResponse(req,queue,()=>startDashboardRead({queueMode:queue,userId:auth.session.user.id,supabase:auth.supabase}));
    }
    const data = await getDashboardData({
      queueMode: queue,
      userId: auth.session.user.id,
      supabase: auth.supabase,
    });
    return NextResponse.json(data, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load dashboard data.';
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
}
