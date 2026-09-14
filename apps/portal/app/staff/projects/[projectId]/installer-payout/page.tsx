import InstallerPayoutPage from '@/components/installerPayouts/InstallerPayoutPage';
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  return <InstallerPayoutPage projectId={(await params).projectId} />;
}
