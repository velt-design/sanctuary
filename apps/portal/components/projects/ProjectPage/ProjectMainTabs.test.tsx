import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectMainTabs from './ProjectMainTabs';

const replaceMock = vi.fn();
const prefetchQueryMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/staff/projects/proj_1',
  useSearchParams: () => new URLSearchParams('tab=estimates'),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    prefetchQuery: prefetchQueryMock,
  }),
}));

vi.mock('./tabs/ActivityTab', () => ({
  default: () => <div data-testid="activity-tab" />,
}));

vi.mock('./tabs/EmailsTab', () => ({
  default: () => <div data-testid="emails-tab" />,
}));

vi.mock('./tabs/EstimatesTab', () => ({
  default: () => <div data-testid="estimates-tab" />,
}));

vi.mock('./tabs/InvoicesTab', () => ({
  default: () => <div data-testid="invoices-tab" />,
}));

vi.mock('./tabs/JobPacksTab', () => ({
  default: () => <div data-testid="job-packs-tab" />,
}));

vi.mock('./tabs/QuotesTab', () => ({
  default: () => <div data-testid="quotes-tab" />,
}));

vi.mock('@/lib/queries/invoices', () => ({
  depositInvoicesByProjectQueryOptions: () => ({}),
}));

vi.mock('@/lib/queries/projectEstimates', () => ({
  estimateMetasByProjectQueryOptions: () => ({}),
}));

vi.mock('@/lib/queries/quotes', () => ({
  quoteVersionsByProjectQueryOptions: () => ({}),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

const snapshot = {
  project: {
    id: 'proj_1',
    name: 'Deck Build',
    stage: 'lead',
    hasJobPacks: true,
  },
  pipeline: {
    stage: 'lead',
  },
  tasks: {
    stage: 'lead',
    items: [],
  },
  activity: [],
  emails: [],
  notes: [],
} as any;

describe('ProjectMainTabs', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    prefetchQueryMock.mockReset();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not render the removed Files tab', () => {
    const rendered = renderIntoDocument(<ProjectMainTabs snapshot={snapshot} tab="estimates" />);

    const tabButtons = Array.from(rendered.container.querySelectorAll('[role="tab"]')).map((node) => node.textContent?.trim());

    expect(tabButtons).toContain('Designs');
    expect(tabButtons).toContain('Quotes');
    expect(tabButtons).toContain('Invoices');
    expect(tabButtons).toContain('Job Packs');
    expect(tabButtons).toContain('Emails');
    expect(tabButtons).not.toContain('Files');
    expect(rendered.container.textContent).not.toContain('Upload and manage project files once storage is wired up.');

    rendered.unmount();
  });

  it('renders Activity as the first tab in the strip', () => {
    const rendered = renderIntoDocument(<ProjectMainTabs snapshot={snapshot} tab="estimates" />);

    const tabButtons = Array.from(rendered.container.querySelectorAll('[role="tab"]')).map((node) => node.textContent?.trim());

    expect(tabButtons[0]).toBe('Activity');

    rendered.unmount();
  });
});
