import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import JsonLd from '@/components/JsonLd';
import { projects } from '@/data/projects';
import { absoluteUrl } from '@/lib/seo';
import ProjectsExperience from '../ProjectsExperience';

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

  const title = `${project.title} Pergola Project | Sanctuary Pergolas`;
  const route = `/projects/${project.slug}`;

  return {
    title: { absolute: title },
    description: project.blurb,
    alternates: { canonical: route },
    openGraph: {
      type: 'website',
      url: route,
      title,
      description: project.blurb,
      images: [{
        url: project.heroImage.src,
        alt: project.heroImage.alt,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: project.blurb,
      images: [project.heroImage.src],
    },
  };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const project = projects.find((item) => item.slug === slug);
  if (!project) notFound();

  const route = `/projects/${project.slug}`;

  return (
    <>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `${project.title} project case study`,
            description: project.blurb,
            url: absoluteUrl(route),
            primaryImageOfPage: absoluteUrl(project.heroImage.src),
            isPartOf: {
              '@type': 'CollectionPage',
              name: 'Sanctuary Pergola Projects',
              url: absoluteUrl('/projects'),
            },
            about: {
              '@type': 'Place',
              name: project.location,
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: absoluteUrl('/'),
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Projects',
                item: absoluteUrl('/projects'),
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: project.title,
                item: absoluteUrl(route),
              },
            ],
          },
        ]}
      />
      <ProjectsExperience
        projects={projects}
        initialSlugFromUrl={project.slug}
        detailMode
      />
    </>
  );
}
