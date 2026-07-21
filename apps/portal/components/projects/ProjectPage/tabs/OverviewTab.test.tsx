import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { ApiError } from '@/lib/repo/apiClient';

const useQueryMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  queryOptions: (options: unknown) => options,
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock('../ProjectTasksSidebar.client', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <section data-testid="mock-tasks-panel" data-project-id={projectId}>Tasks</section>
  ),
}));

vi.mock('./_components/ProjectNotesPanel.client', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <section data-testid="mock-notes-panel" data-project-id={projectId}>Project notes</section>
  ),
}));

vi.mock('./overview/ProjectCurrentDesignCommercialCard', () => ({
  default: ({ data }: { data: { source: string } }) => (
    <section data-testid="mock-current-design" data-source={data.source}>Current design</section>
  ),
}));

vi.mock('./overview/ProjectPrimaryActionCard', () => ({
  default: () => <section data-testid="mock-primary-action">Primary action</section>,
}));

vi.mock('./overview/ProjectStatusDetailsCard', () => ({
  default: ({ project }: { project: { contactName?: string } }) => (
    <section data-testid="mock-status-details">{project.contactName}</section>
  ),
}));

import OverviewTab from './OverviewTab';

const snapshot = {
  project: {
    id: 'proj_1',
    name: 'Test project',
    stage: 'lead',
    contactName: 'Aroha Smith',
    contactEmail: 'aroha@example.test',
    siteAddress: '1 Test Lane',
    quoteRef: 'Q-0100',
  },
  pipeline: { stage: 'lead' },
  tasks: { stage: 'lead', items: [] },
  activity: [],
  emails: [],
  notes: [],
} as any;

function queryState(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('OverviewTab', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    useQueryMock.mockReset();
    await Promise.all([
      import('./overview/ProjectCurrentDesignCommercialCard'),
      import('./overview/ProjectPrimaryActionCard'),
      import('./overview/ProjectStatusDetailsCard'),
    ]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders status/details, commercial, primary action, activity, and tasks after fresh reads', async () => {
    useQueryMock.mockReturnValue(queryState({
      data: { currentDesign: { source: 'estimate' } },
    }));
    const rendered = renderIntoDocument(
      <OverviewTab snapshot={snapshot} snapshotContentReady snapshotState="fresh" host="host" />,
    );
    await act(async () => { await Promise.resolve(); });
    expect(rendered.container.querySelector('[data-testid="mock-current-design"]')?.getAttribute('data-source')).toBe('estimate');
    expect(rendered.container.querySelector('[data-testid="mock-status-details"]')?.textContent).toContain('Aroha Smith');
    expect(rendered.container.querySelector('[data-testid="mock-primary-action"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-stage3-workstreams-slot]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-notes-panel"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-tasks-panel"]')).not.toBeNull();
    rendered.unmount();
  });

  it('keeps pending commercial and snapshot-owned context truthful', () => {
    useQueryMock.mockReturnValue(queryState({ isPending: true }));
    const rendered = renderIntoDocument(
      <OverviewTab snapshot={snapshot} snapshotContentReady={false} snapshotState="summary" host="host" />,
    );
    expect(rendered.container.querySelector('[data-command-centre-state="pending"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Updating activity and tasks in the background');
    expect(rendered.container.textContent).not.toContain('No current design');
    expect(rendered.container.querySelector('[data-testid="mock-notes-panel"]')).toBeNull();
    rendered.unmount();
  });

  it('retains cached commercial data and exposes Retry after a refresh failure', async () => {
    const refetch = vi.fn();
    useQueryMock.mockReturnValue(queryState({
      data: { currentDesign: { source: 'sent_quote' } },
      error: new Error('offline'),
      isError: true,
      refetch,
    }));
    const rendered = renderIntoDocument(
      <OverviewTab snapshot={snapshot} snapshotContentReady snapshotState="fresh" host="host" />,
    );
    await act(async () => { await Promise.resolve(); });
    expect(rendered.container.querySelector('[data-command-centre-state="stale"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-current-design"]')).not.toBeNull();
    act(() => {
      (Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Retry'))?.click();
    });
    expect(refetch).toHaveBeenCalledOnce();
    rendered.unmount();
  });

  it('keeps cached commercial data visible during a background refresh', async () => {
    useQueryMock.mockReturnValue(queryState({
      data: { currentDesign: { source: 'draft_quote' } },
      isFetching: true,
    }));
    const rendered = renderIntoDocument(
      <OverviewTab snapshot={snapshot} snapshotContentReady snapshotState="fresh" host="host" />,
    );
    await act(async () => { await Promise.resolve(); });
    expect(rendered.container.querySelector('[data-command-centre-state="refreshing"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-current-design"]')).not.toBeNull();
    rendered.unmount();
  });

  it('shows a retryable failure without inventing an empty state on the initial read', () => {
    const refetch = vi.fn();
    useQueryMock.mockReturnValue(queryState({
      error: new Error('offline'),
      isError: true,
      refetch,
    }));
    const rendered = renderIntoDocument(
      <OverviewTab snapshot={snapshot} snapshotContentReady snapshotState="fresh" host="host" />,
    );
    expect(rendered.container.querySelector('[data-command-centre-state="failed"]')).not.toBeNull();
    expect(rendered.container.textContent).not.toContain('No current design');
    act(() => {
      (rendered.container.querySelector('button') as HTMLButtonElement).click();
    });
    expect(refetch).toHaveBeenCalledOnce();
    rendered.unmount();
  });

  it('reports access-ending errors to the page boundary and never renders cached state', () => {
    const onAccessEnding = vi.fn();
    useQueryMock.mockReturnValue(queryState({
      data: { currentDesign: { source: 'accepted_quote' } },
      error: new ApiError('Forbidden', { status: 403, body: null }),
      isError: true,
    }));
    const rendered = renderIntoDocument(
      <OverviewTab
        snapshot={snapshot}
        snapshotContentReady
        snapshotState="fresh"
        host="host"
        onAccessEnding={onAccessEnding}
      />,
    );
    expect(onAccessEnding).toHaveBeenCalledWith(403);
    expect(rendered.container.querySelector('[data-command-centre-state="unavailable"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-current-design"]')).toBeNull();
    rendered.unmount();
  });
});
