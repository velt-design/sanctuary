import type { Metadata } from 'next';
import type { Project } from '../../data/projects';
import { absoluteUrl } from '../../lib/seo';

export function getProjectRoute(project: Project): string {
  return `/projects/${project.slug}`;
}

export function getProjectPageTitle(project: Project): string {
  return `${project.title} Pergola Project | Sanctuary Pergolas`;
}

export function getProjectCaseStudyHero(project: Project) {
  return project.caseStudyHeroImage ?? project.heroImage;
}

export function buildProjectPageMetadata(project: Project): Metadata {
  const title = getProjectPageTitle(project);
  const route = getProjectRoute(project);
  const hero = getProjectCaseStudyHero(project);

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
        url: hero.src,
        alt: hero.alt,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: project.blurb,
      images: [hero.src],
    },
  };
}

export function buildProjectStructuredData(project: Project) {
  const route = getProjectRoute(project);
  const hero = getProjectCaseStudyHero(project);

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${project.title} project case study`,
      description: project.blurb,
      url: absoluteUrl(route),
      primaryImageOfPage: absoluteUrl(hero.src),
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
  ];
}
