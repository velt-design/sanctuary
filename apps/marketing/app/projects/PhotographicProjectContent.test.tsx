import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import { buildEnquiryHref } from '../../lib/enquiryContext';
import ProjectDesignStartingPoint from '../../components/products/ProjectDesignStartingPoint';
import { parsePreviewShareHash } from '../../components/configurator-prototype/previewShare';
import { getProjectEditorialStory } from './projectEditorialStories';
import { buildProjectPageMetadata, buildProjectStructuredData, getProjectCaseStudyHero } from './projectSeo';
import PhotographicProjectContent from './PhotographicProjectContent';

function render(slug: string) {
  const project = projects.find(p => p.slug === slug)!;
  const el = document.createElement('div');
  el.innerHTML = renderToStaticMarkup(<PhotographicProjectContent project={project} story={getProjectEditorialStory(project)!} enquiryHref={buildEnquiryHref({ enquiryType: project.type === 'Commercial' ? 'commercial' : 'residential', sourceProject: slug, sourcePath: `/projects/${slug}` })} relatedProjects={projects.filter(p => project.related?.includes(p.slug))} projectHref={id => `/projects/${id}?project=bespoke`} designStartingPoint={slug === 'st-heliers-townhouse' ? <ProjectDesignStartingPoint /> : undefined} />);
  return { el, project };
}

describe('project-specific photographic stories', () => {
  it('maps every configured story only to its real project photographs', () => {
    for (const project of projects) {
      const story = getProjectEditorialStory(project);
      if (!story) continue;
      const available = new Set([project.heroImage.src, getProjectCaseStudyHero(project).src, ...project.gallery.map(image => image.src)]);
      const selected = [getProjectCaseStudyHero(project).src, ...story.decisions.map(decision => decision.image)];
      expect(new Set(selected).size, project.slug).toBe(selected.length);
      for (const src of selected) expect(available.has(src), `${project.slug}: ${src}`).toBe(true);
      const remaining = project.gallery.filter(image => !selected.includes(image.src)).map(image => image.src);
      expect(new Set([...selected, ...remaining]), project.slug).toEqual(available);
    }
  });

  it('gives all fourteen remaining projects a complete, distinct story and preserves their capabilities', () => {
    const configured = projects.filter(project => getProjectEditorialStory(project));
    expect(configured).toHaveLength(14);
    expect(getProjectEditorialStory({ slug: 'warkworth-outdoor-room' })).toBeNull();
    for (const project of configured) {
      const { el } = render(project.slug);
      const story = getProjectEditorialStory(project)!;
      expect(el.querySelector('#project-story')?.textContent, project.slug).toContain(story.brief ?? project.description[0]);
      expect(el.querySelectorAll('[data-project-decision]'), project.slug).toHaveLength(story.decisions.length);
      expect(el.querySelector('#project-details')?.textContent, project.slug).toContain(story.detailSummary);
      expect(el.querySelectorAll('#project-details dt').length, project.slug).toBeGreaterThan(0);
      expect([...el.querySelectorAll('#project-details dd')].every(fact => fact.textContent?.trim()), project.slug).toBe(true);
      for (const section of project.sections.filter(section => !/^design brief$/i.test(section.title))) {
        for (const text of section.bullets?.length ? section.bullets : section.paragraphs) expect(el.textContent, project.slug).toContain(text);
      }
      if (project.videoYoutubeId) expect(el.querySelector('iframe')?.getAttribute('src')).toContain(project.videoYoutubeId);
      expect(el.querySelector('#project-enquiry-title')?.textContent).toBe(project.type === 'Commercial' ? 'Plan your covered space.' : 'A space of your own.');
    }
  });

  it('preserves credits and scope while keeping unresolved KiwiRail area out of the new story', () => {
    expect(render('milford-garden-retreat').el.textContent).toContain('Design with Rudi Landscapes, in collaboration with GGL Landscaping & Gardening');
    expect(render('lilliput-mini-golf').el.textContent).toContain('supplying and installing the structure to the architect and engineer');
    const kiwi = render('kiwi-rail-platform');
    expect(kiwi.el.textContent).toContain('JCY Architects');
    expect(kiwi.el.querySelector('#project-details')?.textContent).not.toContain('115');
    expect(kiwi.el.querySelector('#project-details')?.textContent).toContain('30.0 m');
    expect(kiwi.el.querySelector('.project-case-study__hero img')?.getAttribute('alt')).toBe('The covered workplace path at KiwiRail head office');
    expect(render('velskov-forest').el.querySelector('#project-story')?.textContent).toContain('Our brief here');
  });

  it.each(['dairy-flat-estate', 'st-heliers-townhouse'])('retains the complete brief, every photo once and contextual actions for %s', slug => {
    const { el, project } = render(slug);
    expect(el.querySelector('h1')?.textContent).toBe(project.title);
    expect(el.querySelector('#project-story')?.textContent).toContain(project.description[0]);
    const photos = [...el.querySelectorAll<HTMLImageElement>('.project-case-study__hero img, [data-project-decision] img')].map(img => new URL(img.src).searchParams.get('url') ?? img.getAttribute('src'));
    expect(new Set(photos)).toEqual(new Set(project.gallery.map(image => image.src)));
    expect(photos.length).toBe(project.gallery.length);
    expect(el.querySelectorAll('[data-project-decision]')).toHaveLength(slug === 'dairy-flat-estate' ? 2 : 1);
    expect(el.querySelectorAll('#project-details dt')).toHaveLength(3);
    expect(el.querySelectorAll('#project-details details')).toHaveLength(0);
    const actions = [...el.querySelectorAll<HTMLAnchorElement>('a')].filter(a => a.textContent?.includes('Discuss a similar project'));
    expect(actions).toHaveLength(2);
    expect(actions[0].compareDocumentPosition(el.querySelector('.project-case-study__hero')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const action of actions) expect(new URL(action.href).searchParams.get('source_project')).toBe(slug);
    const related = [...el.querySelectorAll<HTMLAnchorElement>('[data-related-projects] a')];
    expect(related).toHaveLength(project.related!.length);
    expect(related.every(link => link.querySelector('img') && new URL(link.href).searchParams.get('project') === 'bespoke')).toBe(true);
  });

  it('uses St Heliers interior for the case-study hero and metadata without changing its collection photo', () => {
    const { project } = render('st-heliers-townhouse');
    expect(getProjectCaseStudyHero(project).src).toBe('/images/project-st-heliers-02.jpg');
    expect(project.heroImage.src).toBe('/images/project-st-heliers-01.jpg');
    expect(buildProjectPageMetadata(project).openGraph).toMatchObject({ images: [{ url: '/images/project-st-heliers-02.jpg' }] });
    expect(buildProjectStructuredData(project)[0].primaryImageOfPage).toContain('/images/project-st-heliers-02.jpg');
  });

  it('keeps St Heliers seeded designer and its project-specific limits', () => {
    const { el } = render('st-heliers-townhouse');
    const action = [...el.querySelectorAll<HTMLAnchorElement>('a')].find(a => a.textContent === 'Start with this roof shape and size')!;
    const url = new URL(action.href);
    expect(url.pathname).toBe('/configurator-preview');
    expect(url.searchParams.get('source_project')).toBe('st-heliers-townhouse');
    expect(parsePreviewShareHash(url.hash)?.draft).toMatchObject({ input: { widthMm: 6000, projectionMm: 3000 }, roof: { family: 'gable' } });
    expect(el.textContent).toContain('does not reproduce this project’s opal tint, custom end-frame pattern or 2.7 m height');
  });
});
