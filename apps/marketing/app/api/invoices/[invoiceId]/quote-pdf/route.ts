import { NextResponse } from 'next/server';
import { loadPublicSourceQuotePdfByInvoiceToken } from '@/lib/invoices/publicInvoice';

export const runtime = 'nodejs';

function safeFilename(value: string): string {
  const trimmed = value.trim() || 'quote.pdf';
  return trimmed.replace(/[\\/\r\n"]/g, '_');
}

export async function GET(req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await ctx.params;
  const invoiceIdValue = typeof invoiceId === 'string' ? invoiceId.trim() : '';
  if (!invoiceIdValue) {
    return NextResponse.json({ error: 'Invalid invoiceId' }, { status: 400 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token')?.trim() || '';
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const pdf = await loadPublicSourceQuotePdfByInvoiceToken({ invoiceId: invoiceIdValue, token });
  if (!pdf) {
    return NextResponse.json({ error: 'Quote PDF unavailable' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(pdf.content), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${safeFilename(pdf.filename)}"`,
      'cache-control': 'private, no-store',
    },
  });
}
