import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { projects } from '@/data/projects';
import ProjectsExperience from '../ProjectsExperience';
import { buildProjectPageMetadata } from '../projectSeo';

type PageParams = { slug: string };

type PageProps = {
  params: Promise<PageParams>;
};

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((item) => item.slug === slug);

  if (!project) {
    return {
      title: { absolute: 'Project Not Found | Sanctuary Pergolas' },
      description: 'Explore built Sanctuary pergola projects across Auckland and beyond.',
    };
  }

  return buildProjectPageMetadata(project);
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const project = projects.find((item) => item.slug === slug);
  if (!project) notFound();

  return (
    <ProjectsExperience
      projects={projects}
      initialSlugFromUrl={project.slug}
      detailMode
    />
  );
}
