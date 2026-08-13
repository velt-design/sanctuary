import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleLegacyFallbackClient from './ScheduleLegacyFallbackClient';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { qk } from '@/lib/queries/keys';
import { listAllEstimates } from '@/lib/repo/estimatesRepo';
import { listInstallers } from '@/lib/repo/installersRepo';
import { listProjects } from '@/lib/repo/projectsRepo';
import { listScheduleItems, normalizeScheduleItemsStarted } from '@/lib/repo/scheduleRepo';

const routerReplace = vi.fn();
const routerPush = vi.fn();
const transitionMocks = vi.hoisted(() => ({
  beginRouteTransition: vi.fn(),
}));
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
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
    if (typeof props?.onDrop === 'function') {
      return (
        <div>
          <aside aria-label="Unscheduled jobs">
            <h2>Unscheduled</h2>
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
    return null;
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: routerReplace,
    push: routerPush,
  }),
  useSearchParams: () => new URLSearchParams('view=board'),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => toastMocks,
}));

vi.mock('@/components/page-state/PortalRouteTransition', () => ({
  usePortalRouteTransition: () => ({
    beginRouteTransition: transitionMocks.beginRouteTransition,
  }),
}));

vi.mock('@/lib/repo/installersRepo', () => ({ listInstallers: vi.fn() }));
vi.mock('@/lib/repo/projectsRepo', () => ({ getProject: vi.fn(), listProjects: vi.fn() }));
vi.mock('@/lib/repo/estimatesRepo', () => ({ listAllEstimates: vi.fn() }));
vi.mock('@/lib/repo/scheduleRepo', () => ({
  confirmScheduleItem: vi.fn(),
  listScheduleItems: vi.fn(),
  normalizeScheduleItemsStarted: vi.fn(),
  replaceScheduleItems: vi.fn(),
  unlockScheduleItem: vi.fn(),
}));
vi.mock('@/lib/queries/scheduleDiagnostics', () => ({
  runScheduleDiagnostics: vi.fn(),
}));
vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
  supabaseHostFromUrl: () => 'example.supabase.co',
}));

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

function renderLegacyFallback(options?: {
  initialReason?: 'server-schema-not-ready' | 'client-schema-not-ready';
  seedCache?: boolean;
  initialView?: 'board' | 'gantt';
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  if (options?.seedCache) {
    queryClient.setQueryData(qk.schedule.snapshot('example.supabase.co'), {
      generatedAt: '2026-04-07T00:00:00.000Z',
      host: 'example.supabase.co',
      crews: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Cached Crew',
          color: '#0f766e',
          is_active: true,
          sort_order: 0,
        },
      ],
      scheduleItems: [
        {
          id: '00000000-0000-4000-8000-000000000301',
          crew_id: '00000000-0000-4000-8000-000000000001',
          project_id: '00000000-0000-4000-8000-000000000101',
          estimate_id: '00000000-0000-4000-8000-000000000201',
          start_date: '2026-04-08',
          end_date: '2026-04-09',
          duration_days: 1,
          sort_order: 0,
          updated_at: '2026-04-07T00:00:00.000Z',
          status: 'TENTATIVE',
        },
      ],
      projectsIndex: [
        {
          id: '00000000-0000-4000-8000-000000000101',
          name: 'Cached Project',
          pipeline_stage: 'DEPOSIT',
          follow_up_date: '2026-04-10',
        },
      ],
    });
  }

  const rendered = renderIntoDocument(
    <QueryClientProvider client={queryClient}>
      <ScheduleLegacyFallbackClient
        initialReason={options?.initialReason ?? 'server-schema-not-ready'}
        today="2026-04-07"
        initialView={options?.initialView ?? 'board'}
      />
    </QueryClientProvider>,
  );

  return { queryClient, rendered };
}

