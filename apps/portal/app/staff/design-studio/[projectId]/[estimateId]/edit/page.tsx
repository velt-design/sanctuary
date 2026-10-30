import { notFound } from 'next/navigation';
import StudioAuthoringLoader from '@/components/designStudio/StudioAuthoringLoader';
import { studioIdentifier } from '@/lib/designStudio/identifiers';
import {requireStaffPageAccess} from '@/lib/auth';
import {getSafeCallbackUrl} from '@/lib/portalAccess';
import {studioEditQuery,studioDocumentCallback,STUDIO_EDIT_CALLBACK_HEADER} from '@/lib/designStudio/studioEditRoute';
import {headers} from 'next/headers';
import StudioDocumentPage from '@/components/designStudio/StudioDocumentPage';

export default async function StudioEditPage({ params, searchParams }: { params: Promise<{ projectId: string; estimateId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') notFound();
  const input = await params;
  let projectId: string, estimateId: string;
  try { projectId = studioIdentifier(input.projectId, 'proj').appId; estimateId = studioIdentifier(input.estimateId, 'est').appId; }
  catch { notFound(); }
  const query = await searchParams;
  const selected=studioEditQuery(query);
  if(!selected)notFound();
  const path=`/staff/design-studio/${projectId}/${estimateId}/edit`;
  const callback=studioDocumentCallback(path+selected.search,true);
  if(callback&&(await headers()).get(STUDIO_EDIT_CALLBACK_HEADER)===callback)return <StudioDocumentPage callback={callback}/>;
  await requireStaffPageAccess(getSafeCallbackUrl(path+selected.search,path));
  const {intent,duplicateName}=selected;
  return <StudioAuthoringLoader key={JSON.stringify([projectId, estimateId, intent, duplicateName])} projectId={projectId} estimateId={estimateId} intent={intent} duplicateName={duplicateName} />;
}
