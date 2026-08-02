import { describe, expect, it } from 'vitest';
import {
  buildProjectFinderBriefHeading,
  buildProjectFinderDestinationHref,
  resolveProjectFinderJourneyContext,
} from './projectFinderContinuation';

describe('project finder continuation', () => {
  it('builds concise, grammatical brief headings', () => {
    expect(buildProjectFinderBriefHeading('cover', [])).toBe(
      'A refined deck cover, shaped to your home and site.',
    );
    expect(buildProjectFinderBriefHeading('outdoor-room', ['everyday-use'])).toBe(
      'A complete outdoor room designed to make the space work every day.',
    );
    expect(buildProjectFinderBriefHeading('bespoke', [
      'coordination',
      'daylight',
      'open-structure',
    ])).toBe(
      'A bespoke pergola response designed to keep the structure visually open, coordinate cleanly with the wider project, and preserve natural light.',
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
      returnHref: '/home-project-finder?project=bespoke&priorities=daylight%2Copen-structure%2Ccoordination',
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
