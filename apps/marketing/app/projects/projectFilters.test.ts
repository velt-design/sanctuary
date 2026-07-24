import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import {
  ALL_PROJECT_FILTERS,
  PROJECT_AUDIENCE_OPTIONS,
  buildProjectFilterHref,
  filterProjects,
  getProjectFormOptions,
  readProjectFilters,
  type ProjectFilters,
} from './projectFilters';

describe('project filters', () => {
  it('derives filter options from the governed project fields', () => {
    expect(PROJECT_AUDIENCE_OPTIONS).toEqual([
      { label: 'Residential', value: 'residential' },
      { label: 'Commercial', value: 'commercial' },
    ]);
    expect(getProjectFormOptions(projects)).toEqual([
      { label: 'Box-perimeter', value: 'box-perimeter' },
      { label: 'Gable', value: 'gable' },
      { label: 'Hip', value: 'hip' },
      { label: 'Pitched', value: 'pitched' },
    ]);
  });

  it('covers every audience and roof-form combination, including empty states', () => {
    const combinations = [
      ['all', 'all', 14],
      ['all', 'box-perimeter', 3],
      ['all', 'gable', 6],
      ['all', 'hip', 1],
      ['all', 'pitched', 4],
      ['residential', 'all', 9],
      ['residential', 'box-perimeter', 3],
      ['residential', 'gable', 4],
      ['residential', 'hip', 1],
      ['residential', 'pitched', 1],
      ['commercial', 'all', 5],
      ['commercial', 'box-perimeter', 0],
      ['commercial', 'gable', 2],
      ['commercial', 'hip', 0],
      ['commercial', 'pitched', 3],
    ] as const;

    for (const [audience, form, expectedCount] of combinations) {
      const filters: ProjectFilters = { audience, form };
      const result = filterProjects(projects, filters);

      expect(result, `${audience} / ${form}`).toHaveLength(expectedCount);
      expect(result.every((project) => (
        audience === ALL_PROJECT_FILTERS
        || project.type.toLowerCase() === audience
      ))).toBe(true);
    }
  });

  it('fails unknown URL values safely to the all-project state', () => {
    expect(readProjectFilters(
      new URLSearchParams('audience=public&form=flat'),
      projects,
    )).toEqual({
      audience: ALL_PROJECT_FILTERS,
      form: ALL_PROJECT_FILTERS,
    });
  });

  it('updates and resets filters without discarding legacy selection or attribution', () => {
    const current = new URLSearchParams('slug=riverhead-gable-pavilion&utm_source=review');
    const filteredHref = buildProjectFilterHref('/projects', current, {
      audience: 'residential',
      form: 'gable',
    });

    expect(filteredHref).toBe(
      '/projects?slug=riverhead-gable-pavilion&utm_source=review&audience=residential&form=gable',
    );
    expect(buildProjectFilterHref(
      '/projects',
      new URLSearchParams(filteredHref.split('?')[1]),
      { audience: ALL_PROJECT_FILTERS, form: ALL_PROJECT_FILTERS },
    )).toBe('/projects?slug=riverhead-gable-pavilion&utm_source=review');
  });
});
