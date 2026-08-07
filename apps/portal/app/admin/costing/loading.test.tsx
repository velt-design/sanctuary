import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Loading from './loading';

describe('Costing control loading frame', () => {
  it('shows the complete control-centre structure before version values settle', () => {
    const markup = renderToStaticMarkup(<Loading />);

    expect(markup).toContain('data-portal-page-shell="admin-costing"');
    expect(markup).toContain('data-portal-page-shell-ready="true"');
    expect(markup).toContain('data-costing-background-ready="false"');
    expect(markup).toContain('Costing control centre');
    expect(markup).toContain('Edit settings');
    expect(markup).toContain('Pricing configuration status');
    expect(markup).toContain('Version history');
    expect(markup).toContain('Publication audit note');
    expect(markup).toContain('data-portal-shell-region="admin-costing-workflow"');
    expect(markup).toContain('data-portal-shell-region="admin-costing-history"');
    expect(markup).toContain('data-portal-value-slot="loading"');
  });
});
