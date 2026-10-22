import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { listCostingConfigurationOverview } from '@/lib/costing/configurationAdmin';
import CostingControlCentre from './CostingControlCentre';

export const runtime = 'nodejs';

export default async function CostingControlCentrePage() {
  const supabase = await getSupabaseServerAuth();
  const initialOverviewRead=listCostingConfigurationOverview(supabase).catch(()=>null);
  return <CostingControlCentre initialOverviewRead={initialOverviewRead} />;
}
