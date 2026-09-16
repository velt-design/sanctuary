import { notFound } from 'next/navigation';
import InstallerPayoutDemo from './InstallerPayoutDemo';
export default function Page() {
  if (process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() !== '1') notFound();
  return <InstallerPayoutDemo />;
}
