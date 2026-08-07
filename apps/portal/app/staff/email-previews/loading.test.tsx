import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EmailPreviewPendingFrame from './EmailPreviewPendingFrame';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe('Email preview loading frame', () => {
  it('keeps controls and all three design canvases visible while HTML renders', () => {
    const markup = renderToStaticMarkup(<EmailPreviewPendingFrame qaFixture />);

    expect(markup).toContain('data-portal-page-shell="email-previews"');
    expect(markup).toContain('data-portal-page-shell-ready="true"');
    expect(markup).toContain('Choose the enquiry');
    expect(markup).toContain('Compare the emails');
    expect(markup).toContain('Send for review');
    expect(markup).toContain('Compare three design directions');
    expect(markup).toContain('data-portal-shell-region="email-previews-canvas"');
    expect(markup).toContain('data-portal-value-slot="loading"');
  });
});
