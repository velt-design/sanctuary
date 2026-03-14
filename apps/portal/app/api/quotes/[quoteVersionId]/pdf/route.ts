import { requireStaffSession, jsonError } from '@/lib/api/staffApi';
import { downloadQuotePdf } from '@/lib/quotes/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const startedAt = performance.now();
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;
  const reqUrl = new URL(req.url);
  const inlineRequested = reqUrl.searchParams.get('disposition') === 'inline' || reqUrl.searchParams.get('inline') === '1';

  try {
    const pdf = await downloadQuotePdf(id, actor);
    const body = new Uint8Array(pdf.bytes);
    const dispositionType = inlineRequested ? 'inline' : 'attachment';
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `${dispositionType}; filename="${pdf.filename}"`,
        'server-timing': `total;dur=${(performance.now() - startedAt).toFixed(1)}, pdfcache;desc="${pdf.cacheHit ? 'hit' : 'miss'}"`,
        'x-frame-options': 'SAMEORIGIN',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to download PDF';
    return jsonError(msg, 500);
  }
}
