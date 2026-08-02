import { describe, expect, it } from 'vitest';

import { parseSubmittedEnquiryContext } from './enquirySubmissionContext';

const knownContext = {
  projectSlugs: ['warkworth-outdoor-room'],
  productSlugs: ['gable-roof-pergolas'],
};

describe('parseSubmittedEnquiryContext', () => {
  it('accepts governed project-finder context and canonicalises priorities', () => {
    expect(parseSubmittedEnquiryContext({
      enquiry_type: 'residential',
      source_path: '/',
      source_component: 'brief_summary',
      source_experience: 'project-finder-home-v1',
      project_direction: 'outdoor-room',
      project_priorities: ['shade', 'daylight', 'shade', 'everyday-use', 'open-structure'],
    }, knownContext)).toEqual({
      enquiryType: 'residential',
      sourcePath: '/',
      sourceComponent: 'brief_summary',
      sourceExperience: 'project-finder-home-v1',
      projectDirection: 'outdoor-room',
      projectPriorities: ['daylight', 'shade', 'everyday-use'],
    });
  });

  it('rejects ungoverned values from an untrusted submission', () => {
    expect(parseSubmittedEnquiryContext({
      source_path: 'https://example.com/redirect',
      source_component: 'free-text',
      source_experience: 'project-finder-home-v1',
      project_direction: 'invented',
      project_priorities: { unexpected: true },
    }, knownContext)).toEqual({
      sourceExperience: 'project-finder-home-v1',
    });
  });
});
