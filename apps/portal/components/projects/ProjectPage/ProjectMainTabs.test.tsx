import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectMainTabs from './ProjectMainTabs';

const replaceMock = vi.fn();
let mockSearchParams = 'tab=estimates';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/staff/projects/proj_1',
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

vi.mock('./projectTabModules', () => ({
  OverviewTab: ({ snapshotContentReady }: { snapshotContentReady: boolean }) => (
    <div data-testid="overview-tab" data-snapshot-ready={String(snapshotContentReady)} />
  ),
  CommercialTab: ({ view, projectName, calculatorWorkspace }: { view: string; projectName: string; calculatorWorkspace: boolean }) => (
    <div
      data-testid="commercial-tab"
      data-view={view}
      data-project-name={projectName}
      data-calculator-workspace={String(Boolean(calculatorWorkspace))}
    />
  ),
  JobPacksTab: () => <div data-testid="job-packs-tab" />,
}));

const snapshot = {
  project: { id: 'proj_1', name: 'Deck Build', stage: 'lead', hasJobPacks: true },
  pipeline: { stage: 'lead' },
  activity: [],
  emails: [],
  notes: [],
} as any;

describe('ProjectMainTabs', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    mockSearchParams = 'tab=estimates';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders Estimates through the Commercial owner at full width', () => {
    const rendered = renderIntoDocument(<ProjectMainTabs host="host" snapshot={snapshot} tab="estimates" />);

    expect(rendered.container.querySelector('[data-testid="commercial-tab"]')?.getAttribute('data-view')).toBe('estimates');
    expect(rendered.container.querySelector('[role="tablist"]')).toBeNull();
    expect(rendered.container.textContent).not.toContain('Details');
    expect(rendered.container.querySelector('[data-project-tab-body="estimates"]')).not.toBeNull();

    rendered.unmount();
  });

  it('passes focused workspace context to the estimate owner', () => {
    const rendered = renderIntoDocument(
      <ProjectMainTabs host="host" snapshot={snapshot} tab="estimates" calculatorWorkspace />,
    );
    const commercial = rendered.container.querySelector('[data-testid="commercial-tab"]');

    expect(commercial?.getAttribute('data-project-name')).toBe('Deck Build');
    expect(commercial?.getAttribute('data-calculator-workspace')).toBe('true');
    rendered.unmount();
  });

  it('normalizes an invalid tab to Overview while preserving the activity key', () => {
    mockSearchParams = 'tab=details&campaign=winter';
    const rendered = renderIntoDocument(<ProjectMainTabs host="host" snapshot={snapshot} tab="details" />);

    expect(rendered.container.querySelector('[data-testid="overview-tab"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-active-tab="activity"]')).not.toBeNull();

    rendered.unmount();
  });

  it('normalizes unavailable Job Packs to Overview', () => {
    mockSearchParams = 'tab=job-packs';
    const rendered = renderIntoDocument(
      <ProjectMainTabs host="host" snapshot={{ ...snapshot, project: { ...snapshot.project, hasJobPacks: false } }} tab="job-packs" />,
    );

    expect(rendered.container.querySelector('[data-testid="overview-tab"]')).not.toBeNull();
    rendered.unmount();
  });

  it('groups quote and invoice routes under the Commercial owner', () => {
    mockSearchParams = 'tab=quotes&quoteId=quote_1&campaign=winter';
    const rendered = renderIntoDocument(<ProjectMainTabs host="host" snapshot={snapshot} tab="quotes" />);
    expect(rendered.container.querySelector('[data-testid="commercial-tab"]')?.getAttribute('data-view')).toBe('quotes');
    rendered.unmount();
  });

  it('renders an optimistic tab body before the URL state settles', () => {
    mockSearchParams = 'tab=activity';
    const rendered = renderIntoDocument(
      <ProjectMainTabs host="host" snapshot={snapshot} tab="activity" optimisticTab="job-packs" />,
    );

    expect(rendered.container.querySelector('[data-testid="job-packs-tab"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-tab-body="job-packs"]')).not.toBeNull();
    rendered.unmount();
  });

  it('renders Overview during summary state so its independent read can settle', () => {
    mockSearchParams = 'tab=activity';
    const rendered = renderIntoDocument(
      <ProjectMainTabs host="host" snapshot={snapshot} snapshotContentReady={false} snapshotState="summary" tab="activity" />,
    );

    expect(rendered.container.querySelector('[data-testid="overview-tab"]')?.getAttribute('data-snapshot-ready')).toBe('false');
    rendered.unmount();
  });
});
