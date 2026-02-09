import { requireStaffSession, jsonError } from '@/lib/api/staffApi';
import { downloadQuotePdf } from '@/lib/quotes/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ quoteVersionId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteVersionId } = await ctx.params;
  const id = typeof quoteVersionId === 'string' ? quoteVersionId.trim() : '';
  if (!id) return jsonError('Invalid quoteVersionId', 400);

  const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

  try {
    const pdf = await downloadQuotePdf(id, actor);
    const body = new Uint8Array(pdf.bytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${pdf.filename}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to download PDF';
    return jsonError(msg, 500);
  }
}
