import { json, sameOrigin } from '@/lib/xero/http';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { financeSummaryPeriod } from '@/lib/xero/financeSummaryContract';
import { readFinanceSummary } from '@/lib/xero/financeSummary';
export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST(request: Request) {
  try {
    if (!await getPaymentPilotSession() || !sameOrigin(request)) return json({ error: 'Finance permission is required.' }, 403);
    const text = await request.text();
    if (text.length > 200) return json({ error: 'Choose a valid period of at most 90 days.' }, 400);
    let value: unknown;
    try { value = JSON.parse(text); } catch { return json({ error: 'Choose a valid period of at most 90 days.' }, 400); }
    const parsed = financeSummaryPeriod.safeParse(value);
    if (!parsed.success) return json({ error: 'Choose a valid period of at most 90 days.' }, 400);
    return json(await readFinanceSummary(parsed.data));
  } catch (error) {
    if (error instanceof Error && error.message === 'SUMMARY_FUTURE_PERIOD') return json({ error: 'Choose dates ending today or earlier in Auckland.' }, 400);
    return json({ error: 'A complete Xero summary could not be verified. No totals are shown. Try a shorter period or ask your finance administrator to check the connection.' }, 503);
  }
}
