import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import StudioReviewDocumentPage from '@/components/designStudio/StudioReviewDocumentPage';
import { STUDIO_EDIT_CALLBACK_HEADER, studioReviewCallback } from '@/lib/designStudio/studioEditRoute';
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
    const callback=studioReviewCallback((await headers()).get(STUDIO_EDIT_CALLBACK_HEADER),true);
    const expected=`/staff/design-studio/${projectId}/${estimateId}${quoteVersionId?`?quoteVersionId=${encodeURIComponent(quoteVersionId)}`:''}`;
    if(Object.keys(query).every(key=>key==='quoteVersionId')&&callback===expected)return <StudioReviewDocumentPage callback={callback} projectId={projectId} estimateId={estimateId} quoteVersionId={quoteVersionId}/>;
    return <SavedStudioReviewLoader projectId={projectId} estimateId={estimateId} quoteVersionId={quoteVersionId} />;
  } catch { notFound(); }
}
