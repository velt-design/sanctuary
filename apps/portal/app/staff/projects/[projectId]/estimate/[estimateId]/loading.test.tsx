import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EstimateViewerLoading from './loading';

let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useParams: () => ({
    projectId: 'proj_hello%20world',
    estimateId: 'estimate_1',
  }),
  useSearchParams: () => searchParams,
}));

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('nested estimate loading frame', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
  });

  it('keeps the project and estimate identities in the exact job-pack workspace', () => {
    searchParams = new URLSearchParams('sheet=labour');
    const markup = renderToStaticMarkup(<EstimateViewerLoading />);

    expect(markup).toContain('data-project-id="proj_hello world"');
    expect(markup).toContain('data-project-estimate-id="estimate_1"');
    expect(markup).toContain('data-portal-page-shell="project-job-pack-detail"');
    expect(markup).toContain('value="labour" selected=""');
    expect(markup).toContain('aria-label="Job pack Labour"');
    expect(markup).not.toContain('data-portal-instant-shell');
  });

  it('uses the live route default sheet when no sheet query is supplied', () => {
    const markup = renderToStaticMarkup(<EstimateViewerLoading />);
    expect(markup).toContain('value="materials" selected=""');
    expect(markup).toContain('aria-label="Job pack Materials"');
  });
});
