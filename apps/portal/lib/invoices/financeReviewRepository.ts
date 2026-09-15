import 'server-only';
import { supabaseServiceRole } from '../supabaseClient';
import { financeReviewSchema } from '../xero/financeReview';

export async function loadFinanceReview(actor: string, search: string, offset: number) {
  const result = await supabaseServiceRole.rpc('xero_finance_review', { p_actor: actor, p_search: search, p_offset: offset });
  if (result.error) throw new Error('FINANCE_REVIEW_UNAVAILABLE');
  const parsed = financeReviewSchema.safeParse(result.data);
  if (!parsed.success) throw new Error('FINANCE_REVIEW_UNAVAILABLE');
  const rows = parsed.data.rows.slice(0, 50);
  return { rows, hasMore: parsed.data.rows.length > 50, checkedAt: parsed.data.checkedAt };
}
