import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_PORTAL_QA_FIXTURES !== '1') return new NextResponse(null, { status: 404 });
  try {
    const response = await fetch(`http://127.0.0.1:3167/register?${request.nextUrl.searchParams}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Start the local Finance SQL preview on port 3167.' }, { status: 503 }); }
}
