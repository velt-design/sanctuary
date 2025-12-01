import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProjectDetailContent from '../ProjectDetailContent';
import { projects } from '@/data/projects';
import '../projects.css';
import '../../home.css';
import '../../products/product.css';

type PageParams = { slug: string };

type PageProps = {
  params: Promise<PageParams>;
};

export function generateStaticParams() {
  return projects.map(project => ({ slug: project.slug }));
}

export async function generateMetadata(
  { params }: PageProps,
): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find(item => item.slug === slug);
  if (!project) {
    return {
      title: 'Project detail – Sanctuary Pergolas',
      description: 'Explore recent pergola projects around Auckland.',
    };
  }
  return {
    title: `${project.title} – Projects`,
    description: project.blurb,
    alternates: { canonical: `/projects/${slug}` },
    openGraph: {
      url: `/projects/${slug}`,
      title: `${project.title} – Sanctuary Pergolas`,
      description: project.blurb,
      images: project.heroImage?.src
        ? [
            {
              url: project.heroImage.src,
              alt: project.heroImage.alt,
            },
          ]
        : undefined,
    },
  };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const project = projects.find(item => item.slug === slug);
  if (!project) notFound();
  const related = project.related
    ?.map(slug => projects.find(item => item.slug === slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <main className="projects-standalone" aria-label="Project detail">
      <div className="projects-breadcrumb projects-breadcrumb--standalone">
        <p>
          <Link href="/projects">Projects</Link>
          <span> / {project.title}</span>
        </p>
      </div>
      <div className="projects-standalone__body">
        <ProjectDetailContent
          project={project}
          relatedProjects={related}
          relationMode="link"
          variant="standalone"
          titleAs="h1"
        />
      </div>
    </main>
  );
}
