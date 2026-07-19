import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { useProjectInstantOpen } from './ProjectInstantOpen';

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) => {
    void loader;
    return ({ projectId, tab }: { projectId: string; tab: string }) => (
      <div data-testid="optimistic-project" data-project-id={projectId} data-tab={tab} />
    );
  },
}));

function InstantOpenHarness() {
  const { instantProject, openProject } = useProjectInstantOpen();
  return instantProject ?? <button type="button" onClick={() => openProject('proj_1')}>Open project</button>;
}

describe('useProjectInstantOpen', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/staff/projects');
  });

  it('updates history and shows the cached project client before the server route settles', () => {
    const rendered = renderIntoDocument(<InstantOpenHarness />);

    act(() => {
      rendered.container.querySelector('button')?.click();
    });

    expect(window.location.pathname).toBe('/staff/projects/proj_1');
    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')?.getAttribute('data-project-id'))
      .toBe('proj_1');
    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')?.getAttribute('data-tab'))
      .toBe('activity');

    rendered.unmount();
  });

  it('restores the projects list when browser back returns before the server handoff', () => {
    const rendered = renderIntoDocument(<InstantOpenHarness />);
    act(() => rendered.container.querySelector('button')?.click());

    window.history.replaceState(null, '', '/staff/projects');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));

    expect(rendered.container.textContent).toContain('Open project');
    rendered.unmount();
  });
});
