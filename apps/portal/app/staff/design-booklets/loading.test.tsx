import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Loading from './loading';

let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

describe('Design Booklet loading frame', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
  });

  it('keeps the standalone route-owned rail and A4 preview structure visible', () => {
    const markup = renderToStaticMarkup(<Loading />);

    expect(markup).toContain('data-portal-page-shell="design-booklets"');
    expect(markup).toContain('data-portal-page-shell-ready="true"');
    expect(markup).toContain('data-design-booklet-mode="standalone"');
    expect(markup).toContain('data-design-booklet-background-ready="true"');
    expect(markup).toContain('data-portal-shell-region="design-booklets-controls"');
    expect(markup).toContain('data-portal-shell-region="design-booklets-preview"');
    expect(markup).toContain('Booklet structure');
    expect(markup).toContain('Landscape A4 booklet preview');
    expect(markup).toContain('Loading booklet preview');
    expect(markup).toContain('Standalone booklet');
    expect(markup).toContain('Preview only · not saved');
    expect(markup).not.toContain('Return to project');
  });

  it('adds the live return action and pending project state for a linked booklet', () => {
    searchParams = new URLSearchParams('projectId=proj_hello%20world');
    const markup = renderToStaticMarkup(<Loading />);

    expect(markup).toContain('data-design-booklet-mode="project"');
    expect(markup).toContain('data-project-id="proj_hello world"');
    expect(markup).toContain('data-project-state="pending"');
    expect(markup).toContain('data-design-booklet-background-ready="false"');
    expect(markup).toContain('href="/staff/projects/proj_hello%20world"');
    expect(markup).toContain('Return to project');
    expect(markup).toContain('Loading project');
  });
});
