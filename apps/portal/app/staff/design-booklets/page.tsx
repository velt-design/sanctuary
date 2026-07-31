import type { Metadata } from 'next';
import DesignBookletWorkbenchPage from './DesignBookletWorkbenchPage';

export const metadata: Metadata = {
  title: 'Design Booklet Workbench | Sanctuary',
};

export default async function DesignBookletsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string | string[] }>;
}) {
  const query = await searchParams;
  const projectId =
    typeof query.projectId === 'string' ? query.projectId.trim() : undefined;
  return <DesignBookletWorkbenchPage projectId={projectId || undefined} />;
}
