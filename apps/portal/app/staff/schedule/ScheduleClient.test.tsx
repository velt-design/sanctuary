import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleClient from './ScheduleClient';
import { qk } from '@/lib/queries/keys';
import type { ScheduleV2Snapshot } from '@/lib/queries/schedule';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { assignJob, fetchScheduleGantt } from '@/lib/repo/scheduleV2Repo';
import { ApiError } from '@/lib/repo/apiClient';

const routerReplace = vi.fn();
const routerPush = vi.fn();
const scheduleSnapshotQueryOptions = vi.fn();
const scheduleSnapshotQueryFn = vi.fn();
const scheduleGanttSnapshotQueryOptions = vi.fn();
const scheduleGanttSnapshotQueryFn = vi.fn();
let searchParamsString = '';
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
  activeId: null as string | null,
}));
const sendBeaconMock = vi.fn();

class TestBeaconBlob {
  readonly type: string;
  private readonly value: string;

  constructor(parts: Array<string>, options?: { type?: string }) {
    this.value = parts.join('');
    this.type = options?.type ?? '';
  }

  async text() {
    return this.value;
  }
}

vi.mock('next/dynamic', () => ({
  default: () => (props: any) => {
    if (props?.initialReason) {
      return (
        <div data-testid="legacy-schedule-fallback" data-reason={props.initialReason}>
          Legacy schedule fallback
        </div>
      );
    }
    if (typeof props?.onDrop === 'function') {
      dndMocks.latestContextProps = {
        onDragStart: (event: any) => {
          dndMocks.activeId = String(event.active.id);
        },
        onDragEnd: (event: any) => {
          const activeId = String(event.active.id ?? dndMocks.activeId);
          const overId = event.over ? String(event.over.id) : null;
          if (overId === 'unscheduled') {
            props.onDrop(activeId, { kind: 'unscheduled', overId: 'unscheduled' });
            return;
          }
          const laneId = overId?.startsWith('lane:') ? overId.slice('lane:'.length) : props.installers?.[0]?.id;
          if (!laneId) return;
          const existing = props.laneItems?.get(laneId) ?? [];
          const debug = {
            activeId,
            rawOverId: overId,
            sourceLaneId: props.scheduleItemById?.get(activeId)?.installerId ?? null,
            resolvedKind: 'lane',
            resolvedLaneId: laneId,
            insertionIndex: existing.length,
            placement: 'end',
            resolvedOverId: `lane:${laneId}`,
            point: null,
            activeRect: null,
            targetLaneRect: null,
            unscheduledRect: null,
            laneItemCounts: Object.fromEntries((props.installers ?? []).map((installer: { id: string }) => [installer.id, props.laneItems?.get(installer.id)?.length ?? 0])),
          };
          props.onDrop(activeId, {
            kind: 'lane',
            laneId,
            insertionIndex: existing.length,
            placement: 'end',
            overId: `lane:${laneId}`,
            debug,
          });
        },
      };
      return (
        <div>
          <aside aria-label="Unscheduled jobs">
            <h2>Unscheduled</h2>
            <button
              type="button"
              aria-label={props.unscheduledCollapsed ? 'Expand unscheduled panel' : 'Collapse unscheduled panel'}
            />
            {props.unscheduledJobs?.map((job: { id: string; projectName: string }) => (
              <div key={job.id}>{job.projectName}</div>
            ))}
          </aside>
          <section aria-label="Installer lanes">
            {props.installers?.map((installer: { id: string; name: string }) => (
              <div key={installer.id}>
                <div>{installer.name}</div>
                {(props.laneItems?.get(installer.id) ?? []).map((item: { id: string }) => {
                  const job = props.schedulable?.jobsById?.get(item.id);
                  return <div key={item.id}>{job?.projectName ?? item.id}</div>;
                })}
              </div>
            ))}
          </section>
        </div>
      );
    }
    if (!Array.isArray(props?.holidays)) return null;
    const labelFor = (holiday: { date: string; name?: string }) => {
      const [, month, day] = holiday.date.split('-');
      const monthLabel = month === '04' ? 'Apr' : month;
      return `${holiday.name ?? 'Public holiday'} (${Number(day)} ${monthLabel})`;
    };
    return (
      <div>
        <span>Gantt</span>
        {props.holidays.map((holiday: { date: string; name?: string }) => (
          <div key={holiday.date} aria-label={labelFor(holiday)} />
        ))}
      </div>
    );
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: routerReplace,
    push: routerPush,
  }),
  useSearchParams: () => new URLSearchParams(searchParamsString),
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
  scheduleGanttV2SnapshotQueryOptions: (...args: unknown[]) => scheduleGanttSnapshotQueryOptions(...args),
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
  generatedAt: new Date().toISOString(),
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
const BETA_SCHEDULE_ITEM_UUID = '00000000-0000-4000-8000-000000000302';
const SCHEDULED_JOB_UUID = '00000000-0000-4000-8000-000000000401';
const BETA_SCHEDULED_JOB_UUID = '00000000-0000-4000-8000-000000000402';

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

async function scheduleTelemetryPayloads() {
  return Promise.all(
    sendBeaconMock.mock.calls
      .filter((call) => call[0] === '/api/staff/v1/schedule/telemetry')
      .map(async (call) => {
        const body = call[1];
        if (body instanceof Blob) return JSON.parse(await body.text());
        if (typeof body === 'string') return JSON.parse(body);
        return body;
      }),
  );
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
    dndMocks.activeId = null;
    vi.mocked(assignJob).mockReset();
    vi.mocked(fetchScheduleGantt).mockReset();
    searchParamsString = '';
    scheduleSnapshotQueryFn.mockReset();
    scheduleSnapshotQueryOptions.mockReset();
    scheduleGanttSnapshotQueryFn.mockReset();
    scheduleGanttSnapshotQueryOptions.mockReset();
    sendBeaconMock.mockReset();
    sendBeaconMock.mockReturnValue(true);
    vi.stubGlobal('Blob', TestBeaconBlob);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeaconMock,
    });
    window.localStorage.removeItem('sp_schedule_debug');
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(initialSnapshot),
      staleTime: 30_000,
    }));
    scheduleGanttSnapshotQueryOptions.mockImplementation((host: string, today: string, range: { rangeStart: string; rangeEnd: string }) => ({
      queryKey: qk.schedule.gantt(host, range.rangeStart, range.rangeEnd, today),
      queryFn: scheduleGanttSnapshotQueryFn.mockResolvedValue({ ...initialSnapshot, unscheduledJobs: [] }),
      staleTime: 30_000,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.removeItem('sp_schedule_debug');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    expect(scheduleSnapshotQueryFn).not.toHaveBeenCalled();
    expect(scheduleGanttSnapshotQueryFn).not.toHaveBeenCalled();
    await expect(scheduleTelemetryPayloads()).resolves.toEqual([
      expect.objectContaining({
        event: 'schedule_hydrated',
        view: 'board',
        counts: expect.objectContaining({
          installers: 1,
          projects: 1,
          scheduleItems: 0,
          unscheduledJobs: 1,
        }),
        meta: expect.objectContaining({ source: 'server_seed' }),
      }),
    ]);

    rendered.unmount();
  });

  it('renders the lazy legacy fallback when the server seed reports schema-not-ready', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const rendered = renderIntoDocument(
      <QueryClientProvider client={queryClient}>
        <ScheduleClient initialScheduleMode="legacy" initialV2Snapshot={null} />
      </QueryClientProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const fallback = rendered.container.querySelector('[data-testid="legacy-schedule-fallback"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.getAttribute('data-reason')).toBe('server-schema-not-ready');
    expect(scheduleSnapshotQueryFn).not.toHaveBeenCalled();
    await expect(scheduleTelemetryPayloads()).resolves.toEqual([
      expect.objectContaining({
        event: 'fallback_activated',
        view: 'board',
        reason: 'server-schema-not-ready',
      }),
    ]);

    rendered.unmount();
  });

  it('reports a duplicate Board fetch when the initial server seed is immediately refetched', async () => {
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(initialSnapshot),
      staleTime: 0,
    }));
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
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });

    await expect(scheduleTelemetryPayloads()).resolves.toContainEqual(expect.objectContaining({
      event: 'duplicate_initial_fetch',
      view: 'board',
      counts: expect.objectContaining({ fetchCount: 1 }),
    }));
    expect(scheduleSnapshotQueryFn).toHaveBeenCalled();

    rendered.unmount();
  });

  it('switches to the lazy legacy fallback when a v2 refresh reports schema-not-ready', async () => {
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockRejectedValue(
        new ApiError('Schedule v2 schema not ready yet.', {
          status: 501,
          body: { error: 'Schedule v2 schema not ready yet.' },
          requestId: 'req_schema_501',
        }),
      ),
      staleTime: 30_000,
    }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const rendered = renderIntoDocument(
      <QueryClientProvider client={queryClient}>
        <ScheduleClient initialScheduleMode="v2" initialV2Snapshot={null} />
      </QueryClientProvider>,
    );

    await act(async () => {
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const fallback = rendered.container.querySelector('[data-testid="legacy-schedule-fallback"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.getAttribute('data-reason')).toBe('client-schema-not-ready');
    expect(toastMocks.error).toHaveBeenCalledWith('Schedule v2 schema not ready yet.');
    await expect(scheduleTelemetryPayloads()).resolves.toContainEqual(expect.objectContaining({
      event: 'fallback_activated',
      view: 'board',
      reason: 'client-schema-not-ready',
      requestId: 'req_schema_501',
      meta: expect.objectContaining({ status: 501 }),
    }));

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
      control: ganttButton,
    });
    expect(routerReplace).toHaveBeenCalledWith('/staff/schedule?view=gantt');
    expect(fetchScheduleGantt).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('renders seeded Gantt without calling the Gantt recompute endpoint', async () => {
    searchParamsString = 'view=gantt';
    const snapshot: ScheduleV2Snapshot = {
      ...initialSnapshot,
      holidays: [
        { date: '2026-04-10', name: 'Regional Day', scope: 'regional', region: 'Auckland' },
        { date: '2026-04-13', name: 'National Day', scope: 'national', region: null },
        { date: '2026-04-14', name: 'Other Region', scope: 'regional', region: 'Wellington' },
      ],
    };
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const rendered = renderIntoDocument(
      <QueryClientProvider client={queryClient}>
        <ScheduleClient initialScheduleMode="v2" initialSeedKind="gantt" initialV2Snapshot={snapshot} />
      </QueryClientProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchScheduleGantt).not.toHaveBeenCalled();
    expect(scheduleSnapshotQueryFn).not.toHaveBeenCalled();
    expect(scheduleGanttSnapshotQueryFn).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(qk.schedule.board('example.supabase.co', '2026-04-07'))).toBeUndefined();
    expect(queryClient.getQueryData(qk.schedule.gantt('example.supabase.co', '2026-04-06', '2026-06-28', '2026-04-07'))).toEqual(snapshot);
    expect(rendered.container.textContent).toContain('Gantt');
    expect(rendered.container.querySelector('[aria-label="Regional Day (10 Apr)"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="National Day (13 Apr)"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Other Region (14 Apr)"]')).toBeNull();
    await expect(scheduleTelemetryPayloads()).resolves.toEqual([
      expect.objectContaining({
        event: 'schedule_hydrated',
        view: 'gantt',
        counts: expect.objectContaining({
          installers: 1,
          projects: 1,
          scheduleItems: 0,
          unscheduledJobs: 1,
        }),
        meta: expect.objectContaining({ source: 'server_seed' }),
      }),
    ]);

    rendered.unmount();
  });

  it('uses the Gantt query for direct Gantt navigation without seeding the Board cache', async () => {
    searchParamsString = 'view=gantt';
    const refreshedSnapshot: ScheduleV2Snapshot = {
      ...initialSnapshot,
      unscheduledJobs: [],
      holidays: [{ date: '2026-04-10', name: 'Query Holiday', scope: 'national', region: null }],
    };
    scheduleGanttSnapshotQueryOptions.mockImplementation((host: string, today: string, range: { rangeStart: string; rangeEnd: string }) => ({
      queryKey: qk.schedule.gantt(host, range.rangeStart, range.rangeEnd, today),
      queryFn: scheduleGanttSnapshotQueryFn.mockResolvedValue(refreshedSnapshot),
      staleTime: 30_000,
    }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const rendered = renderIntoDocument(
      <QueryClientProvider client={queryClient}>
        <ScheduleClient initialScheduleMode="v2" />
      </QueryClientProvider>,
    );

    await act(async () => {
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(scheduleSnapshotQueryFn).not.toHaveBeenCalled();
    expect(scheduleGanttSnapshotQueryFn).toHaveBeenCalled();
    expect(fetchScheduleGantt).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(qk.schedule.board('example.supabase.co', '2026-04-07'))).toBeUndefined();
    expect(queryClient.getQueryData(qk.schedule.gantt('example.supabase.co', '2026-04-06', '2026-06-28', '2026-04-07'))).toEqual(refreshedSnapshot);

    rendered.unmount();
  });

  it('does not render stale Board data while fetching Board after starting from a Gantt-only seed', async () => {
    searchParamsString = 'view=gantt';
    const ganttSeed: ScheduleV2Snapshot = {
      ...initialSnapshot,
      unscheduledJobs: [],
    };
    const boardSnapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(boardSnapshot),
      staleTime: 30_000,
    }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const rendered = renderIntoDocument(
      <QueryClientProvider client={queryClient}>
        <ScheduleClient initialScheduleMode="v2" initialSeedKind="gantt" initialV2Snapshot={ganttSeed} />
      </QueryClientProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const boardButton = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Board',
    ) as HTMLButtonElement | undefined;

    act(() => {
      boardButton?.click();
    });

    expect(rendered.container.textContent).toContain('Loading schedule data from the portal database…');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(scheduleSnapshotQueryFn).toHaveBeenCalled();
    expect(queryClient.getQueryData(qk.schedule.board('example.supabase.co', '2026-04-07'))).toEqual(boardSnapshot);
    expect(rendered.container.textContent).toContain('Loading schedule data from the portal database…');
    expect(rendered.container.textContent).not.toContain('Alpha Deck');

    rendered.unmount();
  });

  it('calls assignJob with the resolved end-of-lane position for a successful unscheduled drop', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
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
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
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

  it('shows a specific API error and rolls back when unscheduled assignment returns 409', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(assignJob).mockRejectedValue(
      new ApiError('Job is already scheduled in this crew. Refresh the board.', {
        status: 409,
        body: { error: 'Job is already scheduled in this crew. Refresh the board.' },
        requestId: 'req_assign_409',
      }),
    );

    const { rendered } = renderSchedule(snapshot);

    await act(async () => {
      await Promise.resolve();
    });

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
    expect(toastMocks.error).toHaveBeenCalledWith('Job is already scheduled in this crew. Refresh the board.');

    rendered.unmount();
  });

  it('shows a request reference and rolls back when unscheduled assignment returns 500', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem('sp_schedule_debug', '1');
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(assignJob).mockRejectedValue(
      new ApiError('Failed to assign scheduled job', {
        status: 500,
        body: { error: 'Failed to assign scheduled job' },
        requestId: 'req_assign_500',
      }),
    );

    const { rendered } = renderSchedule(snapshot);

    await act(async () => {
      await Promise.resolve();
    });

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
    expect(toastMocks.error).toHaveBeenCalledWith('Failed to schedule job. Reference: req_assign_500.');
    const scheduleDebugPayloads = debugSpy.mock.calls
      .filter((call) => call[0] === '[schedule]')
      .map((call) => call[1] as { event?: string; [key: string]: unknown });
    expect(scheduleDebugPayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'board.assign.attempt',
          activeId: betaJobId,
          activeType: 'unscheduled',
          projectUuid: BETA_PROJECT_UUID,
          crewUuid: CREW_UUID,
          position: 1,
          drop: expect.objectContaining({
            rawOverId: `lane:${crewId}`,
            resolvedLaneId: crewId,
            insertionIndex: 1,
          }),
        }),
        expect.objectContaining({
          event: 'board.assign.failure',
          activeId: betaJobId,
          projectUuid: BETA_PROJECT_UUID,
          crewUuid: CREW_UUID,
          position: 1,
          error: expect.objectContaining({
            status: 500,
            requestId: 'req_assign_500',
            message: 'Failed to assign scheduled job',
          }),
        }),
      ]),
    );

    rendered.unmount();
  });

  it('shows assign diagnostics and rolls back when unscheduled assignment returns 500', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(assignJob).mockRejectedValue(
      new ApiError('Failed to assign scheduled job', {
        status: 500,
        body: {
          error: 'Failed to assign scheduled job',
          diagnostic: {
            phase: 'commit_rpc',
            errorCode: 'P0001',
            errorMessage: 'failed to update every scheduled job forecast',
          },
        },
        requestId: 'req_assign_diag_500',
      }),
    );

    const { rendered } = renderSchedule(snapshot);

    await act(async () => {
      await Promise.resolve();
    });

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
    expect(toastMocks.error).toHaveBeenCalledWith(
      'Failed to schedule job. P0001: failed to update every scheduled job forecast. Reference: req_assign_diag_500.',
    );

    rendered.unmount();
  });

  it('keeps a repaired successful assignment on the board and writes the returned schedule to cache', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(assignJob).mockResolvedValue({
      ok: true,
      crew_id: CREW_UUID,
      schedule: {
        crew_id: CREW_UUID,
        items: [
          {
            id: SCHEDULE_ITEM_UUID,
            item_type: 'job',
            position: 0,
            start: '2026-04-08',
            end_exclusive: '2026-04-10',
            duration_days: 2,
            job: {
              id: SCHEDULED_JOB_UUID,
              job_id: ALPHA_PROJECT_UUID,
              crew_id: CREW_UUID,
              mode: 'floating',
              planned_commitment_type: null,
              planned_week_start: null,
              planned_start: null,
              planned_duration_days: null,
              planned_flex_days: null,
              forecast_start: '2026-04-08',
              forecast_end_exclusive: '2026-04-10',
              forecast_duration_days: 2,
              actual_start: null,
              actual_finish: null,
              status: 'not_started',
              days_remaining: null,
            },
            downtime: null,
          },
          {
            id: BETA_SCHEDULE_ITEM_UUID,
            item_type: 'job',
            position: 1,
            start: '2026-04-10',
            end_exclusive: '2026-04-14',
            duration_days: 2,
            job: {
              id: BETA_SCHEDULED_JOB_UUID,
              job_id: BETA_PROJECT_UUID,
              crew_id: CREW_UUID,
              mode: 'floating',
              planned_commitment_type: null,
              planned_week_start: null,
              planned_start: null,
              planned_duration_days: null,
              planned_flex_days: null,
              forecast_start: '2026-04-10',
              forecast_end_exclusive: '2026-04-14',
              forecast_duration_days: 2,
              actual_start: null,
              actual_finish: null,
              status: 'not_started',
              days_remaining: null,
            },
            downtime: null,
          },
        ],
        conflicts: [],
        next_available_date: '2026-04-14',
      },
      conflicts: [],
      next_available_date: '2026-04-14',
    } as any);

    const { queryClient, rendered } = renderSchedule(snapshot);

    await act(async () => {
      await Promise.resolve();
    });

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

    const cached = queryClient.getQueryData<ScheduleV2Snapshot>(qk.schedule.board('example.supabase.co', '2026-04-07'));
    expect(cached?.scheduleItems.some((item) => item.id === `sch_${BETA_SCHEDULE_ITEM_UUID}`)).toBe(true);
    expect(cached?.unscheduledJobs.some((job) => job.projectId === betaProjectId)).toBe(false);
    expect(rendered.container.textContent).toContain('Beta Deck');
    expect(toastMocks.success).toHaveBeenCalledWith('Job scheduled.');

    rendered.unmount();
  });
});
