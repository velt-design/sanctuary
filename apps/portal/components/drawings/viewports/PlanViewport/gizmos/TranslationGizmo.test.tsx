import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TranslationGizmo } from './TranslationGizmo';

function svgWrap(node: ReturnType<typeof TranslationGizmo>): string {
  return renderToStaticMarkup(<svg viewBox="0 0 100 100">{node}</svg>);
}

describe('TranslationGizmo', () => {
  const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 600 };

  it('renders an outline rect at the bounds position with the bounds size', () => {
    const markup = svgWrap(<TranslationGizmo bounds={bounds} />);
    expect(markup).toContain('data-translation-gizmo-outline="true"');
    expect(markup).toMatch(/x="0"[^>]*y="0"[^>]*width="1000"[^>]*height="600"/);
  });

  it('renders eight handles (four corners + four edge midpoints)', () => {
    const markup = svgWrap(<TranslationGizmo bounds={bounds} />);
    for (const id of ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w']) {
      expect(markup).toContain(`data-translation-gizmo-handle="${id}"`);
    }
  });

  it('shifts the outline by the active drag delta', () => {
    const markup = svgWrap(<TranslationGizmo bounds={bounds} delta={{ x: 250, y: -150 }} />);
    expect(markup).toContain('data-translation-gizmo-active="true"');
    expect(markup).toMatch(/x="250"[^>]*y="-150"[^>]*width="1000"[^>]*height="600"/);
  });

  it('reports inactive state when delta is zero', () => {
    const markup = svgWrap(<TranslationGizmo bounds={bounds} delta={{ x: 0, y: 0 }} />);
    expect(markup).toContain('data-translation-gizmo-active="false"');
  });

  it('respects a custom handle size', () => {
    const markup = svgWrap(<TranslationGizmo bounds={bounds} handleSize={40} />);
    expect(markup).toMatch(/width="40"[^>]*height="40"[^>]*data-translation-gizmo-handle="nw"/);
  });
});
