import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleClient from './ScheduleClient';
import { qk } from '@/lib/queries/keys';
import type { ScheduleV2Snapshot } from '@/lib/queries/schedule';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { assignJob } from '@/lib/repo/scheduleV2Repo';

const routerReplace = vi.fn();
const routerPush = vi.fn();
const scheduleSnapshotQueryOptions = vi.fn();
const transitionMocks = vi.hoisted(() => ({
  beginRouteTransition: vi.fn(),
}));
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));
const dndMocks = vi.hoisted(() => ({
  latestContextProps: null as any,
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: routerReplace,
    push: routerPush,
  }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({
    error: toastMocks.error,
    success: toastMocks.success,
    info: toastMocks.info,
  }),
}));

vi.mock('@/components/page-state/PortalRouteTransition', () => ({
  usePortalRouteTransition: () => ({
    beginRouteTransition: transitionMocks.beginRouteTransition,
  }),
}));

vi.mock('@dnd-kit/core', () => ({
  closestCenter: vi.fn(() => []),
  DndContext: (props: any) => {
    dndMocks.latestContextProps = props;
    return props.children;
  },
  DragOverlay: (props: any) => props.children,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  pointerWithin: vi.fn(() => []),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: (props: any) => props.children,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('@/lib/repo/installersRepo', () => ({ listInstallers: vi.fn() }));
vi.mock('@/lib/repo/projectsRepo', () => ({ getProject: vi.fn(), listProjects: vi.fn() }));
vi.mock('@/lib/repo/estimatesRepo', () => ({ listAllEstimates: vi.fn() }));
vi.mock('@/lib/repo/scheduleRepo', () => ({
  confirmScheduleItem: vi.fn(),
  deleteScheduleItem: vi.fn(),
  listScheduleItems: vi.fn(),
  normalizeScheduleItemsStarted: vi.fn(),
  replaceScheduleItems: vi.fn(),
  unlockScheduleItem: vi.fn(),
}));
vi.mock('@/lib/repo/scheduleV2Repo', () => ({
  ackClientUpdate: vi.fn(),
  assignJob: vi.fn(),
  createDowntime: vi.fn(),
  deleteDowntime: vi.fn(),
  fetchScheduleGantt: vi.fn(),
  lockJobSchedule: vi.fn(),
  markJobDone: vi.fn(),
  markJobInProgress: vi.fn(),
  pinJob: vi.fn(),
  reorderItems: vi.fn(),
  rescheduleJob: vi.fn(),
  setDaysRemaining: vi.fn(),
  setJobDuration: vi.fn(),
  unassignJob: vi.fn(),
  unpinJob: vi.fn(),
  updateDowntime: vi.fn(),
}));
vi.mock('@/lib/queries/schedule', () => ({
  scheduleV2SnapshotQueryOptions: (...args: unknown[]) => scheduleSnapshotQueryOptions(...args),
}));
vi.mock('@/lib/queries/scheduleDiagnostics', () => ({
  runScheduleDiagnostics: vi.fn(),
}));
vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
  supabaseHostFromUrl: () => 'example.supabase.co',
}));
vi.mock('@/lib/scheduling/scheduleClock', async () => {
  const actual = await vi.importActual<typeof import('@/lib/scheduling/scheduleClock')>('@/lib/scheduling/scheduleClock');
  return {
    ...actual,
    resolveScheduleTodayYmd: () => '2026-04-07',
  };
});

const initialSnapshot: ScheduleV2Snapshot = {
  generatedAt: '2026-04-07T00:00:00.000Z',
  installers: [
    {
      id: 'crew_alpha',
      name: 'Crew Alpha',
      color: '#0f766e',
      active: true,
      sortOrder: 0,
      calendarRegion: 'Auckland',
      baseAvailableDate: '2026-04-08',
    },
  ],
  projects: [
    {
      id: 'proj_alpha',
      projectName: 'Alpha Deck',
      name: 'Alpha Deck',
      status: 'DEPOSIT',
      nextActionDate: '2026-04-10',
      followUpDate: '2026-04-10',
    },
  ],
  scheduleItems: [],
  conflicts: [],
  nextAvailableByInstallerId: {
    crew_alpha: '2026-04-09',
  },
  unscheduledJobs: [
    {
      projectId: 'proj_alpha',
      estimateId: 'est_alpha',
      projectName: 'Alpha Deck',
      status: 'DEPOSIT',
      durationDays: 2,
    },
  ],
  holidays: [],
  closures: [],
};

