import EstimateViewerClient from './EstimateViewerClient';

export default async function EstimateViewerPage({
  params,
}: {
  params: Promise<{ projectId: string; estimateId: string }>;
}) {
  const { projectId, estimateId } = await params;
  return <EstimateViewerClient projectId={projectId} estimateId={estimateId} />;
}
