import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import { projects } from '@/data/projects';
import { absoluteUrl } from '@/lib/seo';
import ProjectsExperience from './ProjectsExperience';

export const metadata: Metadata = {
  title: { absolute: 'Pergola Projects Auckland | Sanctuary Pergolas' },
  description:
    'Explore built Sanctuary pergola projects across Auckland and beyond, including residential, commercial, gable, pitched, hip and box-perimeter work.',
  alternates: { canonical: '/projects' },
  openGraph: {
    type: 'website',
    url: '/projects',
    title: 'Pergola Projects | Sanctuary Pergolas',
    description:
      'Explore residential and commercial pergola case studies across Auckland and beyond.',
    images: projects[0]?.heroImage.src
      ? [{ url: projects[0].heroImage.src, alt: projects[0].heroImage.alt }]
      : undefined,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pergola Projects | Sanctuary Pergolas',
    description:
      'Explore residential and commercial pergola case studies across Auckland and beyond.',
    images: projects[0]?.heroImage.src ? [projects[0].heroImage.src] : undefined,
  },
};

type ProjectsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = searchParams ? await searchParams : {};
  const slugParam = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const projectSearchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => projectSearchParams.append(key, item));
    } else if (value !== undefined) {
      projectSearchParams.append(key, value);
    }
  });

  return (
    <>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Sanctuary Pergola Projects',
            description: metadata.description,
            url: absoluteUrl('/projects'),
            primaryImageOfPage: projects[0]?.heroImage.src
              ? absoluteUrl(projects[0].heroImage.src)
              : undefined,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Sanctuary pergola project case studies',
            numberOfItems: projects.length,
            itemListElement: projects.map((project, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: project.title,
              url: absoluteUrl(`/projects/${project.slug}`),
            })),
          },
        ]}
      />
      <ProjectsExperience
        projects={projects}
        initialSlugFromUrl={slugParam ?? ''}
        initialSearchParams={projectSearchParams.toString()}
      />
    </>
  );
}
