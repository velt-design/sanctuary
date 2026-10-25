import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';
import { requireStaffPageAccess } from '@/lib/auth';
import CalculatorGridClient from './CalculatorGridClient';

export default async function CalculatorPage() {
  await requireStaffPageAccess('/staff/calculator');
  return <PortalGuardedPage pathname="/staff/calculator" completion={{}} publicFrame={false}><CalculatorGridClient /></PortalGuardedPage>;
}
