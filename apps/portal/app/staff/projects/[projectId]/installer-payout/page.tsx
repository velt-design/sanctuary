import InstallerPayoutPage from '@/components/installerPayouts/InstallerPayoutPage';
import { notFound } from 'next/navigation';
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  if (process.env.NEXT_PUBLIC_INSTALLER_PAYOUT_ENABLED !== 'true') notFound();
  return <InstallerPayoutPage projectId={(await params).projectId} />;
}
