import { redirect } from 'next/navigation';

export default async function EstimateViewerPage({
  params,
}: {
  params: Promise<{ projectId: string; estimateId: string }>;
}) {
  const { projectId, estimateId } = await params;
  redirect(
    `/staff/projects/${encodeURIComponent(projectId)}?tab=job-packs&estimateId=${encodeURIComponent(
      estimateId,
    )}&sheet=materials`,
  );
}
