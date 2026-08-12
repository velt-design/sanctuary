import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import { buildProjectFinderHomepageMedia } from './projectFinderMedia';

describe('project finder governed media', () => {
  it('resolves the hero, choices and two evidence projects per direction', () => {
    const media = buildProjectFinderHomepageMedia(projects);
    expect(media.hero.projectSlug).toBe('warkworth-outdoor-room');
    expect(media.hero.mobileSrc).toBe('/images/warkworth-gable-02.jpg');
    expect(Object.values(media.choiceByDirection).map((item) => item.src))
      .toEqual([
        '/images/simple-pergolas/pitched-01.webp',
        '/images/project-mt-maunganui-01.jpg',
        '/images/project-tamaki-dr-02.jpg',
      ]);
    expect(Object.values(media.choiceByProfessionalPath)
      .map((item) => item.projectSlug)).toEqual([
        'goodhome-commercial-terrace',
        'lilliput-mini-golf',
        'kiwi-rail-platform',
      ]);
    expect(media.choiceByProfessionalPath.venue.src)
      .toBe('/images/project-goodhome-06.jpg');
    for (const evidence of Object.values(media.evidenceByDirection)) {
      expect(evidence).toHaveLength(2);
      expect(evidence.every((project) => Boolean(project.reason))).toBe(true);
    }
    for (const evidence of Object.values(media.evidenceByProfessionalPath)) {
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
