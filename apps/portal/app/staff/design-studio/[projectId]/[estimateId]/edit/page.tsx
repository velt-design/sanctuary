import { notFound } from 'next/navigation';
import StudioAuthoringLoader from '@/components/designStudio/StudioAuthoringLoader';
import { studioIdentifier } from '@/lib/designStudio/identifiers';
import { validateCommercialInternalName } from '@/lib/commercial/internalName';

export default async function StudioEditPage({ params, searchParams }: { params: Promise<{ projectId: string; estimateId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') notFound();
  const input = await params;
  let projectId: string, estimateId: string;
  try { projectId = studioIdentifier(input.projectId, 'proj').appId; estimateId = studioIdentifier(input.estimateId, 'est').appId; }
  catch { notFound(); }
  const query = await searchParams;
  const intent = query.intent ?? 'edit';
  if (!['edit', 'revision', 'duplicate'].includes(String(intent)) || Array.isArray(intent) || Object.keys(query).some(key => !['intent', 'name'].includes(key)) || Array.isArray(query.name)) notFound();
  const name = validateCommercialInternalName(query.name);
  if (!name.ok || (query.name !== undefined && intent !== 'duplicate')) notFound();
  const duplicateName = name.value ?? undefined;
  return <StudioAuthoringLoader key={JSON.stringify([projectId, estimateId, intent, duplicateName])} projectId={projectId} estimateId={estimateId} intent={intent as 'edit' | 'revision' | 'duplicate'} duplicateName={duplicateName} />;
}
