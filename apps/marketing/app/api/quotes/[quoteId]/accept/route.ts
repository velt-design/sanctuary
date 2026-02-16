import { NextResponse } from 'next/server';
import { acceptPublicQuoteByToken } from '@/lib/quotes/publicQuote';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await ctx.params;
  const quoteIdValue = typeof quoteId === 'string' ? quoteId.trim() : '';
  if (!quoteIdValue) {
    return NextResponse.json({ error: 'Invalid quoteId' }, { status: 400 });
  }

  const form = await req.formData();
  const token = String(form.get('token') ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const result = await acceptPublicQuoteByToken({ quoteId: quoteIdValue, token });

  const url = new URL(req.url);
  url.pathname = `/quote/${encodeURIComponent(quoteIdValue)}`;
  url.searchParams.set('token', token);
  if (!result.ok) url.searchParams.set('error', result.code);

  return NextResponse.redirect(url.toString(), 303);
}
