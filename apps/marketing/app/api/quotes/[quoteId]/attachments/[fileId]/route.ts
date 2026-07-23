import { downloadPublicQuoteAttachmentByToken } from '@/lib/quotes/publicQuote';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function safeFilename(value: string): string {
  const trimmed = value.trim() || 'attachment.pdf';
  return trimmed.replace(/[\\/\r\n"]/g, '_');
}

export async function GET(req: Request, ctx: { params: Promise<{ quoteId: string; fileId: string }> }) {
  const { quoteId, fileId } = await ctx.params;
  const quoteIdValue = typeof quoteId === 'string' ? quoteId.trim() : '';
  const fileIdValue = typeof fileId === 'string' ? fileId.trim() : '';
  if (!quoteIdValue || !fileIdValue) {
    return NextResponse.json({ error: 'Invalid quoteId or fileId' }, { status: 400 });
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get('token') ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const attachment = await downloadPublicQuoteAttachmentByToken({
    quoteId: quoteIdValue,
    token,
    fileId: fileIdValue,
  });

  if (!attachment.ok) {
    const status = attachment.code === 'invalid' ? 400 : attachment.code === 'expired' ? 410 : 404;
    return NextResponse.json({ error: attachment.message, code: attachment.code }, { status });
  }

  const body = new Uint8Array(attachment.bytes.byteLength);
  body.set(attachment.bytes);

  return new NextResponse(body.buffer, {
    status: 200,
    headers: {
      'content-type': attachment.contentType || 'application/pdf',
      'content-disposition': `attachment; filename="${safeFilename(attachment.filename)}"`,
      'cache-control': 'private, max-age=0, no-store',
    },
  });
}
