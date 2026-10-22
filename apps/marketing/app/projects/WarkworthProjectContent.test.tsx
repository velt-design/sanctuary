import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import { buildEnquiryHref, parseEnquiryContext } from '../../lib/enquiryContext';
import { getProjectCaseStudyHero } from './projectSeo';
import WarkworthProjectContent from './WarkworthProjectContent';

const project = projects.find(p => p.slug === 'warkworth-outdoor-room')!;
const related = projects.filter(p => project.related?.includes(p.slug));
const href = buildEnquiryHref({ enquiryType: 'residential', sourcePath: `/projects/${project.slug}`, sourceProject: project.slug, sourceComponent: 'project_cta' });
function render() { const el = document.createElement('div'); el.innerHTML = renderToStaticMarkup(<WarkworthProjectContent project={project} enquiryHref={href} relatedProjects={related} projectHref={slug => `/projects/${slug}`} />); return el; }

describe('Warkworth editorial project', () => {
  it('restores the actual brief and puts contextual enquiry before the finished-space hero', () => {
    const el = render();
    expect(el.querySelector('h1')?.textContent).toBe(project.title);
    expect(el.querySelector('#project-story')?.textContent).toContain(project.description[0]);
    const hero = el.querySelector('.project-case-study__hero img')!;
    expect(hero.getAttribute('alt')).toBe(getProjectCaseStudyHero(project).alt);
    const links = [...el.querySelectorAll<HTMLAnchorElement>('a')].filter(a => a.textContent?.includes('Discuss a similar project'));
    expect(links).toHaveLength(2);
    expect(links[0].compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const a of links) expect(parseEnquiryContext(Object.fromEntries(new URL(a.href).searchParams))).toMatchObject({ sourceProject: project.slug, sourcePath: `/projects/${project.slug}`, enquiryType: 'residential' });
  });

  it('uses distinct story photos, keeps technical scope accessible and retains a usable remaining gallery', () => {
    const el = render();
    const storyImages = [...el.querySelectorAll<HTMLImageElement>('.project-case-study__hero img, [data-project-decision] img')].map(img => img.getAttribute('src'));
    expect(storyImages).toHaveLength(4);
    expect(new Set(storyImages).size).toBe(4);
    expect(el.querySelectorAll('[data-project-decision]')).toHaveLength(3);
    expect(el.querySelector('#project-gallery [data-responsive-gallery]')).not.toBeNull();
    expect(el.textContent).toContain('Engineering PS1 provided');
    expect(el.textContent).toContain('registered electrician');
    expect(el.textContent).toContain('9159041M');
    expect(el.querySelectorAll('[data-related-projects] a img')).toHaveLength(related.length);
  });
});
