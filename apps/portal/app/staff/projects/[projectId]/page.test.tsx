import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectDetailPage from './page';

const getProjectPageSnapshotMock = vi.fn();

vi.mock('@/lib/projects/getProjectPageSnapshot', () => ({
  getProjectPageSnapshot: (...args: unknown[]) => getProjectPageSnapshotMock(...args),
}));

vi.mock('./ProjectSnapshotPageClient', () => ({
  default: (props: { projectId: string; tab: string; initialSnapshot: { project: { name: string } } }) => (
    <div data-testid="project-page" data-project-id={props.projectId} data-tab={props.tab}>
      {props.initialSnapshot.project.name}
    </div>
  ),
}));

describe('ProjectDetailPage', () => {
  it('renders an unavailable state for invalid ids', async () => {
    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: '   ' }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('Invalid project id.');
  });

  it('renders an unavailable state when the project snapshot is missing', async () => {
    getProjectPageSnapshotMock.mockResolvedValue(null);

    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(getProjectPageSnapshotMock).toHaveBeenCalledWith('proj_1');
    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('We could not load this project.');
  });

  it('loads the snapshot on the server and passes it to the client frame entrypoint', async () => {
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });

    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'quotes' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-project-id="proj_1"');
    expect(markup).toContain('data-tab="quotes"');
    expect(markup).toContain('Deck Build');
  });

  it('coerces removed files tabs back to estimates', async () => {
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });

    const ui = (await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
      searchParams: Promise.resolve({ tab: 'files' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-project-id="proj_1"');
    expect(markup).toContain('data-tab="estimates"');
  });
});
