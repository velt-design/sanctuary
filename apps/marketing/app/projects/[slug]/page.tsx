import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { projects } from '@/data/projects';
import { resolveProjectFinderProjectJourneyContext } from '@/lib/projectFinderContinuation';
import ProjectsExperience from '../ProjectsExperience';
import { buildProjectPageMetadata } from '../projectSeo';

type PageParams = { slug: string };

type PageProps = {
  params: Promise<PageParams>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]);
  const project = projects.find((item) => item.slug === slug);
  if (!project) notFound();
  const projectFinderContext = resolveProjectFinderProjectJourneyContext(
    project.slug,
    query,
  );

  return (
    <ProjectsExperience
      projects={projects}
      initialSlugFromUrl={project.slug}
      detailMode
      projectFinderSelection={projectFinderContext}
    />
  );
}
