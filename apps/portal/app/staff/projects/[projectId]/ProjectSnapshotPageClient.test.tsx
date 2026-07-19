import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { ApiError } from '@/lib/repo/apiClient';
import ProjectSnapshotPageClient from './ProjectSnapshotPageClient';

const useQueryMock = vi.fn();
const placeholderMock = vi.fn();
const refetchMock = vi.fn();

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => useQueryMock(...args),
    useQueryClient: () => ({ getQueryData: vi.fn() }),
  };
});

vi.mock('@/lib/queries/projectCache', () => ({
  getProjectSnapshotPlaceholderFromCaches: (...args: unknown[]) => placeholderMock(...args),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://host.supabase.co',
}));

vi.mock('@/components/projects/ProjectPage/ProjectPageFrame', () => ({
  default: ({ snapshot, snapshotContentReady, snapshotState }: any) => (
    <div
      data-testid="project-frame"
      data-content-ready={String(snapshotContentReady)}
      data-snapshot-state={snapshotState}
    >
      {snapshot.project.name}
    </div>
  ),
}));

vi.mock('@/components/debug/PortalDebugExportButton', () => ({
  default: () => <button data-testid="debug-export">Debug export</button>,
}));

const fullSnapshot = {
  project: { id: 'proj_1', name: 'Fresh Project', stage: 'lead' },
  pipeline: { stage: 'lead' },
  tasks: { stage: 'lead', items: [] },
  activity: [],
  emails: [],
  notes: [],
} as any;

const summaryResponse = {
  snapshot: {
    ...fullSnapshot,
    project: { ...fullSnapshot.project, name: 'Cached Project' },
  },
  generatedAt: '2026-07-19T00:00:00.000Z',
};

function renderClient() {
  return renderIntoDocument(
    <ProjectSnapshotPageClient
      projectId="proj_1"
      tab="estimates"
      estimateId={null}
      debugExportEnabled
    />,
  );
}

describe('ProjectSnapshotPageClient', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    placeholderMock.mockReset();
    refetchMock.mockReset();
    placeholderMock.mockReturnValue(summaryResponse);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens immediately from the cached project summary while fresh data loads', () => {
    useQueryMock.mockReturnValue({
      data: summaryResponse,
      error: null,
      isPlaceholderData: true,
      refetch: refetchMock,
    });

    const rendered = renderClient();

    expect(rendered.container.querySelector('[data-project-shell-ready="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-snapshot-state="summary"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Cached Project');
    expect(rendered.container.textContent).toContain('Updating project');
    expect(rendered.container.querySelector('[data-content-ready="false"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="debug-export"]')).toBeNull();

    rendered.unmount();
  });

  it('marks the background work complete only for a full snapshot', () => {
    useQueryMock.mockReturnValue({
      data: { snapshot: fullSnapshot, generatedAt: '2026-07-19T00:00:01.000Z' },
      error: null,
      isPlaceholderData: false,
      refetch: refetchMock,
    });

    const rendered = renderClient();

    expect(rendered.container.querySelector('[data-project-background-ready="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-content-ready="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="debug-export"]')).not.toBeNull();

    rendered.unmount();
  });

  it('keeps known summary data visible after a refresh failure and offers retry', () => {
    useQueryMock.mockReturnValue({
      data: summaryResponse,
      error: new ApiError('Failed', { status: 500, body: null }),
      isPlaceholderData: true,
      refetch: refetchMock,
    });

    const rendered = renderClient();
    const retry = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Retry',
    );

    expect(rendered.container.querySelector('[data-project-snapshot-state="refresh-failed"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Cached Project');
    act(() => retry?.click());
    expect(refetchMock).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });

  it('keeps the cached summary visible when the browser is offline', () => {
    useQueryMock.mockReturnValue({
      data: summaryResponse,
      error: new TypeError('Failed to fetch'),
      isPlaceholderData: true,
      refetch: refetchMock,
    });

    const rendered = renderClient();

    expect(rendered.container.querySelector('[data-project-snapshot-state="refresh-failed"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Cached Project');
    expect(rendered.container.textContent).toContain('last known details');

    rendered.unmount();
  });

  it.each([401, 403, 404])('hides cached project data after an access-ending %s response', (status) => {
    useQueryMock.mockReturnValue({
      data: summaryResponse,
      error: new ApiError('Unavailable', { status, body: null }),
      isPlaceholderData: true,
      refetch: refetchMock,
    });

    const rendered = renderClient();

    expect(rendered.container.querySelector('[data-project-snapshot-state="unavailable"]')).not.toBeNull();
    expect(rendered.container.textContent).not.toContain('Cached Project');
    expect(rendered.container.querySelector('[data-testid="debug-export"]')).toBeNull();

    rendered.unmount();
  });

  it('uses a non-blocking pending shell for a direct link without cache', () => {
    placeholderMock.mockReturnValue(undefined);
    useQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isPlaceholderData: false,
      refetch: refetchMock,
    });

    const rendered = renderClient();

    expect(rendered.container.querySelector('[data-project-snapshot-state="pending"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Opening project');
    expect(rendered.container.textContent).not.toContain('Project unavailable');

    rendered.unmount();
  });
});
