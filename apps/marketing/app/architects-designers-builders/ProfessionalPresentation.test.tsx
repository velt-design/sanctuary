import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfessionalHero, ProfessionalContent } from './ProfessionalPresentation';
import { professionalCapabilityConfig as config } from './content';

function render() {
  const element = document.createElement('div');
  element.innerHTML = renderToStaticMarkup(<><ProfessionalHero /><ProfessionalContent /></>);
  return element;
}

describe('photographic professional collaboration', () => {
  it('shows the existing headline, native early brief action and all three project roles', () => {
    const page = render();
    expect(page.querySelector('h1')?.textContent).toBe(config.hero.title);
    expect(page.querySelector('header a')?.getAttribute('href')).toBe('#project-details');
    const stories = [...page.querySelectorAll('#professional-projects article')];
    expect(stories).toHaveLength(3);
    expect(stories.map(story => story.querySelector('a')?.getAttribute('href'))).toEqual(['/projects/kiwi-rail-platform', '/projects/lilliput-mini-golf', '/projects/goodhome-commercial-terrace']);
    expect(stories[0].textContent).toContain('JCY Architects engaged Sanctuary');
    expect(stories[1].textContent).toContain('Sanctuary’s role on this project');
    expect(stories[2].textContent).toContain('Steel and aluminium framing');
    expect(page.textContent).toContain('For your project, we agree');
    expect(page.textContent).not.toMatch(/115|supply-only|guarantee/i);
  });

  it('uses four distinct existing project photographs, with the canonical hero first', () => {
    const images = [...render().querySelectorAll('img')];
    const paths = images.map(image => new URL(image.getAttribute('src')!, 'https://example.invalid').searchParams.get('url')!);
    expect(paths[0]).toBe(config.hero.image);
    expect(new Set(paths).size).toBe(4);
    for (const path of paths) expect(existsSync(resolve('apps/marketing/public', path.slice(1))), path).toBe(true);
    expect(images.every(image => !!image.getAttribute('alt') && !!image.getAttribute('sizes'))).toBe(true);
  });

  it('keeps the engineer boundary visible while optional detail remains native and available', () => {
    const page = render();
    const details = [...page.querySelectorAll('details')];
    expect(details.map(detail => detail.querySelector('summary')?.textContent)).toEqual(['Roof form, materials and building connections', 'Screens, lighting and connected trades', 'Engineering, consent and responsibilities']);
    expect(details.every(detail => !detail.hasAttribute('open'))).toBe(true);
    const engineer = [...page.querySelectorAll('p')].find(p => p.textContent?.includes('Engineering design and sign-off remain'))!;
    expect(engineer.closest('details')).toBeNull();
    expect(page.textContent).toContain('junctions, levels, drainage');
    expect(page.textContent).toContain('installation access before fabrication');
  });
});
