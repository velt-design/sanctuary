import { describe, expect, it } from 'vitest';
import {
  buildProjectFinderBriefHeading,
  buildProjectFinderDestinationHref,
  buildProjectFinderHomeDestinationHref,
  buildProjectFinderProjectHref,
  resolveProjectFinderHomeEnquiryContextFromReader,
  resolveProjectFinderHomeSelectionFromReader,
  resolveProjectFinderJourneyContext,
  resolveProjectFinderProjectJourneyContext,
} from './projectFinderContinuation';

describe('project finder continuation', () => {
  it('builds concise, grammatical brief headings', () => {
    expect(buildProjectFinderBriefHeading('cover', [])).toBe(
      'A simple cover, shaped to your home and site.',
    );
    expect(buildProjectFinderBriefHeading('outdoor-room', ['everyday-use'])).toBe(
      'A complete outdoor room designed to make the space work every day.',
    );
    expect(buildProjectFinderBriefHeading('bespoke', [
      'coordination',
      'daylight',
      'open-structure',
    ])).toBe(
      'A custom pergola design developed to keep the structure visually open, coordinate cleanly with the wider project, and preserve natural light.',
    );
  });

  it('carries a canonical selection into its recommended service route', () => {
    expect(buildProjectFinderDestinationHref('outdoor-room', [
      'entertaining',
      'daylight',
      'entertaining',
    ])).toBe(
      '/outdoor-rooms-auckland?project=outdoor-room&priorities=daylight%2Centertaining',
    );
  });

  it('restores a valid brief into the embedded enquiry context', () => {
    expect(resolveProjectFinderJourneyContext('bespoke', {
      project: 'bespoke',
      priorities: 'coordination,daylight,open-structure',
    })).toMatchObject({
      direction: 'bespoke',
      priorities: ['daylight', 'open-structure', 'coordination'],
      destination: '/custom-pergolas-auckland',
      returnHref: '/?project=bespoke&priorities=daylight%2Copen-structure%2Ccoordination',
      enquiryContext: {
        enquiryType: 'residential',
        sourcePath: '/custom-pergolas-auckland',
        sourceComponent: 'embedded_form',
        sourceExperience: 'project-finder-home-v1',
        projectDirection: 'bespoke',
        projectPriorities: ['daylight', 'open-structure', 'coordination'],
      },
    });
  });

  it('routes the in-place homepage choices without changing legacy service contracts', () => {
    expect(buildProjectFinderHomeDestinationHref({
      direction: 'cover',
      priorities: ['daylight'],
    })).toBe(
      '/acrylic-roof-pergolas-auckland?project=cover&priorities=daylight',
    );
    expect(buildProjectFinderHomeDestinationHref({
      direction: 'bespoke',
      priorities: ['coordination'],
    })).toBe(
      '/custom-pergolas-auckland?project=bespoke&priorities=coordination',
    );
    expect(buildProjectFinderDestinationHref('cover', [])).toBe(
      '/pergolas-auckland?project=cover',
    );
  });

  it('resolves closed commercial and professional homepage attribution', () => {
    const params = new URLSearchParams(
      'project=commercial-professional&professional_path=architects-designers',
    );
    expect(resolveProjectFinderHomeSelectionFromReader(params)).toEqual({
      direction: 'commercial-professional',
      priorities: [],
      professionalPath: 'architects-designers',
    });
    expect(resolveProjectFinderHomeEnquiryContextFromReader(params)).toEqual({
      enquiryType: 'professional',
      sourcePath: '/',
      sourceComponent: 'header',
      sourceExperience: 'project-finder-home-v1',
      projectDirection: 'commercial-professional',
      projectProfessionalPath: 'architects-designers',
    });
  });

  it('carries the selection and viewed project into a later project enquiry', () => {
    expect(buildProjectFinderProjectHref('outdoor-room', [
      'entertaining',
      'daylight',
    ], 'warkworth-outdoor-room')).toBe(
      '/projects/warkworth-outdoor-room?project=outdoor-room&priorities=daylight%2Centertaining&reference=warkworth-outdoor-room',
    );
    expect(resolveProjectFinderProjectJourneyContext(
      'warkworth-outdoor-room',
      {
        project: 'outdoor-room',
        priorities: 'entertaining,daylight',
        reference: 'warkworth-outdoor-room',
      },
    )).toMatchObject({
      direction: 'outdoor-room',
      priorities: ['daylight', 'entertaining'],
      sourceProject: 'warkworth-outdoor-room',
      enquiryContext: {
        sourcePath: '/projects/warkworth-outdoor-room',
        sourceComponent: 'project_cta',
        sourceProject: 'warkworth-outdoor-room',
        sourceExperience: 'project-finder-home-v1',
        projectDirection: 'outdoor-room',
        projectPriorities: ['daylight', 'entertaining'],
      },
    });
  });

  it('rejects project continuation when its reference is missing or mismatched', () => {
    expect(resolveProjectFinderProjectJourneyContext(
      'warkworth-outdoor-room',
      { project: 'outdoor-room' },
    )).toBeNull();
    expect(resolveProjectFinderProjectJourneyContext(
      'warkworth-outdoor-room',
      {
        project: 'outdoor-room',
        reference: 'riverhead-gable-pavilion',
      },
    )).toBeNull();
  });

  it('rejects wrong-route, duplicate and arbitrary direction values', () => {
    expect(resolveProjectFinderJourneyContext('cover', {
      project: 'bespoke',
      priorities: 'daylight',
    })).toBeNull();
    expect(resolveProjectFinderJourneyContext('cover', {
      project: ['cover', 'bespoke'],
    })).toBeNull();
    expect(resolveProjectFinderJourneyContext('cover', {
      project: 'person@example.test',
    })).toBeNull();
  });
});
