import { expect, it } from 'vitest';
import { resolveBlindsContext } from './blindsContext';

it('does not invent a guided result for a default or incomplete guide visit', () => {
  for (const params of [{}, { use: 'poolside' }, { source_experience: 'guided-home-v1', source_pathway: 'outdoor-room', source_focus: 'invalid' }]) {
    const result = resolveBlindsContext(params);
    expect(result.guided).toBeNull(); expect(result.finder).toBeNull();
    expect(result.context).toEqual({ enquiryType: 'residential', sourcePath: '/pergolas-with-blinds', sourceComponent: 'embedded_form' });
  }
});

it('carries an actual guided brief with its original source and recovery path', () => {
  const result = resolveBlindsContext({ source_experience: 'guided-home-v1', source_pathway: 'outdoor-room', source_focus: 'poolside', source_path: '/outdoor-rooms-auckland' });
  expect(result.context).toMatchObject({ sourcePath: '/outdoor-rooms-auckland', sourcePathway: 'outdoor-room', sourceFocus: 'poolside' });
  expect(result.guided?.returnHref).toBe('/home-guided?audience=home&goal=outdoor-room&use=poolside');
});

it('retains finder priorities and the known project reference without accepting arbitrary references', () => {
  const params = { project: 'outdoor-room', priorities: 'entertaining,daylight', reference: 'tindalls-bay-pavilion' };
  const result = resolveBlindsContext(params);
  expect(result.context).toMatchObject({ sourcePath: '/projects/tindalls-bay-pavilion', sourceProject: 'tindalls-bay-pavilion', sourceExperience: 'project-finder-home-v1', projectDirection: 'outdoor-room' });
  expect(result.context.projectPriorities).toEqual(['daylight', 'entertaining']);
  expect(result.sourceProject?.title).toBe('Tindalls Bay - Patio & Carport');
  expect(result.finder?.returnHref).toBe('/?project=outdoor-room&priorities=daylight%2Centertaining');
  expect(resolveBlindsContext({ ...params, reference: 'not-a-project' }).sourceProject).toBeUndefined();
});

it('retains canonical finder and product query attribution through a guide visit', () => {
  const result = resolveBlindsContext({ source_experience: 'project-finder-home-v1', project_direction: 'bespoke', project_priorities: 'open-structure,coordination', source_project: 'tindalls-bay-pavilion', source_product: 'drop-down-blinds', source_path: '/products/screens-walls/drop-down-blinds' });
  expect(result.context).toMatchObject({ sourceProduct: 'drop-down-blinds', sourceProject: 'tindalls-bay-pavilion', sourcePath: '/products/screens-walls/drop-down-blinds', projectDirection: 'bespoke', projectPriorities: ['open-structure', 'coordination'] });
  expect(result.finder?.summaryHeading).toContain('structure visually open');
});
