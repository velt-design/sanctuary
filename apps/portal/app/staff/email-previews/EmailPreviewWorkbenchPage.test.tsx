import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EmailPreviewWorkbenchPage from './EmailPreviewWorkbenchPage';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('./EmailPreviewClient', () => ({
  default: () => <section data-portal-shell-region="email-previews-controls" />,
}));

describe('Email preview workbench frame', () => {
  it('publishes the route shell and stable header before preview values load', () => {
    const markup = renderToStaticMarkup(
      <EmailPreviewWorkbenchPage qaFixture />,
    );

    expect(markup).toContain('data-portal-page-shell="email-previews"');
    expect(markup).toContain('data-portal-page-shell-ready="true"');
    expect(markup).toContain('data-portal-shell-region="email-previews-header"');
    expect(markup).toContain('Enquiry email workbench');
  });
});
