import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';
import { requireAdminPageAccess } from '@/lib/auth';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { listCostingConfigurationOverview } from '@/lib/costing/configurationAdmin';
import CostingControlCentre from './CostingControlCentre';

export const runtime = 'nodejs';

export default async function CostingControlCentrePage() {
  await requireAdminPageAccess('/admin/costing');
  const supabase = await getSupabaseServerAuth();
  const initialOverviewRead=listCostingConfigurationOverview(supabase).catch(()=>null);
  return <PortalGuardedPage pathname="/admin/costing" completion={{}} publicFrame={false}><CostingControlCentre initialOverviewRead={initialOverviewRead} /></PortalGuardedPage>;
}
