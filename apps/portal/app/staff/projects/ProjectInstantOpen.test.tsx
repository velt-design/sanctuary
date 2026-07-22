import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { useProjectInstantOpen } from './ProjectInstantOpen';
import ProjectInstantNavigationProvider from './ProjectInstantNavigation';

const replace = vi.fn();

vi.mock('./[projectId]/ProjectSnapshotPageClient', () => ({
  default: ({ projectId, tab }: { projectId: string; tab: string }) => (
    <div data-testid="optimistic-project" data-project-id={projectId} data-tab={tab} />
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ replace }),
}));

function InstantOpenHarness({ onOpened }: { onOpened?: () => void }) {
  const { openProject } = useProjectInstantOpen();
  return (
    <button
      type="button"
      onClick={() => {
        openProject('proj_1');
        onOpened?.();
      }}
    >
      Open project
    </button>
  );
}

function renderHarness() {
  return renderIntoDocument(
    <ProjectInstantNavigationProvider>
      <InstantOpenHarness />
    </ProjectInstantNavigationProvider>,
  );
}

describe('useProjectInstantOpen', () => {
  beforeEach(() => {
    replace.mockReset();
    window.history.replaceState(null, '', '/staff/projects');
  });

  it('updates history and shows the cached project client before the server route settles', () => {
    const rendered = renderHarness();

    act(() => {
      rendered.container.querySelector('button')?.click();
    });

    expect(window.location.pathname).toBe('/staff/projects/proj_1');
    expect(window.location.search).toBe('?tab=activity');
    expect(replace).toHaveBeenCalledWith('/staff/projects/proj_1', { scroll: false });
    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')?.getAttribute('data-project-id'))
      .toBe('proj_1');
    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')?.getAttribute('data-tab'))
      .toBe('activity');

    rendered.unmount();
  });

  it('clears the instant project when browser back returns to the projects list', () => {
    const rendered = renderHarness();
    act(() => rendered.container.querySelector('button')?.click());

    expect(rendered.container.textContent).not.toContain('Open project');

    window.history.replaceState(null, '', '/staff/projects');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));

    expect(rendered.container.textContent).toContain('Open project');
    rendered.unmount();
  });

  it('releases the instant project when the destination route children settle', () => {
    const rendered = renderHarness();
    act(() => rendered.container.querySelector('button')?.click());

    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).not.toBeNull();

    rendered.rerender(
      <ProjectInstantNavigationProvider>
        <div data-testid="settled-project">Settled project route</div>
      </ProjectInstantNavigationProvider>,
    );

    expect(rendered.container.querySelector('[data-testid="optimistic-project"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="settled-project"]')?.textContent)
      .toBe('Settled project route');
    rendered.unmount();
  });
});
