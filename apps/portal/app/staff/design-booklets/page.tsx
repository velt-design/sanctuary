import type { Metadata } from 'next';
import DesignBookletWorkbenchPage from './DesignBookletWorkbenchPage';

export const metadata: Metadata = {
  title: 'Design Booklet Workbench | Sanctuary',
};

export default function DesignBookletsPage() {
  return <DesignBookletWorkbenchPage />;
}