const CREW_UUID = '00000000-0000-4000-8000-000000000001';
const ALPHA_PROJECT_UUID = '00000000-0000-4000-8000-000000000101';
const ALPHA_ESTIMATE_UUID = '00000000-0000-4000-8000-000000000201';
const BETA_PROJECT_UUID = '00000000-0000-4000-8000-000000000102';
const BETA_ESTIMATE_UUID = '00000000-0000-4000-8000-000000000202';
const SCHEDULE_ITEM_UUID = '00000000-0000-4000-8000-000000000301';
const SCHEDULED_JOB_UUID = '00000000-0000-4000-8000-000000000401';

const crewId = `crew_${CREW_UUID}`;
const alphaProjectId = `proj_${ALPHA_PROJECT_UUID}`;
const alphaEstimateId = `est_${ALPHA_ESTIMATE_UUID}`;
const betaProjectId = `proj_${BETA_PROJECT_UUID}`;
const betaEstimateId = `est_${BETA_ESTIMATE_UUID}`;
const betaJobId = `job_${betaProjectId}_${betaEstimateId}`;
const scheduleItemId = `sch_${SCHEDULE_ITEM_UUID}`;

function boardMutationSnapshot(): ScheduleV2Snapshot {
  return {
    generatedAt: '2026-04-07T00:00:00.000Z',
    installers: [
      {
        id: crewId,
        name: 'Crew Alpha',
        color: '#0f766e',
        active: true,
        sortOrder: 0,
        calendarRegion: 'Auckland',
        baseAvailableDate: '2026-04-08',
      },
    ],
    projects: [
      {
        id: alphaProjectId,
        projectName: 'Alpha Deck',
        name: 'Alpha Deck',
        status: 'DEPOSIT',
        nextActionDate: '2026-04-10',
        followUpDate: '2026-04-10',
      },
      {
        id: betaProjectId,
        projectName: 'Beta Deck',
        name: 'Beta Deck',
        status: 'DEPOSIT',
        nextActionDate: '2026-04-10',
        followUpDate: '2026-04-10',
      },
    ],
    scheduleItems: [
      {
        id: scheduleItemId,
        installerId: crewId,
        projectId: alphaProjectId,
        estimateId: alphaEstimateId,
        sortIndex: 0,
        scheduleStatus: 'TENTATIVE',
        locked: false,
        updatedAt: '2026-04-07T00:00:00.000Z',
        itemType: 'job',
        scheduledJobId: SCHEDULED_JOB_UUID,
        forecastStart: '2026-04-08',
        forecastEndExclusive: '2026-04-10',
        forecastDurationDays: 2,
        durationHoursOverride: 18,
        mode: 'floating',
        jobStatus: 'not_started',
        daysRemaining: null,
      },
    ],
    conflicts: [],
    nextAvailableByInstallerId: {
      [crewId]: '2026-04-10',
    },
    unscheduledJobs: [
      {
        projectId: betaProjectId,
        estimateId: betaEstimateId,
        projectName: 'Beta Deck',
        status: 'DEPOSIT',
        durationDays: 2,
      },
    ],
    holidays: [],
    closures: [],
  };
}

function renderSchedule(snapshot: ScheduleV2Snapshot) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const rendered = renderIntoDocument(
    <QueryClientProvider client={queryClient}>
      <ScheduleClient initialScheduleMode="v2" initialV2Snapshot={snapshot} />
    </QueryClientProvider>,
  );

  return { queryClient, rendered };
}

