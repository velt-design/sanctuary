import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import {
  buildProjectPageMetadata,
  buildProjectStructuredData,
  getProjectCaseStudyHero,
  getProjectPageTitle,
  getProjectRoute,
} from './projectSeo';

const project = projects.find(({ slug }) => slug === 'dairy-flat-estate')!;

describe('project detail SEO', () => {
  it('builds canonical server metadata from the selected project record', () => {
    const hero = getProjectCaseStudyHero(project);

    expect(getProjectRoute(project)).toBe('/projects/dairy-flat-estate');
    expect(getProjectPageTitle(project)).toBe(
      'Dairy Flat Estate Pergola Project | Sanctuary Pergolas',
    );
    expect(buildProjectPageMetadata(project)).toMatchObject({
      title: { absolute: getProjectPageTitle(project) },
      description: project.blurb,
      alternates: { canonical: '/projects/dairy-flat-estate' },
      openGraph: {
        url: '/projects/dairy-flat-estate',
        images: [{ url: hero.src, alt: hero.alt }],
      },
      twitter: {
        images: [hero.src],
      },
    });
  });

  it('keeps structured data aligned with the canonical project route', () => {
    const schemas = buildProjectStructuredData(project);

    expect(schemas[0]).toMatchObject({
      '@type': 'WebPage',
      name: 'Dairy Flat Estate project case study',
      url: 'https://www.sanctuarypergolas.co.nz/projects/dairy-flat-estate',
    });
    expect(schemas[1]).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: expect.arrayContaining([
        expect.objectContaining({
          position: 3,
          name: project.title,
          item: 'https://www.sanctuarypergolas.co.nz/projects/dairy-flat-estate',
        }),
      ]),
    });
  });
});
