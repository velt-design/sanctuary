import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../components/products/ProductExamplePrice', () => ({ default: () => <div>Example installed estimate</div> }));
import HomePergolaSelection from './HomePergolaSelection';

describe('homepage product entry', () => {
  it('links all three rooflines to product pages, retaining bespoke and professional pathways', () => {
    const html = renderToStaticMarkup(<HomePergolaSelection onSelect={vi.fn()} selected="bespoke"/>);
    for (const type of ['pitched', 'gable', 'box-perimeter']) expect(html).toContain(`href="/products/pergolas/${type}"`);
    expect(html).not.toContain('/pergolas/hip');
    expect(html).toContain('href="/products"');
    expect(html).toContain('data-project-direction="bespoke" aria-expanded="true"');
    expect(html).toContain('data-project-direction="commercial-professional"');
    expect(html.match(/Example installed estimate/g)).toHaveLength(3);
    expect(html).toContain('6 × 3 m, acrylic roof and open sides');
    expect(html).toContain('About these estimates');
    expect(html).toContain('pitched-v2.webp');
    expect(html).toContain('box-v2.webp');
    expect(html).toContain('gable-v1.webp');
    expect(html).not.toContain('role="radio"');
  });
});
