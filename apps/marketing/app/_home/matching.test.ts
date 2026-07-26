import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import {
  HOME_PATH,
  getIntentResponses,
  isProjectIntent,
  projectIntentValues,
} from './matching';

describe('production homepage intent matching', () => {
  it('returns two unique governed projects for every first-question answer', () => {
    const responses = getIntentResponses(projects);

    expect(responses.map((response) => response.value)).toEqual(
      projectIntentValues,
    );
    for (const response of responses) {
      expect(response.projects).toHaveLength(2);
      expect(new Set(response.projects.map((project) => project.slug)).size)
        .toBe(2);

      for (const project of response.projects) {
        expect(projects.some((candidate) => candidate.slug === project.slug))
          .toBe(true);
        expect(project.projectHref).toBe(`/projects/${project.slug}`);
        expect(project.enquiryHref).toContain(
          `source_path=${encodeURIComponent(HOME_PATH)}`,
        );
        expect(project.enquiryHref).toContain(
          `source_project=${project.slug}`,
        );
      }
    }
  });

  it('keeps the first prototype mapping editorially deterministic', () => {
    const responses = getIntentResponses(projects);

    expect(Object.fromEntries(responses.map((response) => [
      response.value,
      response.projects.map((project) => project.slug),
    ]))).toEqual({
      'home-cover': ['dairy-flat-estate', 'mt-maunganui-box'],
      'outdoor-room': [
        'warkworth-outdoor-room',
        'riverhead-gable-pavilion',
      ],
      'commercial-professional': [
        'goodhome-commercial-terrace',
        'atelier-shu-cafe',
      ],
    });
  });

  it('falls back safely when a configured record is unavailable', () => {
    const withoutDairyFlat = projects.filter(
      (project) => project.slug !== 'dairy-flat-estate',
    );
    const homeCover = getIntentResponses(withoutDairyFlat).find(
      (response) => response.value === 'home-cover',
    );

    expect(homeCover?.projects).toHaveLength(2);
    expect(new Set(homeCover?.projects.map((project) => project.slug)).size)
      .toBe(2);
    expect(homeCover?.projects.some(
      (project) => project.slug === 'dairy-flat-estate',
    )).toBe(false);
  });

  it('accepts only the closed intent enum', () => {
    expect(projectIntentValues.every(isProjectIntent)).toBe(true);
    expect(isProjectIntent('daylight')).toBe(false);
    expect(isProjectIntent('home-cover<script>')).toBe(false);
    expect(isProjectIntent(null)).toBe(false);
  });
});
