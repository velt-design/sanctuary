import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleLegacyFallbackClient from './ScheduleLegacyFallbackClient';
import { renderIntoDocument } from '../../../../../test/reactHarness';
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
vi.mock('@/lib/queries/scheduleDiagnostics', () => ({
  runScheduleDiagnostics: vi.fn(),
}));
vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
  supabaseHostFromUrl: () => 'example.supabase.co',
}));

function renderLegacyFallback() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const rendered = renderIntoDocument(
    <QueryClientProvider client={queryClient}>
      <ScheduleLegacyFallbackClient
        initialReason="server-schema-not-ready"
        today="2026-04-07"
        initialView="board"
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
  });

  afterEach(() => {
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

    rendered.unmount();
  });
});
