import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StaffProjectsPage from './page';

vi.mock('./ProjectsIndexClient', () => ({
  default: (props: {
    initialFilters: { query: string; statusFilter: string; dueFilter: string; archiveFilter: string };
  }) => (
    <div
      data-testid="projects-index"
      data-query={props.initialFilters.query}
      data-status={props.initialFilters.statusFilter}
      data-due={props.initialFilters.dueFilter}
      data-archive={props.initialFilters.archiveFilter}
    />
  ),
}));

describe('StaffProjectsPage', () => {
  it('renders the client entrypoint without waiting for project data', async () => {
    const ui = (await StaffProjectsPage({
      searchParams: Promise.resolve({ q: 'deck', status: 'sent', due: 'today' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-query="deck"');
    expect(markup).toContain('data-status="SENT"');
    expect(markup).toContain('data-due="today"');
    expect(markup).toContain('data-archive="active"');
  });

  it('passes the archive filter to the client query boundary', async () => {
    const ui = (await StaffProjectsPage({
      searchParams: Promise.resolve({ archive: 'archived' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-archive="archived"');
  });
});
