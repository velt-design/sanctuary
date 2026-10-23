import { NextRequest, NextResponse } from 'next/server';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { loadFinanceRegister } from '@/lib/finance/registerRepository';
import { parseRegisterQuery } from '@/lib/finance/register';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const session = await getPaymentPilotSession();
    if (!session) return NextResponse.json({ error: 'Finance access is not available for this account.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    const result = await loadFinanceRegister(session.user.id, parseRegisterQuery(request.nextUrl.searchParams));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Finance could not be loaded. Try again.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
