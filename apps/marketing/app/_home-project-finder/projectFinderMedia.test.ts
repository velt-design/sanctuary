import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import { buildProjectFinderHomepageMedia } from './projectFinderMedia';

describe('project finder governed media', () => {
  it('resolves the hero, choices and two evidence projects per direction', () => {
    const media = buildProjectFinderHomepageMedia(projects);
    expect(media.hero.projectSlug).toBe('warkworth-outdoor-room');
    expect(Object.values(media.choiceByDirection).map((item) => item.projectSlug))
      .toEqual([
        'dairy-flat-estate',
        'warkworth-outdoor-room',
        'tindalls-bay-pavilion',
      ]);
    for (const evidence of Object.values(media.evidenceByDirection)) {
      expect(evidence).toHaveLength(2);
      expect(evidence.every((project) => Boolean(project.reason))).toBe(true);
    }
  });

  it('fails closed when a governed project is unavailable', () => {
    expect(() => buildProjectFinderHomepageMedia(
      projects.filter((project) => project.slug !== 'dairy-flat-estate'),
    )).toThrow('Missing project finder project: dairy-flat-estate');
  });
});
