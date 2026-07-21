import { redirect } from 'next/navigation';

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ projectId: string; quoteId: string }>;
}) {
  const { projectId, quoteId } = await params;
  redirect(
    `/staff/projects/${encodeURIComponent(projectId)}?tab=quotes&quoteId=${encodeURIComponent(
      quoteId,
    )}&quotePreview=1`,
  );
}
