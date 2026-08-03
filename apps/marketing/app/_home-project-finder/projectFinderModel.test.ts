import { describe, expect, it } from 'vitest';
import {
  buildProjectFinderHref,
  parseProjectFinderRecord,
  parseProjectFinderState,
  selectCommercialProfessionalPath,
  selectProjectDirection,
  updateProjectPriority,
} from './projectFinderModel';

describe('project finder state model', () => {
  it('parses only closed project and priority values', () => {
    expect(parseProjectFinderRecord({
      project: 'bespoke',
      priorities: 'entertaining,daylight,entertaining,unknown',
      free_text: 'person@example.test',
    })).toEqual({
      project: 'bespoke',
      priorities: ['daylight', 'entertaining'],
    });
    expect(parseProjectFinderRecord({
      project: 'unknown',
      priorities: 'daylight',
    })).toEqual({});
    expect(parseProjectFinderRecord({
      project: 'outdoor-room',
      priorities: 'daylight',
    })).toEqual({});
  });

  it('rejects duplicate-valued project parameters and caps restored priorities', () => {
    expect(parseProjectFinderRecord({
      project: ['cover', 'bespoke'],
      priorities: 'daylight,shade,everyday-use,entertaining',
    })).toEqual({});
    expect(parseProjectFinderRecord({
      project: 'cover',
      priorities: 'daylight,shade,everyday-use,entertaining',
    })).toEqual({
      project: 'cover',
      priorities: ['daylight', 'shade', 'everyday-use'],
    });
  });

  it('serializes valid state deterministically', () => {
    expect(buildProjectFinderHref({
      project: 'bespoke',
      priorities: ['coordination', 'daylight', 'open-structure'],
    })).toBe(
      '/?project=bespoke&priorities=daylight%2Copen-structure%2Ccoordination',
    );
  });

  it('preserves shared priorities when the project direction changes', () => {
    expect(selectProjectDirection({
      project: 'cover',
      priorities: ['daylight', 'shade'],
    }, 'bespoke')).toEqual({
      project: 'bespoke',
      priorities: ['daylight', 'shade'],
    });
  });

  it('keeps the commercial and professional subpath closed and incompatible with priorities', () => {
    expect(parseProjectFinderRecord({
      project: 'commercial-professional',
      professional_path: 'builder-contractor',
      priorities: 'daylight,shade',
    })).toEqual({
      project: 'commercial-professional',
      professionalPath: 'builder-contractor',
    });
    expect(buildProjectFinderHref({
      project: 'commercial-professional',
      professionalPath: 'architects-designers',
      priorities: ['daylight'],
    })).toBe(
      '/?project=commercial-professional&professional_path=architects-designers',
    );
    expect(selectCommercialProfessionalPath(
      { project: 'commercial-professional' },
      'venue',
    )).toEqual({
      project: 'commercial-professional',
      professionalPath: 'venue',
    });
  });

  it('clears residential priorities when moving into the commercial branch', () => {
    expect(selectProjectDirection({
      project: 'cover',
      priorities: ['daylight', 'shade'],
    }, 'commercial-professional')).toEqual({
      project: 'commercial-professional',
    });
  });

  it('prevents a fourth priority without removing an earlier selection', () => {
    const state = {
      project: 'cover' as const,
      priorities: ['daylight', 'shade', 'everyday-use'] as const,
    };
    const update = updateProjectPriority(
      { ...state, priorities: [...state.priorities] },
      'entertaining',
      true,
    );
    expect(update.limitReached).toBe(true);
    expect(update.state).toEqual(state);
  });

  it('restores valid Back and Forward URL state through the URLSearchParams reader', () => {
    expect(parseProjectFinderState(new URLSearchParams(
      '?project=bespoke&priorities=coordination,open-structure',
    ))).toEqual({
      project: 'bespoke',
      priorities: ['open-structure', 'coordination'],
    });
  });
});
