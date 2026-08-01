import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleClient from './ScheduleClient';
import { qk } from '@/lib/queries/keys';
import type { ScheduleV2Snapshot } from '@/lib/queries/schedule';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { adjustJob, assignJob, fetchScheduleGantt, markJobDone, pinJob, reorderItems, setJobDuration } from '@/lib/repo/scheduleV2Repo';
import { ApiError } from '@/lib/repo/apiClient';
import { getScheduleMutationActivityCount } from './scheduleMutationActivity';

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
  latestBoardProps: null as any,
  activeId: null as string | null,
}));
const ganttMocks = vi.hoisted(() => ({
  latestProps: null as any,
  renderedItems: [] as Array<Array<{
    id: string;
    forecastStart: string | null;
    forecastEndExclusive: string | null;
  }>>,
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
      dndMocks.latestBoardProps = props;
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
    ganttMocks.latestProps = props;
    ganttMocks.renderedItems.push(
      (props.visibleScheduleItems ?? []).map((item: {
        id: string;
        forecastStart?: string | null;
        forecastEndExclusive?: string | null;
      }) => ({
        id: item.id,
        forecastStart: item.forecastStart ?? null,
        forecastEndExclusive: item.forecastEndExclusive ?? null,
      })),
    );
    const labelFor = (holiday: { date: string; name?: string }) => {
      const [, month, day] = holiday.date.split('-');
      const monthLabel = month === '04' ? 'Apr' : month;
      return `${holiday.name ?? 'Public holiday'} (${Number(day)} ${monthLabel})`;
    };
    return (
      <div>
        <span>Gantt</span>
        {(props.visibleScheduleItems ?? []).map((item: {
          id: string;
          forecastStart?: string | null;
          forecastEndExclusive?: string | null;
        }) => (
          <div
            key={item.id}
            data-gantt-test-item-id={item.id}
            data-forecast-start={item.forecastStart ?? ''}
            data-forecast-end-exclusive={item.forecastEndExclusive ?? ''}
          />
        ))}
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
  adjustJob: vi.fn(),
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

function emptyCrewMutationResponse() {
  return {
    ok: true,
    crew_id: CREW_UUID,
    schedule: {
      crew_id: CREW_UUID,
      items: [],
      conflicts: [],
      next_available_date: '2026-04-10',
    },
  } as any;
}

function crewJobMutationItem(input: {
  scheduleItemId: string;
  scheduledJobId: string;
  projectId: string;
  position: number;
  start: string;
  endExclusive: string;
  durationDays: number;
  mode?: 'floating' | 'pinned';
}) {
  return {
    id: input.scheduleItemId,
    item_type: 'job',
    position: input.position,
    start: input.start,
    end_exclusive: input.endExclusive,
    duration_days: input.durationDays,
    job: {
      id: input.scheduledJobId,
      job_id: input.projectId,
      crew_id: CREW_UUID,
      mode: input.mode ?? 'floating',
      planned_commitment_type: null,
      planned_week_start: null,
      planned_start: null,
      planned_duration_days: null,
      planned_flex_days: null,
      forecast_start: input.start,
      forecast_end_exclusive: input.endExclusive,
      forecast_duration_days: input.durationDays,
      actual_start: null,
      actual_finish: null,
      status: 'not_started',
      days_remaining: null,
    },
    downtime: null,
  };
}

function crewMutationResponse(
  items: ReturnType<typeof crewJobMutationItem>[],
  nextAvailableDate: string,
) {
  return {
    ok: true,
    crew_id: CREW_UUID,
    schedule: {
      crew_id: CREW_UUID,
      items,
      conflicts: [],
      next_available_date: nextAvailableDate,
    },
  } as any;
}

function boardMutationSnapshot(): ScheduleV2Snapshot {
  return {
    generatedAt: new Date().toISOString(),
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
    dndMocks.latestBoardProps = null;
    dndMocks.activeId = null;
    ganttMocks.latestProps = null;
    ganttMocks.renderedItems = [];
    vi.mocked(adjustJob).mockReset();
    vi.mocked(assignJob).mockReset();
    vi.mocked(fetchScheduleGantt).mockReset();
    vi.mocked(markJobDone).mockReset();
    vi.mocked(pinJob).mockReset();
    vi.mocked(reorderItems).mockReset();
    vi.mocked(setJobDuration).mockReset();
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

  it('keeps transition feedback while switching views without an RSC navigation', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
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
    expect(replaceState).toHaveBeenCalledWith(null, '', '/staff/schedule?view=gantt');
    expect(routerReplace).not.toHaveBeenCalled();
    expect(fetchScheduleGantt).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('prefetches Gantt on intent and reuses the fresh snapshot when switching', async () => {
    const originalReplaceState = window.history.replaceState.bind(window.history);
    vi.spyOn(window.history, 'replaceState').mockImplementation((state, title, url) => {
      const nextUrl = String(url ?? '');
      searchParamsString = nextUrl.includes('?') ? nextUrl.slice(nextUrl.indexOf('?') + 1) : '';
      originalReplaceState(state, title, url);
    });
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
    ) as HTMLButtonElement;
    act(() => {
      ganttButton.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    await act(async () => {
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

    expect(scheduleGanttSnapshotQueryFn).toHaveBeenCalledTimes(1);
    expect(
      queryClient.getQueryData(
        qk.schedule.gantt(
          'example.supabase.co',
          '2026-04-06',
          '2026-06-28',
          '2026-04-07',
        ),
      ),
    ).toBeTruthy();

    act(() => {
      ganttButton.click();
    });
    await act(async () => {
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

    expect(scheduleGanttSnapshotQueryFn).toHaveBeenCalledTimes(1);
    expect(rendered.container.textContent).toContain('Gantt');
    rendered.unmount();
  });

  it('keeps a concurrent Gantt prefetch valid when a newer Board refresh applies', async () => {
    const originalReplaceState = window.history.replaceState.bind(window.history);
    vi.spyOn(window.history, 'replaceState').mockImplementation((state, title, url) => {
      const nextUrl = String(url ?? '');
      searchParamsString = nextUrl.includes('?') ? nextUrl.slice(nextUrl.indexOf('?') + 1) : '';
      originalReplaceState(state, title, url);
    });
    const refreshedBoardSnapshot: ScheduleV2Snapshot = {
      ...initialSnapshot,
      generatedAt: '2026-04-07T12:00:00.000Z',
    };
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(refreshedBoardSnapshot),
      staleTime: 30_000,
    }));
    let resolveGanttPrefetch!: (value: ScheduleV2Snapshot) => void;
    const ganttPrefetch = new Promise<ScheduleV2Snapshot>((resolve) => {
      resolveGanttPrefetch = resolve;
    });
    scheduleGanttSnapshotQueryOptions.mockImplementation((
      host: string,
      today: string,
      range: { rangeStart: string; rangeEnd: string },
    ) => ({
      queryKey: qk.schedule.gantt(host, range.rangeStart, range.rangeEnd, today),
      queryFn: scheduleGanttSnapshotQueryFn.mockImplementation(() => ganttPrefetch),
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
        <ScheduleClient initialScheduleMode="v2" initialV2Snapshot={initialSnapshot} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    const ganttButton = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Gantt',
    ) as HTMLButtonElement;
    act(() => {
      ganttButton.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(scheduleGanttSnapshotQueryFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.schedule.board('example.supabase.co', '2026-04-07'),
      });
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });
    expect(scheduleSnapshotQueryFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveGanttPrefetch({ ...initialSnapshot, unscheduledJobs: [] });
      await ganttPrefetch;
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });
    act(() => {
      ganttButton.click();
    });
    await act(async () => {
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

    expect(scheduleGanttSnapshotQueryFn).toHaveBeenCalledTimes(1);
    expect(ganttMocks.latestProps).toBeTruthy();
    expect(rendered.container.textContent).not.toContain('Loading Gantt...');
    rendered.unmount();
  });

  it('follows canonical URL changes without asking the server to rebuild the page', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    queryClient.setQueryData(
      qk.schedule.gantt(
        'example.supabase.co',
        '2026-04-06',
        '2026-06-28',
        '2026-04-07',
      ),
      { ...initialSnapshot, unscheduledJobs: [] },
    );
    const schedule = () => (
      <QueryClientProvider client={queryClient}>
        <ScheduleClient initialScheduleMode="v2" initialV2Snapshot={initialSnapshot} />
      </QueryClientProvider>
    );
    const rendered = renderIntoDocument(schedule());
    await act(async () => {
      await Promise.resolve();
    });

    searchParamsString = 'view=gantt';
    rendered.rerender(schedule());
    await act(async () => {
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

    const ganttButton = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Gantt',
    );
    expect(ganttButton?.getAttribute('aria-pressed')).toBe('true');
    expect(ganttMocks.latestProps).toBeTruthy();

    searchParamsString = '';
    rendered.rerender(schedule());
    await act(async () => {
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

    const boardButton = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Board',
    );
    expect(boardButton?.getAttribute('aria-pressed')).toBe('true');
    expect(routerReplace).not.toHaveBeenCalled();
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
    let resolveBoardSnapshot!: (snapshot: ScheduleV2Snapshot) => void;
    const boardSnapshotPromise = new Promise<ScheduleV2Snapshot>((resolve) => {
      resolveBoardSnapshot = resolve;
    });
    scheduleSnapshotQueryFn.mockImplementation(() => boardSnapshotPromise);
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn,
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

    await act(async () => {
      resolveBoardSnapshot(boardSnapshot);
      await boardSnapshotPromise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(scheduleSnapshotQueryFn).toHaveBeenCalled();
    expect(queryClient.getQueryData(qk.schedule.board('example.supabase.co', '2026-04-07'))).toEqual(boardSnapshot);
    expect(rendered.container.textContent).toContain('Loading schedule data from the portal database…');
    expect(rendered.container.textContent).not.toContain('Alpha Deck');

    rendered.unmount();
  });

  it('resizes and pins a Gantt job through one atomic adjustment command', async () => {
    vi.useFakeTimers();
    searchParamsString = 'view=gantt';
    const snapshot = { ...boardMutationSnapshot(), unscheduledJobs: [] };
    vi.mocked(adjustJob).mockResolvedValue(emptyCrewMutationResponse());

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const boardCacheKey = qk.schedule.board('example.supabase.co', '2026-04-07');
    queryClient.setQueryData(boardCacheKey, boardMutationSnapshot());
    const rendered = renderIntoDocument(
      <QueryClientProvider client={queryClient}>
        <ScheduleClient initialScheduleMode="v2" initialSeedKind="gantt" initialV2Snapshot={snapshot} />
      </QueryClientProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(ganttMocks.latestProps).toBeTruthy();
    act(() => {
      ganttMocks.latestProps.onResizePin(scheduleItemId, '2026-04-13', 3);
    });
    await act(async () => {
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 6; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    expect(adjustJob).toHaveBeenCalledTimes(1);
    expect(adjustJob).toHaveBeenCalledWith({
      job_id: ALPHA_PROJECT_UUID,
      requested_start_date: '2026-04-13',
      forecast_duration_days: 3,
      force: false,
      today: '2026-04-07',
    });
    expect(setJobDuration).not.toHaveBeenCalled();
    expect(pinJob).not.toHaveBeenCalled();
    expect(queryClient.getQueryData<ScheduleV2Snapshot>(boardCacheKey)).toBeUndefined();

    rendered.unmount();
  });

  it('keeps confirmed Gantt timing visible while the authoritative refresh is delayed', async () => {
    vi.useFakeTimers();
    searchParamsString = 'view=gantt';
    const snapshot = { ...boardMutationSnapshot(), unscheduledJobs: [] };
    const acceptedStart = '2026-04-13';
    const acceptedEndExclusive = '2026-04-16';
    const authoritativeSnapshot: ScheduleV2Snapshot = {
      ...snapshot,
      generatedAt: '2026-04-07T12:00:00.000Z',
      scheduleItems: snapshot.scheduleItems.map((item) => ({
        ...item,
        mode: 'pinned',
        startDateOverride: acceptedStart,
        forecastStart: acceptedStart,
        forecastEndExclusive: acceptedEndExclusive,
        forecastDurationDays: 3,
        durationHoursOverride: 27,
      })),
    };
    let resolveAuthoritativeSnapshot!: (value: ScheduleV2Snapshot) => void;
    const authoritativeSnapshotPromise = new Promise<ScheduleV2Snapshot>((resolve) => {
      resolveAuthoritativeSnapshot = resolve;
    });
    scheduleGanttSnapshotQueryOptions.mockImplementation((
      host: string,
      today: string,
      range: { rangeStart: string; rangeEnd: string },
    ) => ({
      queryKey: qk.schedule.gantt(host, range.rangeStart, range.rangeEnd, today),
      queryFn: scheduleGanttSnapshotQueryFn.mockImplementation(() => authoritativeSnapshotPromise),
      staleTime: 30_000,
    }));

    let resolveAdjustment!: (value: ReturnType<typeof crewMutationResponse>) => void;
    const adjustmentPromise = new Promise<ReturnType<typeof crewMutationResponse>>((resolve) => {
      resolveAdjustment = resolve;
    });
    vi.mocked(adjustJob).mockImplementation(() => adjustmentPromise);

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
    const mutationHistoryStart = ganttMocks.renderedItems.length;

    act(() => {
      ganttMocks.latestProps.onResizePin(scheduleItemId, acceptedStart, 3);
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    const mutationResponse = crewMutationResponse(
      [
        crewJobMutationItem({
          scheduleItemId: SCHEDULE_ITEM_UUID,
          scheduledJobId: SCHEDULED_JOB_UUID,
          projectId: ALPHA_PROJECT_UUID,
          position: 0,
          start: acceptedStart,
          endExclusive: acceptedEndExclusive,
          durationDays: 3,
          mode: 'pinned',
        }),
      ],
      acceptedEndExclusive,
    );
    await act(async () => {
      resolveAdjustment(mutationResponse);
      await adjustmentPromise;
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
      vi.runOnlyPendingTimers();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    const itemWhileRefreshIsPending = rendered.container.querySelector(
      `[data-gantt-test-item-id="${scheduleItemId}"]`,
    );
    const visibleStartWhileRefreshIsPending = itemWhileRefreshIsPending?.getAttribute('data-forecast-start');
    const visibleEndWhileRefreshIsPending = itemWhileRefreshIsPending?.getAttribute(
      'data-forecast-end-exclusive',
    );
    const authoritativeFetchCountBeforeResolution = scheduleGanttSnapshotQueryFn.mock.calls.length;

    expect(getScheduleMutationActivityCount('example.supabase.co:2026-04-07')).toBe(1);

    await act(async () => {
      resolveAuthoritativeSnapshot(authoritativeSnapshot);
      await authoritativeSnapshotPromise;
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
      vi.runOnlyPendingTimers();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    const renderedStartsAfterMutation = ganttMocks.renderedItems
      .slice(mutationHistoryStart)
      .map((items) => items.find((item) => item.id === scheduleItemId)?.forecastStart ?? null);
    const firstAcceptedRender = renderedStartsAfterMutation.indexOf(acceptedStart);
    const revertedAfterAcceptance = firstAcceptedRender >= 0
      && renderedStartsAfterMutation.slice(firstAcceptedRender + 1).includes('2026-04-08');
    const finalItem = ganttMocks.latestProps.visibleScheduleItems.find(
      (item: { id: string }) => item.id === scheduleItemId,
    );
    const finalText = rendered.container.textContent;
    rendered.unmount();

    expect(adjustJob).toHaveBeenCalledTimes(1);
    expect(authoritativeFetchCountBeforeResolution).toBe(1);
    expect(visibleStartWhileRefreshIsPending).toBe(acceptedStart);
    expect(visibleEndWhileRefreshIsPending).toBe(acceptedEndExclusive);
    expect(firstAcceptedRender).toBeGreaterThanOrEqual(0);
    expect(revertedAfterAcceptance).toBe(false);
    expect(finalItem?.forecastStart).toBe(acceptedStart);
    expect(finalItem?.forecastEndExclusive).toBe(acceptedEndExclusive);
    expect(getScheduleMutationActivityCount('example.supabase.co:2026-04-07')).toBe(0);
    expect(finalText).toContain('Saved');
  });

  it('preserves authoritative Gantt dates when an overlapping job depends on pre-range calendar context', async () => {
    vi.useFakeTimers();
    searchParamsString = 'view=gantt';
    const snapshot = { ...boardMutationSnapshot(), unscheduledJobs: [], holidays: [] };
    snapshot.scheduleItems = snapshot.scheduleItems.map((item) => ({
      ...item,
      mode: 'pinned',
      forecastStart: '2026-04-02',
      forecastEndExclusive: '2026-04-08',
      forecastDurationDays: 3,
      startDateOverride: '2026-04-02',
      durationHoursOverride: 27,
    }));
    const authoritativeSnapshot = {
      ...snapshot,
      generatedAt: '2026-04-07T12:00:00.000Z',
    };
    scheduleGanttSnapshotQueryOptions.mockImplementation((host: string, today: string, range: { rangeStart: string; rangeEnd: string }) => ({
      queryKey: qk.schedule.gantt(host, range.rangeStart, range.rangeEnd, today),
      queryFn: scheduleGanttSnapshotQueryFn.mockResolvedValue(authoritativeSnapshot),
      staleTime: 30_000,
    }));
    vi.mocked(adjustJob).mockResolvedValue({
      ok: true,
      crew_id: CREW_UUID,
      schedule: {
        crew_id: CREW_UUID,
        items: [
          {
            id: SCHEDULE_ITEM_UUID,
            item_type: 'job',
            position: 0,
            start: '2026-04-02',
            end_exclusive: '2026-04-08',
            duration_days: 3,
            job: {
              id: SCHEDULED_JOB_UUID,
              job_id: ALPHA_PROJECT_UUID,
              crew_id: CREW_UUID,
              mode: 'pinned',
              planned_commitment_type: null,
              planned_week_start: null,
              planned_start: null,
              planned_duration_days: null,
              planned_flex_days: null,
              forecast_start: '2026-04-02',
              forecast_end_exclusive: '2026-04-08',
              forecast_duration_days: 3,
              actual_start: null,
              actual_finish: null,
              status: 'not_started',
              days_remaining: null,
            },
            downtime: null,
          },
        ],
        conflicts: [],
        next_available_date: '2026-04-08',
      },
    } as any);

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

    act(() => {
      ganttMocks.latestProps.onResizePin(scheduleItemId, '2026-04-02', 3);
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();
    });

    const renderedItem = ganttMocks.latestProps.visibleScheduleItems.find(
      (item: { id: string }) => item.id === scheduleItemId,
    );
    expect(renderedItem?.forecastStart).toBe('2026-04-02');
    expect(renderedItem?.forecastEndExclusive).toBe('2026-04-08');

    const cached = queryClient.getQueryData<ScheduleV2Snapshot>(
      qk.schedule.gantt('example.supabase.co', '2026-04-06', '2026-06-28', '2026-04-07'),
    );
    expect(cached?.scheduleItems.find((item) => item.id === scheduleItemId)?.forecastEndExclusive).toBe('2026-04-08');

    rendered.unmount();
  });

  it('keeps the committed Gantt preview visible if the post-commit authoritative refresh fails', async () => {
    vi.useFakeTimers();
    searchParamsString = 'view=gantt';
    const snapshot = { ...boardMutationSnapshot(), unscheduledJobs: [] };
    scheduleGanttSnapshotQueryOptions.mockImplementation((host: string, today: string, range: { rangeStart: string; rangeEnd: string }) => ({
      queryKey: qk.schedule.gantt(host, range.rangeStart, range.rangeEnd, today),
      queryFn: scheduleGanttSnapshotQueryFn.mockRejectedValue(new Error('Authoritative range refresh failed')),
      staleTime: 30_000,
    }));
    vi.mocked(adjustJob).mockResolvedValue(emptyCrewMutationResponse());

    const rendered = renderIntoDocument(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ScheduleClient initialScheduleMode="v2" initialSeedKind="gantt" initialV2Snapshot={snapshot} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      ganttMocks.latestProps.onResizePin(scheduleItemId, '2026-04-13', 3);
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
      vi.runOnlyPendingTimers();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    const renderedItem = ganttMocks.latestProps.visibleScheduleItems.find(
      (item: { id: string }) => item.id === scheduleItemId,
    );
    expect(renderedItem?.forecastStart).toBe('2026-04-13');
    expect(renderedItem?.forecastEndExclusive).toBe('2026-04-16');
    expect(rendered.container.textContent).toContain('Schedule may be out of date');
    expect(rendered.container.textContent).toContain('Refresh needed');
    expect(rendered.container.textContent).toContain('The saved preview remains visible');
    rendered.unmount();
  });

  it('does not let a stale Board fetch started before a mutation overwrite the accepted assignment', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    const staleSnapshot: ScheduleV2Snapshot = {
      ...boardMutationSnapshot(),
      generatedAt: '2026-04-07T00:00:00.000Z',
    };
    let resolveStaleBoardSnapshot!: (value: ScheduleV2Snapshot) => void;
    const staleBoardSnapshotPromise = new Promise<ScheduleV2Snapshot>((resolve) => {
      resolveStaleBoardSnapshot = resolve;
    });
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockImplementation(() => staleBoardSnapshotPromise),
      staleTime: 30_000,
    }));

    let resolveAssignment!: (value: ReturnType<typeof crewMutationResponse>) => void;
    const assignmentPromise = new Promise<ReturnType<typeof crewMutationResponse>>((resolve) => {
      resolveAssignment = resolve;
    });
    vi.mocked(assignJob).mockImplementation(() => assignmentPromise);

    const { queryClient, rendered } = renderSchedule(snapshot);
    const boardCacheKey = qk.schedule.board('example.supabase.co', '2026-04-07');
    await act(async () => {
      await Promise.resolve();
    });

    let staleFetchTask!: Promise<void>;
    act(() => {
      staleFetchTask = queryClient.invalidateQueries({ queryKey: boardCacheKey, exact: true });
      dndMocks.latestContextProps.onDragStart({
        active: { id: betaJobId },
        activatorEvent: new Event('pointerdown'),
      });
      dndMocks.latestContextProps.onDragEnd({
        active: { id: betaJobId, rect: { current: {} } },
        over: { id: `lane:${crewId}` },
        collisions: null,
        delta: { x: 0, y: 0 },
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

    const acceptedResponse = crewMutationResponse(
      [
        crewJobMutationItem({
          scheduleItemId: SCHEDULE_ITEM_UUID,
          scheduledJobId: SCHEDULED_JOB_UUID,
          projectId: ALPHA_PROJECT_UUID,
          position: 0,
          start: '2026-04-08',
          endExclusive: '2026-04-10',
          durationDays: 2,
        }),
        crewJobMutationItem({
          scheduleItemId: BETA_SCHEDULE_ITEM_UUID,
          scheduledJobId: BETA_SCHEDULED_JOB_UUID,
          projectId: BETA_PROJECT_UUID,
          position: 1,
          start: '2026-04-10',
          endExclusive: '2026-04-14',
          durationDays: 2,
        }),
      ],
      '2026-04-14',
    );
    await act(async () => {
      resolveAssignment(acceptedResponse);
      await assignmentPromise;
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
      vi.runOnlyPendingTimers();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    const acceptedCache = queryClient.getQueryData<ScheduleV2Snapshot>(boardCacheKey);
    const acceptedResultWasVisible = (
      acceptedCache?.scheduleItems.some((item) => item.id === `sch_${BETA_SCHEDULE_ITEM_UUID}`) === true
      && acceptedCache.unscheduledJobs.some((job) => job.projectId === betaProjectId) === false
    );

    await act(async () => {
      resolveStaleBoardSnapshot(staleSnapshot);
      await staleBoardSnapshotPromise;
      await staleFetchTask;
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
      vi.runOnlyPendingTimers();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });

    const finalCache = queryClient.getQueryData<ScheduleV2Snapshot>(boardCacheKey);
    const betaStayedScheduled = finalCache?.scheduleItems.some(
      (item) => item.id === `sch_${BETA_SCHEDULE_ITEM_UUID}`,
    );
    const betaReturnedToUnscheduled = finalCache?.unscheduledJobs.some(
      (job) => job.projectId === betaProjectId,
    );
    const betaIsVisibleInLane = rendered.container
      .querySelector('section[aria-label="Installer lanes"]')
      ?.textContent?.includes('Beta Deck');
    const betaIsVisibleAsUnscheduled = rendered.container
      .querySelector('aside[aria-label="Unscheduled jobs"]')
      ?.textContent?.includes('Beta Deck');
    rendered.unmount();

    expect(scheduleSnapshotQueryFn).toHaveBeenCalled();
    expect(assignJob).toHaveBeenCalledTimes(1);
    expect(acceptedResultWasVisible).toBe(true);
    expect(betaStayedScheduled).toBe(true);
    expect(betaReturnedToUnscheduled).toBe(false);
    expect(betaIsVisibleInLane).toBe(true);
    expect(betaIsVisibleAsUnscheduled).toBe(false);
  });

  it('calls assignJob with the resolved end-of-lane position for a successful unscheduled drop', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(assignJob).mockResolvedValue(emptyCrewMutationResponse());

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
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 6; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    expect(assignJob).toHaveBeenCalledWith({
      job_id: BETA_PROJECT_UUID,
      crew_id: CREW_UUID,
      position: 1,
      force: false,
      today: '2026-04-07',
    });
    expect(dndMocks.latestBoardProps.mutationNotice).toBeNull();
    expect(rendered.container.textContent).not.toMatch(/Saving|Saved|Checking saved schedule/);

    rendered.unmount();
  });

  it('sends the raw moved item identity for a same-crew reorder', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    snapshot.unscheduledJobs = [];
    snapshot.scheduleItems.push({
      ...snapshot.scheduleItems[0],
      id: `sch_${BETA_SCHEDULE_ITEM_UUID}`,
      projectId: betaProjectId,
      estimateId: betaEstimateId,
      sortIndex: 1,
      scheduledJobId: BETA_SCHEDULED_JOB_UUID,
      forecastStart: '2026-04-10',
      forecastEndExclusive: '2026-04-14',
    });
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(reorderItems).mockResolvedValue(emptyCrewMutationResponse());

    const { rendered } = renderSchedule(snapshot);
    await act(async () => {
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
      vi.runOnlyPendingTimers();
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    });

    act(() => {
      dndMocks.latestContextProps.onDragStart({ active: { id: scheduleItemId }, activatorEvent: new Event('pointerdown') });
      dndMocks.latestContextProps.onDragEnd({
        active: { id: scheduleItemId, rect: { current: {} } },
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

    expect(reorderItems).toHaveBeenCalledWith({
      crew_id: CREW_UUID,
      item_id: SCHEDULE_ITEM_UUID,
      new_position: 1,
      force: false,
      today: '2026-04-07',
    });

    rendered.unmount();
  });

  it('asks before moving another job, then commits only after approval', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(assignJob)
      .mockResolvedValueOnce({
        requires_confirmation: true,
        impacts: [
          {
            job_id: ALPHA_PROJECT_UUID,
            scheduled_job_id: SCHEDULED_JOB_UUID,
            before_start: '2026-04-08',
            after_start: '2026-04-10',
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        requires_confirmation: true,
        impacts: [
          {
            job_id: ALPHA_PROJECT_UUID,
            scheduled_job_id: SCHEDULED_JOB_UUID,
            before_start: '2026-04-08',
            after_start: '2026-04-10',
          },
        ],
      } as any)
      .mockResolvedValueOnce(emptyCrewMutationResponse());

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

    expect(document.body.textContent).toContain('Move other scheduled jobs?');
    expect(document.body.textContent).toContain('Alpha Deck');
    expect(dndMocks.latestBoardProps.mutationNotice).toBeNull();
    expect(assignJob).toHaveBeenCalledTimes(1);
    expect(assignJob).toHaveBeenLastCalledWith(expect.objectContaining({ force: false }));

    const ganttButton = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Gantt',
    ) as HTMLButtonElement | undefined;
    act(() => {
      ganttButton?.click();
    });
    expect(routerReplace).not.toHaveBeenCalled();
    expect(toastMocks.info).toHaveBeenCalledWith('Finish or cancel the schedule change before switching views.');

    const saveButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save change',
    ) as HTMLButtonElement | undefined;
    expect(saveButton).toBeTruthy();

    act(() => {
      saveButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(assignJob).toHaveBeenCalledTimes(3);
    expect(assignJob).toHaveBeenNthCalledWith(2, expect.objectContaining({ force: false }));
    expect(assignJob).toHaveBeenLastCalledWith(expect.objectContaining({ force: true }));
    expect(toastMocks.success).not.toHaveBeenCalledWith('Job scheduled.');
    expect(dndMocks.latestBoardProps.mutationNotice).toBeNull();

    rendered.unmount();
  });

  it('shows every affected job before allowing a forced save', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    const impacts = Array.from({ length: 11 }, (_, index) => ({
      job_id: `00000000-0000-4000-8000-${String(500 + index).padStart(12, '0')}`,
      scheduled_job_id: `00000000-0000-4000-8000-${String(700 + index).padStart(12, '0')}`,
      before_start: '2026-04-08',
      after_start: `2026-04-${String(9 + index).padStart(2, '0')}`,
    }));
    vi.mocked(assignJob).mockResolvedValue({
      requires_confirmation: true,
      impacts,
    } as any);

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

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.querySelectorAll('li')).toHaveLength(11);

    const cancelButton = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Cancel',
    ) as HTMLButtonElement | undefined;
    act(() => {
      cancelButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    rendered.unmount();
  });

  it('does not force-save when affected dates change after approval', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(assignJob)
      .mockResolvedValueOnce({
        requires_confirmation: true,
        impacts: [
          {
            job_id: ALPHA_PROJECT_UUID,
            scheduled_job_id: SCHEDULED_JOB_UUID,
            before_start: '2026-04-08',
            after_start: '2026-04-10',
          },
        ],
      } as any)
      .mockResolvedValueOnce({
        requires_confirmation: true,
        impacts: [
          {
            job_id: ALPHA_PROJECT_UUID,
            scheduled_job_id: SCHEDULED_JOB_UUID,
            before_start: '2026-04-08',
            after_start: '2026-04-11',
          },
        ],
      } as any);

    const { rendered } = renderSchedule(snapshot);
    await act(async () => {
      await Promise.resolve();
    });
    const fetchesBeforeDrop = scheduleSnapshotQueryFn.mock.calls.length;

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

    const saveButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save change',
    ) as HTMLButtonElement | undefined;
    act(() => {
      saveButton?.click();
    });
    await act(async () => {
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 6; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    expect(assignJob).toHaveBeenCalledTimes(2);
    expect(assignJob).toHaveBeenNthCalledWith(1, expect.objectContaining({ force: false }));
    expect(assignJob).toHaveBeenNthCalledWith(2, expect.objectContaining({ force: false }));
    expect(assignJob).not.toHaveBeenCalledWith(expect.objectContaining({ force: true }));
    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).toContain('Beta Deck');
    expect(scheduleSnapshotQueryFn.mock.calls.length).toBeGreaterThan(fetchesBeforeDrop);
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(dndMocks.latestBoardProps.mutationNotice).toMatchObject({
      projectId: betaProjectId,
      tone: 'error',
      actionLabel: 'Retry',
    });

    rendered.unmount();
  });

  it('does not force-save a malformed target-only confirmation response', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(assignJob)
      .mockResolvedValueOnce({
        requires_confirmation: true,
        impacts: [
          {
            job_id: BETA_PROJECT_UUID,
            scheduled_job_id: BETA_SCHEDULED_JOB_UUID,
            before_start: null,
            after_start: '2026-04-10',
          },
        ],
      } as any);

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
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 6; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    expect(document.body.textContent).not.toContain('Move other scheduled jobs?');
    expect(assignJob).toHaveBeenCalledTimes(1);
    expect(assignJob).toHaveBeenCalledWith(expect.objectContaining({ force: false }));
    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).toContain('Beta Deck');
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(dndMocks.latestBoardProps.mutationNotice).toMatchObject({
      projectId: betaProjectId,
      tone: 'error',
      actionLabel: 'Retry',
    });

    rendered.unmount();
  });

  it('rolls back a previewed move when affected-job confirmation is cancelled', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(assignJob).mockResolvedValue({
      requires_confirmation: true,
      impacts: [
        {
          job_id: ALPHA_PROJECT_UUID,
          scheduled_job_id: SCHEDULED_JOB_UUID,
          before_start: '2026-04-08',
          after_start: '2026-04-10',
        },
      ],
    } as any);

    const { rendered } = renderSchedule(snapshot);

    await act(async () => {
      await Promise.resolve();
    });
    const fetchesBeforeCancellation = scheduleSnapshotQueryFn.mock.calls.length;

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

    const cancelButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Cancel',
    ) as HTMLButtonElement | undefined;
    expect(cancelButton).toBeTruthy();

    act(() => {
      cancelButton?.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(assignJob).toHaveBeenCalledTimes(1);
    expect(assignJob).toHaveBeenLastCalledWith(expect.objectContaining({ force: false }));
    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).toContain('Beta Deck');
    expect(toastMocks.success).not.toHaveBeenCalledWith('Job scheduled.');
    expect(scheduleSnapshotQueryFn.mock.calls.length).toBeGreaterThan(fetchesBeforeCancellation);

    rendered.unmount();
  });

  it('quietly reconciles when the finish-early decision is cancelled', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(markJobDone).mockResolvedValue({
      requires_finish_early: true,
      freed_days: 2,
      actual_finish: '2026-04-08',
      forecast_end_exclusive: '2026-04-10',
      impacts: [],
    } as any);
    const { rendered } = renderSchedule(snapshot);
    await act(async () => {
      await Promise.resolve();
    });

    const scheduleItem = snapshot.scheduleItems[0];
    const actions = dndMocks.latestBoardProps.buildJobMenuActions({
      id: scheduleItem.id,
      scheduleItem,
      job: null,
      scheduleStatus: 'TENTATIVE',
    });
    const markDoneAction = actions.find((action: { label: string }) => action.label === 'Mark done');
    act(() => markDoneAction?.onClick());
    await act(async () => {
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

    expect(markJobDone).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('Finished early');
    const fetchesBeforeCancel = scheduleSnapshotQueryFn.mock.calls.length;
    const cancelButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Cancel',
    ) as HTMLButtonElement | undefined;
    act(() => cancelButton?.click());
    await act(async () => {
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
      vi.runOnlyPendingTimers();
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    });

    expect(markJobDone).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('Finished early');
    expect(scheduleSnapshotQueryFn.mock.calls.length).toBeGreaterThan(fetchesBeforeCancel);
    expect(dndMocks.latestBoardProps.mutationNotice).toBeNull();
    expect(rendered.container.textContent).not.toMatch(/Saving|Saved|Checking saved schedule/);
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
    vi.mocked(assignJob)
      .mockRejectedValueOnce(
        new ApiError('assign failed', {
          status: 422,
          body: { error: 'assign failed' },
        }),
      )
      .mockResolvedValueOnce(emptyCrewMutationResponse());

    const { rendered } = renderSchedule(snapshot);

    await act(async () => {
      await Promise.resolve();
    });
    const fetchesBeforeRejectedAssignment = scheduleSnapshotQueryFn.mock.calls.length;

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
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(rendered.container.textContent).not.toContain('Schedule change was not saved');
    expect(dndMocks.latestBoardProps.mutationNotice).toMatchObject({
      projectId: betaProjectId,
      tone: 'error',
      actionLabel: 'Retry',
    });
    expect(scheduleSnapshotQueryFn).toHaveBeenCalledTimes(fetchesBeforeRejectedAssignment);

    act(() => dndMocks.latestBoardProps.mutationNotice.onAction());
    await act(async () => {
      vi.advanceTimersByTime(200);
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    });

    expect(assignJob).toHaveBeenCalledTimes(2);
    expect(dndMocks.latestBoardProps.mutationNotice).toBeNull();

    rendered.unmount();
  });

  it('fails closed and reconciles when an assignment response does not explicitly confirm success', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(assignJob).mockResolvedValue({} as any);

    const { rendered } = renderSchedule(snapshot);

    await act(async () => {
      await Promise.resolve();
    });
    const fetchesBeforeAssignment = scheduleSnapshotQueryFn.mock.calls.length;

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
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 6; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).toContain('Beta Deck');
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(toastMocks.success).not.toHaveBeenCalledWith('Job scheduled.');
    expect(scheduleSnapshotQueryFn.mock.calls.length).toBeGreaterThan(fetchesBeforeAssignment);
    expect(dndMocks.latestBoardProps.mutationNotice).toMatchObject({ tone: 'error', actionLabel: 'Retry' });

    rendered.unmount();
  });

  it('fails closed when an explicitly successful response contains a malformed schedule row', async () => {
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
            id: BETA_SCHEDULE_ITEM_UUID,
            item_type: 'job',
            position: 0,
            start: '2026-04-10',
            end_exclusive: '2026-04-14',
            duration_days: 2,
            job: null,
          },
        ],
        conflicts: [],
        next_available_date: '2026-04-14',
      },
    } as any);

    const { rendered } = renderSchedule(snapshot);
    await act(async () => {
      await Promise.resolve();
    });
    const fetchesBeforeAssignment = scheduleSnapshotQueryFn.mock.calls.length;

    act(() => {
      dndMocks.latestContextProps.onDragStart({
        active: { id: betaJobId },
        activatorEvent: new Event('pointerdown'),
      });
      dndMocks.latestContextProps.onDragEnd({
        active: { id: betaJobId, rect: { current: {} } },
        over: { id: `lane:${crewId}` },
        collisions: null,
        delta: { x: 0, y: 0 },
      });
    });
    await act(async () => {
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 6; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).toContain('Beta Deck');
    expect(toastMocks.success).not.toHaveBeenCalledWith('Job scheduled.');
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(scheduleSnapshotQueryFn.mock.calls.length).toBeGreaterThan(fetchesBeforeAssignment);
    expect(dndMocks.latestBoardProps.mutationNotice).toMatchObject({ tone: 'error', actionLabel: 'Retry' });
    rendered.unmount();
  });

  it('never force-saves a non-boolean confirmation discriminator', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    vi.mocked(assignJob).mockResolvedValue({
      requires_confirmation: 'yes',
      impacts: [
        {
          job_id: ALPHA_PROJECT_UUID,
          scheduled_job_id: SCHEDULED_JOB_UUID,
          before_start: '2026-04-08',
          after_start: '2026-04-10',
        },
      ],
    } as any);

    const { rendered } = renderSchedule(snapshot);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      dndMocks.latestContextProps.onDragStart({
        active: { id: betaJobId },
        activatorEvent: new Event('pointerdown'),
      });
      dndMocks.latestContextProps.onDragEnd({
        active: { id: betaJobId, rect: { current: {} } },
        over: { id: `lane:${crewId}` },
        collisions: null,
        delta: { x: 0, y: 0 },
      });
    });
    await act(async () => {
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 6; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    expect(assignJob).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('Move other scheduled jobs?');
    expect(toastMocks.success).not.toHaveBeenCalledWith('Job scheduled.');
    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).toContain('Beta Deck');
    expect(dndMocks.latestBoardProps.mutationNotice).toMatchObject({ tone: 'error', actionLabel: 'Retry' });
    rendered.unmount();
  });

  it('blocks another mutation until an ambiguous-failure refetch returns the authoritative snapshot', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    const authoritativeSnapshot = {
      ...snapshot,
      generatedAt: '2026-04-07T12:00:00.000Z',
    };
    let resolveAuthoritativeSnapshot!: (value: ScheduleV2Snapshot) => void;
    const authoritativeSnapshotPromise = new Promise<ScheduleV2Snapshot>((resolve) => {
      resolveAuthoritativeSnapshot = resolve;
    });
    scheduleSnapshotQueryFn.mockImplementation(() => authoritativeSnapshotPromise);
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn,
      staleTime: 30_000,
    }));
    vi.mocked(assignJob)
      .mockRejectedValueOnce(
        new ApiError('Commit result unknown', {
          status: 500,
          body: { error: 'Commit result unknown' },
        }),
      )
      .mockResolvedValue(emptyCrewMutationResponse());

    const { rendered } = renderSchedule(snapshot);

    await act(async () => {
      await Promise.resolve();
    });

    const dropBetaIntoCrew = () => {
      dndMocks.latestContextProps.onDragStart({ active: { id: betaJobId }, activatorEvent: new Event('pointerdown') });
      dndMocks.latestContextProps.onDragEnd({
        active: { id: betaJobId, rect: { current: {} } },
        over: { id: `lane:${crewId}` },
        collisions: null,
        delta: { x: 0, y: 0 },
      });
    };

    act(dropBetaIntoCrew);
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(assignJob).toHaveBeenCalledTimes(1);
    expect(scheduleSnapshotQueryFn).toHaveBeenCalledTimes(1);
    expect(rendered.container.textContent).not.toMatch(/Refreshing|Saving|Saved|Checking saved schedule/);
    expect(dndMocks.latestBoardProps.mutationNotice).toBeNull();
    expect(dndMocks.latestBoardProps.interaction).toMatchObject({ disabled: true });
    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).not.toContain('Beta Deck');

    act(dropBetaIntoCrew);
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(assignJob).toHaveBeenCalledTimes(1);
    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).not.toContain('Beta Deck');

    await act(async () => {
      resolveAuthoritativeSnapshot(authoritativeSnapshot);
      await authoritativeSnapshotPromise;
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 6; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).toContain('Beta Deck');
    expect(dndMocks.latestBoardProps.mutationNotice).toMatchObject({ tone: 'error', actionLabel: 'Retry' });
    expect(rendered.container.textContent).not.toMatch(/Refreshing|Saving|Saved|Checking saved schedule/);

    rendered.unmount();
  });

  it('keeps the card in place when an ambiguous failure reconciles to the intended saved position', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    const committedSnapshot: ScheduleV2Snapshot = {
      ...snapshot,
      generatedAt: '2026-04-07T12:00:00.000Z',
      scheduleItems: [
        ...snapshot.scheduleItems,
        {
          ...snapshot.scheduleItems[0],
          id: `sch_${BETA_SCHEDULE_ITEM_UUID}`,
          projectId: betaProjectId,
          estimateId: betaEstimateId,
          scheduledJobId: BETA_SCHEDULED_JOB_UUID,
          sortIndex: 1,
          forecastStart: '2026-04-10',
          forecastEndExclusive: '2026-04-14',
        },
      ],
      unscheduledJobs: [],
    };
    let resolveCommittedSnapshot!: (value: ScheduleV2Snapshot) => void;
    const committedSnapshotPromise = new Promise<ScheduleV2Snapshot>((resolve) => {
      resolveCommittedSnapshot = resolve;
    });
    scheduleSnapshotQueryFn
      .mockResolvedValueOnce(snapshot)
      .mockImplementation(() => committedSnapshotPromise);
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn,
      staleTime: 30_000,
    }));
    vi.mocked(assignJob).mockRejectedValue(
      new ApiError('Commit result unknown', {
        status: 500,
        body: { error: 'Commit result unknown' },
      }),
    );

    const { rendered } = renderSchedule(snapshot);
    await act(async () => {
      await Promise.resolve();
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
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    });

    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).not.toContain('Beta Deck');
    expect(dndMocks.latestBoardProps.mutationNotice).toBeNull();

    await act(async () => {
      resolveCommittedSnapshot(committedSnapshot);
      await committedSnapshotPromise;
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 8; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).not.toContain('Beta Deck');
    expect(dndMocks.latestBoardProps.mutationNotice).toBeNull();
    expect(dndMocks.latestBoardProps.interaction).toMatchObject({ disabled: false });
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(rendered.container.textContent).not.toMatch(/Refreshing|Saving|Saved|Checking saved schedule/);
    rendered.unmount();
  });

  it('keeps the card in place and offers one Refresh action when verification cannot load', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryFn
      .mockResolvedValueOnce(snapshot)
      .mockRejectedValue(new Error('offline'));
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn,
      staleTime: 30_000,
    }));
    vi.mocked(assignJob).mockRejectedValue(
      new ApiError('Commit result unknown', {
        status: 500,
        body: { error: 'Commit result unknown' },
      }),
    );

    const { rendered } = renderSchedule(snapshot);
    await act(async () => {
      await Promise.resolve();
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
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 8; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).not.toContain('Beta Deck');
    expect(dndMocks.latestBoardProps.mutationNotice).toMatchObject({
      projectId: betaProjectId,
      tone: 'warning',
      actionLabel: 'Refresh',
    });
    expect(dndMocks.latestBoardProps.interaction).toMatchObject({ disabled: true });
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(rendered.container.textContent).not.toContain('Schedule may be out of date');
    rendered.unmount();
  });

  it('keeps the saved cache and blocks a second write after remounting during a slow mutation', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: scheduleSnapshotQueryFn.mockResolvedValue(snapshot),
      staleTime: 30_000,
    }));
    let resolveAssignment!: (value: ReturnType<typeof emptyCrewMutationResponse>) => void;
    const pendingAssignment = new Promise<ReturnType<typeof emptyCrewMutationResponse>>((resolve) => {
      resolveAssignment = resolve;
    });
    vi.mocked(assignJob).mockImplementation(() => pendingAssignment);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const first = renderIntoDocument(
      <QueryClientProvider client={queryClient}>
        <ScheduleClient initialScheduleMode="v2" initialV2Snapshot={snapshot} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    const dropBetaIntoCrew = () => {
      dndMocks.latestContextProps.onDragStart({
        active: { id: betaJobId },
        activatorEvent: new Event('pointerdown'),
      });
      dndMocks.latestContextProps.onDragEnd({
        active: { id: betaJobId, rect: { current: {} } },
        over: { id: `lane:${crewId}` },
        collisions: null,
        delta: { x: 0, y: 0 },
      });
    };

    act(dropBetaIntoCrew);
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });
    expect(assignJob).toHaveBeenCalledTimes(1);
    expect(dndMocks.latestBoardProps.mutationNotice).toBeNull();
    expect(dndMocks.latestBoardProps.interaction).toMatchObject({ disabled: true });
    expect(first.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).not.toContain('Beta Deck');
    const boardKey = qk.schedule.board('example.supabase.co', '2026-04-07');
    expect(
      queryClient
        .getQueryData<ScheduleV2Snapshot>(boardKey)
        ?.unscheduledJobs.some((job) => job.projectId === betaProjectId),
    ).toBe(true);

    first.unmount();
    const second = renderIntoDocument(
      <QueryClientProvider client={queryClient}>
        <ScheduleClient initialScheduleMode="v2" />
      </QueryClientProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(second.container.textContent).toContain('Beta Deck');
    expect(second.container.textContent).not.toMatch(/Refreshing|Saving|Saved|Checking saved schedule/);
    expect(dndMocks.latestBoardProps.interaction).toMatchObject({ disabled: true });

    act(dropBetaIntoCrew);
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });
    expect(assignJob).toHaveBeenCalledTimes(1);
    expect(toastMocks.info).toHaveBeenCalledWith(
      'Another schedule change is still saving. Try again in a moment.',
    );

    const fetchesBeforeSettlement = scheduleSnapshotQueryFn.mock.calls.length;
    await act(async () => {
      resolveAssignment(emptyCrewMutationResponse());
      await pendingAssignment;
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
      vi.runOnlyPendingTimers();
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    });

    expect(scheduleSnapshotQueryFn.mock.calls.length).toBeGreaterThan(fetchesBeforeSettlement);
    expect(second.container.textContent).toContain('Beta Deck');
    expect(second.container.textContent).not.toMatch(/Refreshing|Saving|Saved|Checking saved schedule/);
    second.unmount();
  });

  it('restores once with one retry notice when unscheduled assignment returns 409', async () => {
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
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 6; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    const unscheduledAfter = rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]');
    expect(unscheduledAfter?.textContent).toContain('Beta Deck');
    expect(dndMocks.latestBoardProps.mutationNotice).toMatchObject({
      projectId: betaProjectId,
      tone: 'error',
      actionLabel: 'Retry',
    });
    expect(toastMocks.error).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('logs a request reference but shows only one retry notice when assignment returns 500', async () => {
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
    const fetchesBeforeAmbiguousAssignment = scheduleSnapshotQueryFn.mock.calls.length;

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
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 6; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    const unscheduledAfter = rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]');
    expect(unscheduledAfter?.textContent).toContain('Beta Deck');
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(dndMocks.latestBoardProps.mutationNotice).toMatchObject({
      projectId: betaProjectId,
      tone: 'error',
      actionLabel: 'Retry',
    });
    expect(scheduleSnapshotQueryFn.mock.calls.length).toBeGreaterThan(fetchesBeforeAmbiguousAssignment);
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

  it('keeps assign diagnostics out of routine Board presentation when assignment returns 500', async () => {
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
      for (let pass = 0; pass < 3; pass += 1) {
        for (let index = 0; index < 6; index += 1) await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      }
    });

    const unscheduledAfter = rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]');
    expect(unscheduledAfter?.textContent).toContain('Beta Deck');
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(dndMocks.latestBoardProps.mutationNotice).toMatchObject({
      projectId: betaProjectId,
      tone: 'error',
      actionLabel: 'Retry',
    });

    rendered.unmount();
  });

  it('keeps a successful assignment in the Board cache and clears range-limited Gantt data', async () => {
    vi.useFakeTimers();
    const snapshot = boardMutationSnapshot();
    snapshot.conflicts = [
      {
        crew_id: CREW_UUID,
        job_id: SCHEDULED_JOB_UUID,
        type: 'pinned_collision',
        expected_cursor_start: '2026-04-08',
        pinned_start: '2026-04-07',
        overlap_days: 1,
      },
    ];
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
    const ganttCacheKey = qk.schedule.gantt(
      'example.supabase.co',
      '2026-04-06',
      '2026-06-28',
      '2026-04-07',
    );
    queryClient.setQueryData(ganttCacheKey, { ...snapshot, unscheduledJobs: [] });

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
    expect(cached?.conflicts).toEqual([]);
    expect(queryClient.getQueryData<ScheduleV2Snapshot>(ganttCacheKey)).toBeUndefined();
    expect(rendered.container.textContent).toContain('Beta Deck');
    expect(toastMocks.success).not.toHaveBeenCalledWith('Job scheduled.');
    expect(dndMocks.latestBoardProps.mutationNotice).toBeNull();

    rendered.unmount();
  });
});
