import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Loading from './loading';

describe('Dashboard loading frame', () => {
  it('shows a truthful non-blocking Dashboard frame', () => {
    const markup = renderToStaticMarkup(<Loading />);

    expect(markup).toContain('data-dashboard-state="pending"');
    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Updating dashboard...');
    expect(markup).not.toContain('data-blueprint-loading');
  });
});
