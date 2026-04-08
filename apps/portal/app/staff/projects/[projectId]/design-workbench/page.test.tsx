import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DesignWorkbenchPage from './page';

const getProjectPageSnapshotMock = vi.fn();

vi.mock('@/lib/projects/getProjectPageSnapshot', () => ({
  getProjectPageSnapshot: (...args: unknown[]) => getProjectPageSnapshotMock(...args),
}));

describe('DesignWorkbenchPage', () => {
  it('renders an unavailable state for invalid ids', async () => {
    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: '   ' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('Invalid project id.');
  });

  it('renders an unavailable state when the project snapshot is missing', async () => {
    getProjectPageSnapshotMock.mockResolvedValue(null);

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(getProjectPageSnapshotMock).toHaveBeenCalledWith('proj_1');
    expect(markup).toContain('Project unavailable');
    expect(markup).toContain('We could not load this project.');
  });

  it('renders the hidden workbench placeholder for a valid project', async () => {
    getProjectPageSnapshotMock.mockResolvedValue({
      project: { id: 'proj_1', name: 'Deck Build', stage: 'new' },
      pipeline: { stage: 'new' },
      tasks: { stage: 'new', items: [] },
      activity: [],
      emails: [],
    });

    const ui = (await DesignWorkbenchPage({
      params: Promise.resolve({ projectId: 'proj_1' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Design Workbench');
    expect(markup).toContain('Deck Build');
    expect(markup).toContain('Sanctuary Geometry Workbench scaffold');
    expect(markup).toContain('href="/staff/projects/proj_1"');
    expect(markup).toContain('data-project-id="proj_1"');
  });
});
