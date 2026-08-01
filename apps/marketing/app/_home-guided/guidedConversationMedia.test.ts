import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import {
  buildGuidedHomepageMedia,
  getGuidedResultMedia,
} from './guidedConversationMedia';

describe('guided homepage governed media', () => {
  it('resolves every asset and caption from the shared project catalogue', () => {
    const media = buildGuidedHomepageMedia(projects);
    const projectBySlug = new Map(projects.map((project) => [project.slug, project]));
    const governedMedia = [
      media.hero,
      ...Object.values(media.optionByAnswer),
      ...Object.values(media.resultById),
      ...Object.values(media.commercialResultBySector),
    ];

    for (const item of governedMedia) {
      const project = projectBySlug.get(item.projectSlug);
      expect(project).toBeDefined();
      expect(item.projectTitle).toBe(project?.title);
      expect(item.location).toBe(project?.location);
      expect([
        project?.heroImage,
        ...(project?.gallery ?? []),
      ]).toContainEqual(expect.objectContaining({
        alt: item.alt,
        src: item.src,
      }));
    }
  });

  it('uses the selected business sector for commercial result evidence', () => {
    const media = buildGuidedHomepageMedia(projects);

    expect(getGuidedResultMedia(media, 'commercial', {
      audience: 'business',
      sector: 'workplace',
      role: 'lead',
    }).projectSlug).toBe('kiwi-rail-platform');
    expect(getGuidedResultMedia(media, 'commercial', {
      audience: 'business',
      sector: 'recreation',
      role: 'collaborate',
    }).projectSlug).toBe('lilliput-mini-golf');
    expect(getGuidedResultMedia(media, 'outdoor-room', {
      audience: 'home',
      goal: 'outdoor-room',
      use: 'poolside',
    }).projectSlug).toBe('riverhead-gable-pavilion');
  });

  it('fails closed when a governed project reference is unavailable', () => {
    expect(() => buildGuidedHomepageMedia(
      projects.filter(({ slug }) => slug !== 'dairy-flat-estate'),
    )).toThrow('Missing guided homepage project: dairy-flat-estate');
  });
});
