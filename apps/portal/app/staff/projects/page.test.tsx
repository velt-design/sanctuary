import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StaffProjectsPage from './page';

vi.mock('./ProjectsIndexClient', () => ({
  default: () => <div data-testid="projects-index" />,
}));

describe('StaffProjectsPage', () => {
  it('renders the client entrypoint without awaiting request search params or project data', () => {
    const markup = renderToStaticMarkup(<StaffProjectsPage />);

    expect(markup).toContain('data-testid="projects-index"');
  });
});
