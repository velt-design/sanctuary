import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuoteEditorLoading from './loading';

let pathname = '/staff/projects/proj_hello%20world/quotes/quote_1';
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useParams: () => ({
    projectId: 'proj_hello%20world',
    quoteId: 'quote_1',
  }),
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
}));

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('nested quote loading frame', () => {
  beforeEach(() => {
    pathname = '/staff/projects/proj_hello%20world/quotes/quote_1';
    searchParams = new URLSearchParams();
  });

  it('keeps the project identity and exact quote editor mounted', () => {
    const markup = renderToStaticMarkup(<QuoteEditorLoading />);

    expect(markup).toContain('data-project-id="proj_hello world"');
    expect(markup).toContain('data-project-quote-id="quote_1"');
    expect(markup).toContain('data-portal-page-shell="quote-detail"');
    expect(markup).toContain('href="/staff/projects/proj_hello%20world/design-workbench"');
    expect(markup).not.toContain('data-portal-instant-shell');
  });

  it('renders the quote preview for both query and legacy print routes', () => {
    searchParams = new URLSearchParams('quotePreview=1');
    expect(renderToStaticMarkup(<QuoteEditorLoading />)).toContain(
      'data-portal-page-shell="quote-preview"',
    );

    searchParams = new URLSearchParams();
    pathname = '/staff/projects/proj_hello%20world/quotes/quote_1/print';
    expect(renderToStaticMarkup(<QuoteEditorLoading />)).toContain(
      'data-quote-view-mode="preview"',
    );
  });
});
