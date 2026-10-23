import 'server-only';
import { supabaseServiceRole } from '../supabaseClient';
import { registerSchema, type RegisterQuery } from './register';

/** One bounded SQL statement; never reads Xero or executes financial commands. */
export async function loadFinanceRegister(actor: string, query: RegisterQuery) {
  const { data, error } = await supabaseServiceRole.rpc('finance_register_v1', {
    p_actor: actor, p_tab: query.tab, p_view: query.view, p_search: query.search, p_sent: query.sent, p_offset: query.offset,
  });
  const parsed = registerSchema.safeParse(data);
  if (error || !parsed.success) throw new Error('FINANCE_REGISTER_UNAVAILABLE');
  return parsed.data;
}
