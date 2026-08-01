import { describe, expect, it } from 'vitest';
import {
  buildProjectFinderHref,
  parseProjectFinderRecord,
  parseProjectFinderState,
  selectProjectDirection,
  updateProjectPriority,
} from './projectFinderModel';

describe('project finder state model', () => {
  it('parses only closed project and priority values', () => {
    expect(parseProjectFinderRecord({
      project: 'outdoor-room',
      priorities: 'entertaining,daylight,entertaining,unknown',
      free_text: 'person@example.test',
    })).toEqual({
      project: 'outdoor-room',
      priorities: ['daylight', 'entertaining'],
    });
    expect(parseProjectFinderRecord({
      project: 'unknown',
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
      '/home-project-finder?project=bespoke&priorities=daylight%2Copen-structure%2Ccoordination',
    );
  });

  it('preserves shared priorities when the project direction changes', () => {
    expect(selectProjectDirection({
      project: 'cover',
      priorities: ['daylight', 'shade'],
    }, 'outdoor-room')).toEqual({
      project: 'outdoor-room',
      priorities: ['daylight', 'shade'],
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
