import type { Metadata } from 'next';
import EmailPreviewWorkbenchPage from './EmailPreviewWorkbenchPage';

export const metadata: Metadata = {
  title: 'Email design workbench | Sanctuary Staff Portal',
};

export default function EmailPreviewsPage() {
  return <EmailPreviewWorkbenchPage />;
}
