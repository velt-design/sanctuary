import { NextResponse } from 'next/server';

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (process.env.ENABLE_PORTAL_QA_FIXTURES !== '1' || process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 });
  }
  const { path } = await context.params;
  if (path[0] !== 'api') return new NextResponse(null, { status: 404 });
  try {
    const response = await fetch(`http://127.0.0.1:3147/${path.map(encodeURIComponent).join('/')}`, {
      method: request.method,
      ...(request.method === 'POST' ? { body: await request.text() } : {}),
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Start the local invoice restore SQL preview on port 3147.' }, { status: 503 });
  }
}
export const GET = proxy;
export const POST = proxy;
