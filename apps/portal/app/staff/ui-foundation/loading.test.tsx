import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Loading from './loading';

describe('UI Foundation loading frame', () => {
  it('keeps all four catalogue regions visible while the specialist examples load', () => {
    const markup = renderToStaticMarkup(<Loading />);

    expect(markup).toContain('data-portal-page-shell="ui-foundation"');
    expect(markup).toContain('data-portal-page-shell-ready="true"');
    expect(markup).toContain('Page header patterns');
    expect(markup).toContain('1. Design tokens');
    expect(markup).toContain('2. Typography scale');
    expect(markup).toContain('3. Components');
    expect(markup).toContain('4. Interaction state reference');
    expect(markup).toContain('data-portal-shell-region="ui-foundation-patterns"');
  });
});
