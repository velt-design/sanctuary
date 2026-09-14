import 'server-only';
import { supabaseServiceRole } from '../supabaseClient';
import { financeReviewSchema, financeObservationSchema } from '../xero/financeReview';

export async function loadFinanceReview(actor: string, search: string, offset: number) {
  const result = await supabaseServiceRole.rpc('xero_finance_review', { p_actor: actor, p_search: search, p_offset: offset });
  if (result.error) throw new Error('FINANCE_REVIEW_UNAVAILABLE');
  const parsed = financeReviewSchema.safeParse(result.data);
  if (!parsed.success) throw new Error('FINANCE_REVIEW_UNAVAILABLE');
  const rows = parsed.data.rows.slice(0, 50);
  if (!rows.length) return { rows, hasMore: false, checkedAt: parsed.data.checkedAt };
  const observations = await supabaseServiceRole.rpc('xero_finance_observations', { p_actor: actor, p_invoice_ids: rows.map(row => row.invoiceId) });
  const observed = financeObservationSchema.array().max(50).safeParse(observations.data);
  if (observations.error || !observed.success) throw new Error('FINANCE_REVIEW_UNAVAILABLE');
  const byInvoice = new Map(observed.data.map(item => [item.invoiceId, item]));
  return { rows: rows.map(row => ({ ...row, observation: byInvoice.get(row.invoiceId) ?? null })), hasMore: parsed.data.rows.length > 50, checkedAt: parsed.data.checkedAt };
}
