import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import {
  parseHiddenCrewIds,
  SCHEDULE_HIDDEN_CREWS_STORAGE_KEY,
  useScheduleCrewVisibility,
} from './useScheduleCrewVisibility';

function VisibilityHarness({ crewIds }: { crewIds: readonly string[] }) {
  const { hiddenCrewIds, toggleCrew, showAllCrews } = useScheduleCrewVisibility(crewIds);

  return (
    <div>
      <output data-testid="hidden-crews">{Array.from(hiddenCrewIds).sort().join(',')}</output>
      {crewIds.map((crewId) => (
        <button key={crewId} type="button" onClick={() => toggleCrew(crewId)}>
          Toggle {crewId}
        </button>
      ))}
      <button type="button" onClick={showAllCrews}>
        Show all
      </button>
    </div>
  );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useScheduleCrewVisibility', () => {
  beforeEach(() => {
    window.localStorage.removeItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY);
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('parses only valid crew IDs and fails open for malformed storage', () => {
    const validCrewIds = new Set(['crew-a', 'crew-b']);

    expect(Array.from(parseHiddenCrewIds('["crew-b","retired-crew","crew-b",42]', validCrewIds))).toEqual(['crew-b']);
    expect(Array.from(parseHiddenCrewIds('{"hidden":["crew-a"]}', validCrewIds))).toEqual([]);
    expect(Array.from(parseHiddenCrewIds('{bad json', validCrewIds))).toEqual([]);
    expect(Array.from(parseHiddenCrewIds(null, validCrewIds))).toEqual([]);
  });

  it('persists hidden IDs and restores them on the next mount', async () => {
    const crewIds = ['crew-a', 'crew-b'] as const;
    const first = renderIntoDocument(<VisibilityHarness crewIds={crewIds} />);
    await flushEffects();

    act(() => {
      first.container.querySelector<HTMLButtonElement>('button:nth-of-type(2)')?.click();
    });

    expect(first.container.querySelector('[data-testid="hidden-crews"]')?.textContent).toBe('crew-b');
    expect(JSON.parse(window.localStorage.getItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY) ?? 'null')).toEqual(['crew-b']);
    first.unmount();

    const second = renderIntoDocument(<VisibilityHarness crewIds={crewIds} />);
    await flushEffects();

    expect(second.container.querySelector('[data-testid="hidden-crews"]')?.textContent).toBe('crew-b');

    act(() => {
      Array.from(second.container.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent === 'Show all',
      )?.click();
    });

    expect(second.container.querySelector('[data-testid="hidden-crews"]')?.textContent).toBe('');
    expect(window.localStorage.getItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY)).toBeNull();
    second.unmount();
  });

  it('prunes stale persisted IDs and leaves every current crew visible', async () => {
    window.localStorage.setItem(
      SCHEDULE_HIDDEN_CREWS_STORAGE_KEY,
      JSON.stringify(['retired-crew']),
    );

    const rendered = renderIntoDocument(<VisibilityHarness crewIds={['crew-a', 'crew-b']} />);
    await flushEffects();

    expect(rendered.container.querySelector('[data-testid="hidden-crews"]')?.textContent).toBe('');
    expect(window.localStorage.getItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY)).toBeNull();
    rendered.unmount();
  });

  it('keeps a saved preference when crews are temporarily unavailable', async () => {
    window.localStorage.setItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY, JSON.stringify(['crew-b']));
    const rendered = renderIntoDocument(<VisibilityHarness crewIds={[]} />);
    await flushEffects();

    expect(window.localStorage.getItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY)).toBe('["crew-b"]');

    rendered.rerender(<VisibilityHarness crewIds={['crew-a', 'crew-b']} />);
    await flushEffects();

    expect(rendered.container.querySelector('[data-testid="hidden-crews"]')?.textContent).toBe('crew-b');
    rendered.unmount();
  });

  it('fails open when browser storage cannot be read or written', async () => {
    const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const rendered = renderIntoDocument(<VisibilityHarness crewIds={['crew-a']} />);
    await flushEffects();

    expect(rendered.container.querySelector('[data-testid="hidden-crews"]')?.textContent).toBe('');
    getItem.mockRestore();

    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    act(() => {
      rendered.container.querySelector<HTMLButtonElement>('button')?.click();
    });

    expect(rendered.container.querySelector('[data-testid="hidden-crews"]')?.textContent).toBe('crew-a');
    rendered.unmount();
  });
});
