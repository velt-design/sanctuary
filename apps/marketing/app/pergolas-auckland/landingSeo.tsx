import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import { pergolaGuideEditorialReview } from '@/data/pergolaGuides';
import { absoluteUrl } from '@/lib/seo';

export const route = '/pergolas-auckland';
export const heroImage = '/images/project-riverhead-gable-01.jpg';

export const landingMetadata: Metadata = {
  title: { absolute: 'Pergolas Auckland | Design, Build & Installation' },
  description:
    'Outdoor pergolas designed and installed in Auckland. Explore Pitched, Gable and Box rooflines, see an installed estimate and plan your project with Sanctuary.',
  alternates: { canonical: route },
  openGraph: {
    type: 'website',
    url: route,
    title: 'Outdoor Pergolas, Designed and Installed in Auckland',
    description:
      'A practical guide to planning a pergola around the home, the outdoor room and the conditions that reach the site.',
    images: [
      {
        url: heroImage,
        alt: 'Poolside gable pergola beside an Auckland home',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Outdoor Pergolas, Designed and Installed in Auckland',
    description:
      'Compare roof form, material, daylight, shelter and scope before planning an Auckland pergola.',
    images: [heroImage],
  },
};

export function PergolaStructuredData() {
  const breadcrumbSchema = {
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
        name: 'Pergola Guides',
        item: absoluteUrl('/pergola-guides'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Pergolas Auckland',
        item: absoluteUrl(route),
      },
    ],
  };

  return (<JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Pergolas Auckland',
            url: absoluteUrl(route),
            description: landingMetadata.description,
            primaryImageOfPage: absoluteUrl(heroImage),
            dateModified: pergolaGuideEditorialReview.date,
            reviewedBy: {
              '@type': 'Organization',
              name: pergolaGuideEditorialReview.reviewer,
              url: absoluteUrl('/'),
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Pergola design, build and installation in Auckland',
            serviceType: 'Pergola design and installation',
            areaServed: { '@type': 'City', name: 'Auckland' },
            provider: {
              '@type': 'Organization',
              name: 'Sanctuary Pergolas',
              url: absoluteUrl('/'),
            },
            url: absoluteUrl(route),
          },
          breadcrumbSchema,
        ]}
      />);
}
