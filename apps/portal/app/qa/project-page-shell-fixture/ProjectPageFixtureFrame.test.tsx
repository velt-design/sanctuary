import { renderIntoDocument } from '../../../../../test/reactHarness';
import { afterEach, expect, it, vi } from 'vitest';
import type { ComponentProps, ReactNode } from 'react';
import ProjectPageFixtureFrame from './ProjectPageFixtureFrame';

const mocks = vi.hoisted(() => ({ state: null as string | null, frame: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mocks.state === null ? '' : { snapshotState: mocks.state }) }));
vi.mock('@/components/projects/ProjectPage/ProjectPageFrame', () => ({ default: (props: unknown) => { mocks.frame(props); return null; } }));
vi.mock('@/components/projects/ProjectPage/useProjectTabSelection', () => ({ useProjectTabSelection: () => ({ activeTab: 'activity', optimisticTab: null, selectTab: vi.fn() }) }));
vi.mock('@/components/projects/ProjectPage/ProjectOverviewReads', () => ({
  useProjectOverviewReads: () => ({}),
  ProjectOverviewReadsProvider: ({ children }: { children: ReactNode }) => children,
}));

afterEach(() => { document.body.innerHTML = ''; mocks.frame.mockClear(); mocks.state = null; });
const base = { snapshot: { project: { id: 'proj_fixture', hasJobPacks: false } }, host: 'fixture', tab: 'activity' } as ComponentProps<typeof ProjectPageFixtureFrame>;

it.each([null, 'invalid'])('preserves default and explicit readiness without a valid override (%s)', (query) => {
  mocks.state = query;
  const { rerender } = renderIntoDocument(<ProjectPageFixtureFrame {...base} />);
  expect(mocks.frame.mock.lastCall?.[0]).toMatchObject({ snapshotState: undefined, snapshotContentReady: undefined });
  rerender(<ProjectPageFixtureFrame {...base} snapshotState="refresh-failed" snapshotContentReady={true} statusPanel="Caller notice" />);
  expect(mocks.frame.mock.lastCall?.[0]).toMatchObject({ snapshotState: 'refresh-failed', snapshotContentReady: true, statusPanel: 'Caller notice' });
});

it.each(['summary', 'refresh-failed', 'fresh'] as const)('uses explicit %s geometry state without changing ordinary fixture defaults', (state) => {
  mocks.state = state;
  renderIntoDocument(<ProjectPageFixtureFrame {...base} snapshotContentReady={state !== 'fresh'} />);
  expect(mocks.frame.mock.lastCall?.[0]).toMatchObject({ snapshotState: state, snapshotContentReady: state === 'fresh' });
  expect(mocks.frame.mock.lastCall?.[0].statusPanel.props.state).toBe(state);
});
