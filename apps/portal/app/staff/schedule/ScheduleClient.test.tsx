import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleClient from './ScheduleClient';
import { qk } from '@/lib/queries/keys';
import type { ScheduleV2Snapshot } from '@/lib/queries/schedule';
import { renderIntoDocument } from '../../../../../test/reactHarness';

const routerReplace = vi.fn();
const routerPush = vi.fn();
const scheduleSnapshotQueryOptions = vi.fn();

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
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
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

describe('ScheduleClient', () => {
  beforeEach(() => {
    routerReplace.mockReset();
    routerPush.mockReset();
    scheduleSnapshotQueryOptions.mockReset();
    scheduleSnapshotQueryOptions.mockImplementation((host: string, today: string) => ({
      queryKey: qk.schedule.board(host, today),
      queryFn: async () => initialSnapshot,
    }));
  });

  afterEach(() => {
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
});
