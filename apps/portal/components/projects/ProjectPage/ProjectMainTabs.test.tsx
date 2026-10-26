import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectMainTabs from './ProjectMainTabs';
import ProjectMainTabsSurface from './ProjectMainTabsSurface';
import { act } from 'react';

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
    ><input aria-label="Unsaved draft" defaultValue="" /></div>
  ),
  FilesTab: ({ projectId }: { projectId: string }) => <div data-testid="files-tab" data-project-id={projectId} />,
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
  it('retires generic reading after access ends but retains explicit current-access recovery', () => {
    const retry = vi.fn();
    const render = (snapshotState: 'pending' | 'unavailable', statusPanel?: React.ReactNode) => <ProjectMainTabsSurface projectId="proj_1" host="host" snapshot={null}
      snapshotState={snapshotState} privateContentReady={false} tab="files" statusPanel={statusPanel} body={<button>Retired record command</button>} />;
    const view = renderIntoDocument(render('pending'));
    const surface = view.container.querySelector('section');
    expect(view.container.textContent).toContain('Reading project');
    view.rerender(render('unavailable'));
    expect(view.container.querySelector('[data-project-tab-body]')?.children).toHaveLength(0);
    expect(view.container.querySelector('section')).toBe(surface);
    view.rerender(render('unavailable', <button onClick={retry}>Retry current access</button>));
    expect(view.container.textContent).not.toContain('Reading project');
    expect(view.container.textContent).not.toContain('Retired record command');
    act(() => view.container.querySelector('button')!.click());
    expect(retry).toHaveBeenCalledOnce();
    view.unmount();
  });
  it('mounts the actual Files owner by protected route identity before nullable project metadata', () => {
    mockSearchParams = 'tab=files';
    const rendered = renderIntoDocument(<ProjectMainTabs host="host" projectId="proj_1" snapshot={null} snapshotContentReady={false} snapshotState="pending" tab="files" />);
    const owner = rendered.container.querySelector('[data-testid="files-tab"]');
    expect(owner?.getAttribute('data-project-id')).toBe('proj_1');
    rendered.rerender(<ProjectMainTabs host="host" projectId="proj_1" snapshot={snapshot} tab="files" />);
    expect(rendered.container.querySelector('[data-testid="files-tab"]')).toBe(owner);
    rendered.unmount();
  });
  it('renders Files as a full project view without Overview cards', () => {
    mockSearchParams = 'tab=files';
    const rendered = renderIntoDocument(<ProjectMainTabs host="host" snapshot={snapshot} tab="files" />);
    expect(rendered.container.querySelector('[data-testid="files-tab"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="overview-tab"]')).toBeNull();
    expect(rendered.container.querySelector('[data-project-active-tab="files"]')).not.toBeNull();
    rendered.unmount();
  });

  it.each(['quotes', 'invoices', 'estimates'])('preserves the %s editor while customer identity hydrates', view => {
    mockSearchParams = `tab=${view}`;
    const rendered = renderIntoDocument(<ProjectMainTabs host="host" snapshot={snapshot} tab={view} />);
    const input = rendered.container.querySelector('input')!;
    input.value = 'Unsaved staff edit';
    for (const contactEmail of ['customer@example.test', 'updated@example.test']) {
      rendered.rerender(<ProjectMainTabs host="host" snapshot={{ ...snapshot,
        project: { ...snapshot.project, contactId: 'contact-one', contactEmail } }} tab={view} />);
      expect(rendered.container.querySelector('input')).toBe(input);
      expect(rendered.container.querySelector('input')?.value).toBe('Unsaved staff edit');
    }
    rendered.unmount();
  });
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
  it('mounts the actual Job Packs owner while metadata/availability is unknown and preserves it when verified', () => {
    mockSearchParams = 'tab=job-packs&estimateId=est_1&sheet=summary';
    const view = renderIntoDocument(<ProjectMainTabs host="host" projectId="proj_1" snapshot={null} snapshotContentReady={false} snapshotState="pending" tab="job-packs" />);
    const owner = view.container.querySelector('[data-testid="job-packs-tab"]');
    expect(owner).not.toBeNull();
    expect(view.container.textContent).not.toContain('Checking Job Packs availability');
    view.rerender(<ProjectMainTabs host="host" projectId="proj_1" snapshot={snapshot} snapshotContentReady snapshotState="fresh" tab="job-packs" />);
    expect(view.container.querySelector('[data-testid="job-packs-tab"]')).toBe(owner);
    view.unmount();
  });

});
