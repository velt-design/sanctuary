import { NextResponse } from 'next/server';
import { resolveTrackingRegionPolicy } from '@/lib/trackingRegion';

export const runtime = 'edge';

export function GET(request: Request) {
  const policy = resolveTrackingRegionPolicy(
    request.headers.get('x-vercel-ip-country'),
  );

  return NextResponse.json(
    { policy },
    {
      headers: {
        'Cache-Control': 'private, no-store',
        Vary: 'X-Vercel-IP-Country',
      },
    },
  );
}
