import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';

vi.mock('../ProjectTasksSidebar.client', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <section data-testid="mock-tasks-panel" data-project-id={projectId}>Tasks</section>
  ),
}));

vi.mock('./_components/ProjectNotesPanel.client', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <section data-testid="mock-notes-panel" data-project-id={projectId}>Notes</section>
  ),
}));

vi.mock('./_components/ProjectActivityDesignSnapshotBar', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <aside data-testid="mock-snapshot-bar" data-project-id={projectId}>Snapshot</aside>
  ),
}));

import ActivityTab from './ActivityTab';

const snapshot = {
  project: { id: 'proj_1', name: 'Test', stage: 'lead' },
  pipeline: { stage: 'lead' },
  tasks: { stage: 'lead', items: [] },
  activity: [],
  emails: [],
  notes: [],
} as any;

describe('ActivityTab', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the snapshot bar above the tasks and notes columns', () => {
    const rendered = renderIntoDocument(<ActivityTab snapshot={snapshot} />);

    const bar = rendered.container.querySelector('[data-testid="mock-snapshot-bar"]');
    const tasks = rendered.container.querySelector('[data-testid="mock-tasks-panel"]');
    const notes = rendered.container.querySelector('[data-testid="mock-notes-panel"]');

    expect(bar).not.toBeNull();
    expect(tasks).not.toBeNull();
    expect(notes).not.toBeNull();

    // Bar must precede both columns in the document order.
    const barPosition = bar!.compareDocumentPosition(tasks!);
    expect(barPosition & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const barVsNotes = bar!.compareDocumentPosition(notes!);
    expect(barVsNotes & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    rendered.unmount();
  });

  it('passes the project id through to all three children', () => {
    const rendered = renderIntoDocument(<ActivityTab snapshot={snapshot} />);
    expect(rendered.container.querySelector('[data-testid="mock-snapshot-bar"]')?.getAttribute('data-project-id')).toBe('proj_1');
    expect(rendered.container.querySelector('[data-testid="mock-tasks-panel"]')?.getAttribute('data-project-id')).toBe('proj_1');
    expect(rendered.container.querySelector('[data-testid="mock-notes-panel"]')?.getAttribute('data-project-id')).toBe('proj_1');
    rendered.unmount();
  });
});
