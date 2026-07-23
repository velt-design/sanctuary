import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { listCostingConfigurationOverview } from '@/lib/costing/configurationAdmin';
import CostingControlCentre from './CostingControlCentre';

export const runtime = 'nodejs';

export default async function CostingControlCentrePage() {
  const supabase = await getSupabaseServerAuth();
  const overview = await listCostingConfigurationOverview(supabase);
  return <CostingControlCentre initialOverview={overview} />;
}
