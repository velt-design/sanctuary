import { notFound } from 'next/navigation';
import SavedStudioReviewLoader from '@/components/designStudio/SavedStudioReviewLoader';
import { studioIdentifier } from '@/lib/designStudio/identifiers';

export default async function StudioReviewPage({ params, searchParams }: {
  params: Promise<{ projectId: string; estimateId: string }>;
  searchParams: Promise<{ quoteVersionId?: string | string[] }>;
}) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') notFound();
  const input = await params, query = await searchParams;
  try {
    const projectId = studioIdentifier(input.projectId, 'proj').appId;
    const estimateId = studioIdentifier(input.estimateId, 'est').appId;
    if (Array.isArray(query.quoteVersionId)) notFound();
    const quoteVersionId = query.quoteVersionId ? studioIdentifier(query.quoteVersionId, 'qv').appId : undefined;
    return <SavedStudioReviewLoader projectId={projectId} estimateId={estimateId} quoteVersionId={quoteVersionId} />;
  } catch { notFound(); }
}
