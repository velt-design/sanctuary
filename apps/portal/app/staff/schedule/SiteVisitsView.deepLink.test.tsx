import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SiteVisitCalendarItem,
  SiteVisitProjectFocus,
  SiteVisitsSnapshotV1,
} from '@/lib/types/siteVisits';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import SiteVisitsView from './SiteVisitsView';

let searchParamsString = '';

const mocks = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  setQueryData: vi.fn(),
  refetch: vi.fn(),
  modalProps: null as any,
  queryData: null as SiteVisitsSnapshotV1 | null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.routerReplace }),
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData: mocks.setQueryData }),
  useQuery: () => ({
    data: mocks.queryData,
    error: null,
    isFetching: false,
    refetch: mocks.refetch,
  }),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
  supabaseHostFromUrl: () => 'example.supabase.co',
}));

vi.mock('@/lib/repo/apiClient', () => ({
  ApiError: class ApiError extends Error {},
  apiJson: vi.fn(),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('@/src/config/salesPeople', () => ({
  SALES_PEOPLE: [
    { id: 'bruce', name: 'Bruce' },
    { id: 'steve', name: 'Steve' },
  ],
}));

vi.mock('@/components/schedule/site-visits/SiteVisitEventModal', () => ({
  LINK_NONE: '__none__',
  default: (props: any) => {
    mocks.modalProps = props;
    return props.open ? (
      <div
        data-testid="site-visit-modal"
        data-mode={props.mode}
        data-item-id={props.item?.id ?? ''}
        data-initial-link={props.initialLinkValue ?? ''}
      />
    ) : null;
  },
}));

vi.mock('@/components/schedule/site-visits/SiteVisitHoverPopover', () => ({
  default: () => null,
}));

vi.mock('@/components/schedule/site-visits/SlotSelectPopover', () => ({
  default: () => null,
}));

vi.mock('./UnscheduledSiteVisitCard', () => ({
  default: ({ item }: { item: SiteVisitCalendarItem }) => (
    <div data-unscheduled-id={item.id} />
  ),
}));

vi.mock('./SiteVisitsFeedback', () => ({
  SiteVisitsActionError: () => null,
  SiteVisitsRefreshFeedback: () => null,
}));

vi.mock('@/components/ui/modal/Modal', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (
    open ? <div>{children}</div> : null
  ),
}));

function item(overrides: Partial<SiteVisitCalendarItem> = {}): SiteVisitCalendarItem {
  return {
    id: 'sv_visit-1',
    projectId: 'proj_project-1',
    status: 'TENTATIVE',
    scheduledStart: '2026-08-12T12:00:00.000Z',
    scheduledEnd: '2026-08-12T13:00:00.000Z',
    salespersonId: 'bruce',
    notes: null,
    customerNotified: false,
    lastNotifiedAt: null,
    cancelReason: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    priorityTier: 1,
    project: {
      id: 'proj_project-1',
      name: 'Project One',
      region: 'Auckland',
      siteAddress: '1 Test Street',
      pipelineStage: 'SITE_VISIT',
    },
    contact: {
      id: 'ct_contact-1',
      name: 'Jamie',
      email: 'jamie@example.com',
      phone: '021',
    },
    ...overrides,
  };
}

function snapshot(projectFocus: SiteVisitProjectFocus): SiteVisitsSnapshotV1 {
  return {
    host: 'example.supabase.co',
    rangeFrom: '2026-07-27T00:00:00.000Z',
    rangeTo: '2026-08-02T23:59:59.000Z',
    salesOwnerId: null,
    generatedAt: '2026-07-30T00:00:00.000Z',
    unscheduled: [],
    events: [],
    salesPeople: [],
    projectFocus,
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('SiteVisitsView project deep links', () => {
  beforeEach(() => {
    searchParamsString = '';
    mocks.routerReplace.mockReset();
    mocks.setQueryData.mockReset();
    mocks.refetch.mockReset();
    mocks.refetch.mockResolvedValue(undefined);
    mocks.modalProps = null;
    mocks.queryData = null;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('switches to the visit week, removes a conflicting owner filter, and opens the booking', async () => {
    const focused = item();
    mocks.queryData = snapshot({ kind: 'scheduled', item: focused });
    searchParamsString = 'view=site-visits&week=2026-07-27&salesOwnerId=steve&project=proj_project-1';

    const rendered = renderIntoDocument(<SiteVisitsView />);
    await flushEffects();

    expect(mocks.routerReplace).toHaveBeenCalledTimes(1);
    const href = String(mocks.routerReplace.mock.calls[0]?.[0]);
    expect(href).toContain('view=site-visits');
    expect(href).toContain('project=proj_project-1');
    expect(href).toContain('week=2026-08-10');
    expect(href).toContain('highlightSiteVisitId=sv_visit-1');
    expect(href).not.toContain('salesOwnerId=');
    expect(mocks.modalProps.open).toBe(false);

    searchParamsString = 'view=site-visits&week=2026-08-10&project=proj_project-1&highlightSiteVisitId=sv_visit-1';
    rendered.rerender(<SiteVisitsView />);
    await flushEffects();

    expect(mocks.modalProps).toMatchObject({
      open: true,
      mode: 'edit',
      item: focused,
    });
    expect(rendered.container.querySelector('[data-testid="site-visit-modal"]')?.getAttribute('data-item-id')).toBe('sv_visit-1');
    rendered.unmount();
  });

  it('opens a create modal prelinked to the project when no visit exists', async () => {
    const createTarget = item({
      id: 'project:proj_project-1',
      status: 'UNSCHEDULED',
      scheduledStart: null,
      scheduledEnd: null,
      salespersonId: null,
    });
    mocks.queryData = snapshot({ kind: 'create', item: createTarget });
    searchParamsString = 'view=site-visits&week=2026-07-27&project=proj_project-1';

    const rendered = renderIntoDocument(<SiteVisitsView />);
    await flushEffects();

    expect(mocks.routerReplace).not.toHaveBeenCalled();
    expect(mocks.modalProps).toMatchObject({
      open: true,
      mode: 'create',
      initialLinkValue: 'project:proj_project-1',
      focusLinked: true,
    });
    expect(mocks.modalProps.unscheduled).toContainEqual(createTarget);
    expect(rendered.container.querySelector('[data-testid="site-visit-modal"]')?.getAttribute('data-initial-link')).toBe('project:proj_project-1');

    act(() => mocks.modalProps.onClose());
    mocks.queryData = snapshot({
      kind: 'scheduled',
      item: item({
        id: 'sv_newly-booked',
        scheduledStart: '2026-09-02T12:00:00.000Z',
        scheduledEnd: '2026-09-02T13:00:00.000Z',
        updatedAt: '2026-08-03T00:00:00.000Z',
      }),
    });
    rendered.rerender(<SiteVisitsView />);
    await flushEffects();

    expect(mocks.modalProps.open).toBe(false);
    expect(mocks.routerReplace).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