describe('ScheduleClient', () => {
  beforeEach(() => {
    routerReplace.mockReset();
    routerPush.mockReset();
    transitionMocks.beginRouteTransition.mockReset();
    toastMocks.error.mockReset();
    toastMocks.success.mockReset();
    toastMocks.info.mockReset();
    dndMocks.latestContextProps = null;
    vi.mocked(assignJob).mockReset();
    scheduleSnapshotQueryOptions.mockReset();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: async () => initialSnapshot,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders immediately from the seeded v2 snapshot and passes it into the query cache as initial data', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const rendered = renderIntoDocument(
      <QueryClientProvider client={queryClient}>
        <ScheduleClient initialScheduleMode="v2" initialV2Snapshot={initialSnapshot} />
      </QueryClientProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain('Schedule');
    expect(rendered.container.textContent).toContain('Unscheduled');
    expect(rendered.container.textContent).not.toContain('Loading schedule data from the portal database…');
    expect(
      rendered.container.querySelector('button[aria-label="Collapse unscheduled panel"], button[aria-label="Expand unscheduled panel"]'),
    ).not.toBeNull();
    expect(queryClient.getQueryData(qk.schedule.board('example.supabase.co', '2026-04-07'))).toEqual(initialSnapshot);

    rendered.unmount();
  });

  it('starts the portal loading transition before switching schedule views', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const rendered = renderIntoDocument(
      <QueryClientProvider client={queryClient}>
        <ScheduleClient initialScheduleMode="v2" initialV2Snapshot={initialSnapshot} />
      </QueryClientProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const ganttButton = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Gantt',
    ) as HTMLButtonElement | undefined;

    expect(ganttButton).toBeTruthy();

    act(() => {
      ganttButton?.click();
    });

    expect(transitionMocks.beginRouteTransition).toHaveBeenCalledWith({
      href: '/staff/schedule?view=gantt',
      label: 'Gantt',
      source: 'schedule-view',
      show: 'immediate',
    });
    expect(routerReplace).toHaveBeenCalledWith('/staff/schedule?view=gantt');

    rendered.unmount();
  });

  it('calls assignJob with the resolved end-of-lane position for a successful unscheduled drop', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: async () => snapshot,
    }));
    vi.mocked(assignJob).mockResolvedValue({ ok: true } as any);

    const { rendered } = renderSchedule(snapshot);

    await act(async () => {
      await Promise.resolve();
    });

    expect(dndMocks.latestContextProps).toBeTruthy();

    act(() => {
      dndMocks.latestContextProps.onDragStart({ active: { id: betaJobId }, activatorEvent: new Event('pointerdown') });
      dndMocks.latestContextProps.onDragEnd({
        active: { id: betaJobId, rect: { current: {} } },
        over: { id: `lane:${crewId}` },
        collisions: null,
        delta: { x: 0, y: 0 },
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(assignJob).toHaveBeenCalledWith({
      job_id: BETA_PROJECT_UUID,
      crew_id: CREW_UUID,
      position: 1,
      force: true,
      today: '2026-04-07',
    });

    rendered.unmount();
  });

  it('rolls back an optimistic unscheduled assignment when assignJob fails', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: async () => snapshot,
    }));
    vi.mocked(assignJob).mockRejectedValue(new Error('assign failed'));

    const { rendered } = renderSchedule(snapshot);

    await act(async () => {
      await Promise.resolve();
    });

    const unscheduledBefore = rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]');
    expect(unscheduledBefore?.textContent).toContain('Beta Deck');

    act(() => {
      dndMocks.latestContextProps.onDragStart({ active: { id: betaJobId }, activatorEvent: new Event('pointerdown') });
      dndMocks.latestContextProps.onDragEnd({
        active: { id: betaJobId, rect: { current: {} } },
        over: { id: `lane:${crewId}` },
        collisions: null,
        delta: { x: 0, y: 0 },
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();
    });

    const unscheduledAfter = rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]');
    expect(unscheduledAfter?.textContent).toContain('Beta Deck');
    expect(toastMocks.error).toHaveBeenCalledWith('Failed to schedule job.');

    rendered.unmount();
  });
});
