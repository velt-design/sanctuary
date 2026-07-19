import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectMainTabs from './ProjectMainTabs';

const replaceMock = vi.fn();
const prefetchQueryMock = vi.fn();
const preloadModuleMock = vi.fn();
const preloadProjectDetailsMock = vi.fn();
let mockSearchParams = 'tab=estimates';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/staff/projects/proj_1',
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    prefetchQuery: prefetchQueryMock,
  }),
}));

vi.mock('./projectTabModules', () => ({
  ActivityTab: () => <div data-testid="activity-tab" />,
  EmailsTab: () => <div data-testid="emails-tab" />,
  EstimatesTab: () => <div data-testid="estimates-tab" />,
  InvoicesTab: () => <div data-testid="invoices-tab" />,
  JobPacksTab: () => <div data-testid="job-packs-tab" />,
  QuotesTab: () => <div data-testid="quotes-tab" />,
  preloadProjectTab: (...args: unknown[]) => preloadModuleMock(...args),
}));

vi.mock('./projectDetailsModule', () => ({
  LazyProjectDetailsSidebar: () => <div data-testid="details-tab" />,
  preloadProjectDetails: (...args: unknown[]) => preloadProjectDetailsMock(...args),
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
    preloadModuleMock.mockReset();
    preloadProjectDetailsMock.mockReset();
    mockSearchParams = 'tab=estimates';
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

  it('renders Details only when the stacked layout asks for it', () => {
    const wide = renderIntoDocument(<ProjectMainTabs snapshot={snapshot} tab="estimates" />);
    const wideButtons = Array.from(wide.container.querySelectorAll('[role="tab"]')).map((node) => node.textContent?.trim());
    expect(wideButtons).not.toContain('Details');
    wide.unmount();

    const stacked = renderIntoDocument(<ProjectMainTabs snapshot={snapshot} showDetailsTab tab="estimates" />);
    const stackedButtons = Array.from(stacked.container.querySelectorAll('[role="tab"]')).map((node) => node.textContent?.trim());
    expect(stackedButtons).toContain('Details');
    stacked.unmount();
  });

  it('renders project details from the Details tab when stacked', () => {
    mockSearchParams = 'tab=details';
    const rendered = renderIntoDocument(<ProjectMainTabs snapshot={snapshot} showDetailsTab tab="activity" />);

    expect(rendered.container.querySelector('[data-testid="details-tab"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="activity-tab"]')).toBeNull();

    rendered.unmount();
  });

  it('coerces the Details tab back to Activity when details are already available in the desktop rail', () => {
    mockSearchParams = 'tab=details';
    const rendered = renderIntoDocument(<ProjectMainTabs snapshot={snapshot} tab="details" />);

    expect(rendered.container.querySelector('[data-testid="activity-tab"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="details-tab"]')).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith('/staff/projects/proj_1?tab=activity');

    rendered.unmount();
  });

  it('does not present placeholder activity as an empty activity feed', () => {
    mockSearchParams = 'tab=activity';
    const rendered = renderIntoDocument(
      <ProjectMainTabs snapshot={snapshot} snapshotContentReady={false} snapshotState="summary" tab="activity" />,
    );

    expect(rendered.container.querySelector('[data-project-tab-awaiting-snapshot="activity"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Updating activity in the background');
    expect(rendered.container.querySelector('[data-testid="activity-tab"]')).toBeNull();

    rendered.unmount();
  });

  it('preloads both tab code and tab data from user intent', () => {
    const rendered = renderIntoDocument(<ProjectMainTabs snapshot={snapshot} tab="estimates" />);
    const quotes = Array.from(rendered.container.querySelectorAll('[role="tab"]')).find(
      (node) => node.textContent?.trim() === 'Quotes',
    );

    act(() => {
      quotes?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(preloadModuleMock).toHaveBeenCalledWith('quotes', expect.objectContaining({
      host: 'host',
      projectId: 'proj_1',
    }));

    rendered.unmount();
  });

  it('preloads the Activity workflow from user intent', () => {
    const rendered = renderIntoDocument(<ProjectMainTabs snapshot={snapshot} tab="estimates" />);
    const activity = Array.from(rendered.container.querySelectorAll('[role="tab"]')).find(
      (node) => node.textContent?.trim() === 'Activity',
    );

    act(() => {
      activity?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });

    expect(preloadModuleMock).toHaveBeenCalledWith('activity', expect.objectContaining({
      host: 'host',
      projectId: 'proj_1',
    }));

    rendered.unmount();
  });

  it('preloads the responsive Details workflow from user intent', () => {
    const rendered = renderIntoDocument(<ProjectMainTabs snapshot={snapshot} showDetailsTab tab="estimates" />);
    const details = Array.from(rendered.container.querySelectorAll('[role="tab"]')).find(
      (node) => node.textContent?.trim() === 'Details',
    );

    act(() => {
      details?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(preloadProjectDetailsMock).toHaveBeenCalledOnce();
    expect(preloadModuleMock).not.toHaveBeenCalledWith('details', expect.anything());
    rendered.unmount();
  });
});
