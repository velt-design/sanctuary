import { NextResponse } from 'next/server';
import { loadPublicDepositInvoicePdfByToken } from '@/lib/invoices/publicInvoice';

export const runtime = 'nodejs';

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

  const pdf = await loadPublicDepositInvoicePdfByToken({ invoiceId: invoiceIdValue, token });
  if (!pdf) {
    return NextResponse.json({ error: 'Invoice PDF unavailable' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(pdf.content), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${pdf.filename.replace(/"/g, '')}"`,
      'cache-control': 'private, no-store',
    },
  });
}