describe('ScheduleLegacyFallbackClient', () => {
  beforeEach(() => {
    routerReplace.mockReset();
    routerPush.mockReset();
    transitionMocks.beginRouteTransition.mockReset();
    toastMocks.error.mockReset();
    toastMocks.success.mockReset();
    toastMocks.info.mockReset();
    vi.mocked(listInstallers).mockResolvedValue([
      {
        id: 'crew_alpha',
        name: 'Crew Alpha',
        color: '#0f766e',
        active: true,
        sortOrder: 0,
      },
    ]);
    vi.mocked(listScheduleItems).mockResolvedValue([
      {
        id: 'sch_alpha',
        projectId: 'proj_alpha',
        estimateId: 'est_alpha',
        installerId: 'crew_alpha',
        sortIndex: 0,
        scheduleStatus: 'TENTATIVE',
        locked: false,
        startDateOverride: '2026-04-08',
        durationHoursOverride: 9,
        updatedAt: '2026-04-07T00:00:00.000Z',
      },
    ]);
    vi.mocked(listProjects).mockResolvedValue([
      {
        id: 'proj_alpha',
        createdAt: '2026-04-01T00:00:00.000Z',
        projectName: 'Alpha Deck',
        status: 'DEPOSIT',
        nextActionDate: '2026-04-10',
      },
      {
        id: 'proj_beta',
        createdAt: '2026-04-01T00:00:00.000Z',
        projectName: 'Beta Pergola',
        status: 'DEPOSIT',
        nextActionDate: '2026-04-11',
      },
    ] as any);
    vi.mocked(listAllEstimates).mockResolvedValue([
      {
        id: 'est_alpha',
        projectId: 'proj_alpha',
        createdAt: '2026-04-01T00:00:00.000Z',
        status: 'draft',
        inputs: {},
        outputs: { install: { totals: { crew_minutes: 540 } } },
        derived: {},
        configVersions: {},
      },
      {
        id: 'est_beta',
        projectId: 'proj_beta',
        createdAt: '2026-04-02T00:00:00.000Z',
        status: 'draft',
        inputs: {},
        outputs: { install: { totals: { crew_minutes: 1080 } } },
        derived: {},
        configVersions: {},
      },
    ] as any);
    vi.mocked(normalizeScheduleItemsStarted).mockResolvedValue({ updated: 0 } as any);
    sendBeaconMock.mockReset();
    sendBeaconMock.mockReturnValue(true);
    vi.stubGlobal('Blob', TestBeaconBlob);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeaconMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('loads legacy installers, projects, estimates, and schedule items into the Board view', async () => {
    const { rendered } = renderLegacyFallback();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listInstallers).toHaveBeenCalled();
    expect(listScheduleItems).toHaveBeenCalled();
    expect(listProjects).toHaveBeenCalled();
    expect(listAllEstimates).toHaveBeenCalled();
    expect(rendered.container.textContent).toContain('Legacy schedule fallback');
    expect(rendered.container.textContent).toContain('Crew Alpha');
    expect(rendered.container.textContent).toContain('Alpha Deck');
    expect(rendered.container.textContent).toContain('Beta Pergola');
    await expect(scheduleTelemetryPayloads()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: 'legacy_fallback_mounted',
        view: 'legacy',
        reason: 'server-schema-not-ready',
        meta: expect.objectContaining({
          initialReason: 'server-schema-not-ready',
          loadSource: 'component',
        }),
      }),
      expect.objectContaining({
        event: 'legacy_fallback_hydrated',
        view: 'legacy',
        reason: 'server-schema-not-ready',
        counts: expect.objectContaining({
          installers: 1,
          projects: 2,
          scheduleItems: 1,
          estimates: 2,
        }),
        meta: expect.objectContaining({ loadSource: 'repo' }),
      }),
    ]));

    rendered.unmount();
  });

  it('reconciles Board and Gantt when browser navigation changes the server view prop', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const schedule = (initialView: 'board' | 'gantt') => (
      <QueryClientProvider client={queryClient}>
        <ScheduleLegacyFallbackClient
          initialReason="server-schema-not-ready"
          today="2026-04-07"
          initialView={initialView}
        />
      </QueryClientProvider>
    );
    const rendered = renderIntoDocument(schedule('board'));
    await act(async () => { await Promise.resolve(); });

    rendered.rerender(schedule('gantt'));
    const ganttButton = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Gantt');
    expect(ganttButton?.getAttribute('aria-pressed')).toBe('true');
    rendered.unmount();
  });

  it('sends telemetry when the legacy fallback hydrates from cache', async () => {
    const { rendered } = renderLegacyFallback({ seedCache: true });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await expect(scheduleTelemetryPayloads()).resolves.toContainEqual(expect.objectContaining({
      event: 'legacy_fallback_cache_used',
      view: 'legacy',
      counts: expect.objectContaining({
        installers: 1,
        projects: 1,
        scheduleItems: 1,
      }),
      meta: expect.objectContaining({ loadSource: 'cache' }),
    }));

    rendered.unmount();
  });

  it('sends sanitized telemetry when the legacy repo load fails', async () => {
    vi.mocked(listProjects).mockRejectedValueOnce(new Error('Customer Alice Deck failed to load'));
    const { rendered } = renderLegacyFallback({ initialReason: 'client-schema-not-ready' });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const telemetry = await scheduleTelemetryPayloads();
    expect(telemetry).toContainEqual(expect.objectContaining({
      event: 'legacy_fallback_load_failed',
      view: 'legacy',
      reason: 'initial_load_failed',
      meta: expect.objectContaining({
        loadSource: 'repo',
        errorType: 'Error',
      }),
    }));
    expect(JSON.stringify(telemetry)).not.toContain('Alice');
    expect(JSON.stringify(telemetry)).not.toContain('Deck');

    rendered.unmount();
  });
});
