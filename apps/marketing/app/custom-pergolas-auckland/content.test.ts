import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import { customHero, customStories, customFaqs } from './content';

describe('Custom project-led service content', () => {
  it('uses the residential patio as the opening and actual public imagery for each distinct story', () => {
    expect(customHero.image).toBe('/images/project-tindalls-bay-03.jpg');
    expect(customStories.map(story => story.slug)).toEqual(['tindalls-bay-pavilion', 'warkworth-outdoor-room']);
    for (const story of customStories) {
      const project = projects.find(item => item.slug === story.slug)!;
      expect(project.type).toBe('Residential');
      expect([project.heroImage.src, ...project.gallery.map(image => image.src)]).toContain(story.image);
      expect(story.brief.length).toBeGreaterThan(60);
      expect(story.response.length).toBeGreaterThan(60);
      expect(story.result.length).toBeGreaterThan(60);
    }
    expect(customStories[1].caption).toContain('aluminium and steel');
  });
  it('explains starting without plans and keeps standard estimates distinct from a bespoke layout', () => {
    expect(customFaqs.find(item => item.question.includes('drawings'))?.answer).toMatch(/^No\./);
    expect(customFaqs.find(item => item.question.includes('cost'))?.answer).toContain('does not price a bespoke layout');
    expect(customFaqs.find(item => item.question.includes('consent'))?.answer).toContain('depends on the site and final design');
  });
});
