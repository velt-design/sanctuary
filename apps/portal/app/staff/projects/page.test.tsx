import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StaffProjectsPage from './page';

const loadProjectsIndexDataMock = vi.fn();

vi.mock('@/lib/projects/serverProjectsIndex', () => ({
  loadProjectsIndexData: (...args: unknown[]) => loadProjectsIndexDataMock(...args),
}));

vi.mock('./ProjectsIndexClient', () => ({
  default: (props: {
    initialProjects: Array<{ projectName?: string; name?: string }>;
    initialFilters: { query: string; statusFilter: string; dueFilter: string; archiveFilter: string };
  }) => (
    <div
      data-testid="projects-index"
      data-query={props.initialFilters.query}
      data-status={props.initialFilters.statusFilter}
      data-due={props.initialFilters.dueFilter}
      data-archive={props.initialFilters.archiveFilter}
    >
      {props.initialProjects.map((project) => project.projectName ?? project.name ?? '').join(',')}
    </div>
  ),
}));

describe('StaffProjectsPage', () => {
  it('loads projects on the server and passes parsed filter props into the client entrypoint', async () => {
    loadProjectsIndexDataMock.mockResolvedValue({
      projects: [{ id: 'proj_1', projectName: 'Deck Build' }],
      contacts: [],
    });

    const ui = (await StaffProjectsPage({
      searchParams: Promise.resolve({ q: 'deck', status: 'sent', due: 'today' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(loadProjectsIndexDataMock).toHaveBeenCalledWith(undefined, { archiveFilter: 'active' });
    expect(markup).toContain('data-query="deck"');
    expect(markup).toContain('data-status="SENT"');
    expect(markup).toContain('data-due="today"');
    expect(markup).toContain('data-archive="active"');
    expect(markup).toContain('Deck Build');
  });

  it('forwards the archive filter to the server loader', async () => {
    loadProjectsIndexDataMock.mockResolvedValue({ projects: [], contacts: [] });

    const ui = (await StaffProjectsPage({
      searchParams: Promise.resolve({ archive: 'archived' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(loadProjectsIndexDataMock).toHaveBeenCalledWith(undefined, { archiveFilter: 'archived' });
    expect(markup).toContain('data-archive="archived"');
  });
});
