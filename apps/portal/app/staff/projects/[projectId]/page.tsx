import ProjectDetailLiteClient from './ProjectDetailLiteClient';

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectDetailLiteClient projectId={projectId} />;
}
