import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
const reply = vi.hoisted(() => ({ price: null as unknown, review: null as unknown }));
vi.mock('../configurator-prototype/useConfiguratorPrice', () => ({ useConfiguratorPrice: () => ({ price: reply.price, retry: vi.fn() }) }));
vi.mock('../configurator-prototype/useReviewPrice', () => ({ useReviewPrice: () => reply.review }));
import ProductComparisonPrice from './ProductComparisonPrice';
import { INITIAL_PRODUCT_SELECTION, productSelectionDraft } from './productSelection';
import { solvePergolaPreview } from '../configurator-prototype/solvePreview';

afterEach(() => { vi.unstubAllEnvs(); reply.price = null; reply.review = null; });
describe('overview comparison price boundaries', () => {
  it('labels complete development estimates as draft', () => {
    vi.stubEnv('NODE_ENV', 'development');
    reply.price = { status: 'disabled' };
    reply.review = { status: 'priced', amount: 12345, excluded: [] };
    const html = renderToStaticMarkup(<ProductComparisonPrice type="gable"/>);
    expect(html).toContain('$12,300');
    expect(html).toContain('Draft estimate');
    expect(html).toContain('not a published offer');
  });
  it('withholds partial estimates and never exposes review pricing in production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    reply.price = { status: 'disabled' };
    reply.review = { status: 'priced', amount: 12345, excluded: ['blinds'] };
    expect(renderToStaticMarkup(<ProductComparisonPrice type="gable"/>)).not.toContain('$12,300');
    vi.stubEnv('NODE_ENV', 'production');
    reply.review = { status: 'priced', amount: 12345, excluded: [] };
    const html = renderToStaticMarkup(<ProductComparisonPrice type="gable"/>);
    expect(html).not.toContain('$12,300');
    expect(html).toContain('Estimate unavailable');
    expect(html).toContain('Retry estimate');
  });
  it('uses approved prices when supplied and leaves loading explicit', () => {
    expect(renderToStaticMarkup(<ProductComparisonPrice type="pitched"/>)).toContain('Updating estimate');
    reply.price = { status: 'priced', amountIncGst: 14500, breakdown: [] };
    const html = renderToStaticMarkup(<ProductComparisonPrice type="pitched"/>);
    expect(html).toContain('$14,500');
    expect(html).not.toContain('Draft estimate');
  });
  it('ties selected dimensions to the approximate installed presentation', () => {
    reply.price = { status: 'priced', amountIncGst: 14551, breakdown: [] };
    const html = renderToStaticMarkup(<ProductComparisonPrice type="pitched" selection={{widthMm:6000,projectionMm:5000,material:'acrylic',sides:'open',orientation:'parallel'}}/>);
    expect(html).toContain('6 × 5 m');
    expect(html).toContain('Including installation');
    expect(html).toContain('Approximately ');
    expect(html).toContain('$14,600');
  });
});

describe('overview supported comparison geometry', () => {
  for (const type of ['pitched', 'gable', 'box-perimeter'] as const) {
    for (const [widthMm, projectionMm] of [[2000,3000],[4000,3000],[6000,3000],[8000,3000],[6000,4000],[6000,5000]]) {
      it(`${type} ${widthMm} x ${projectionMm} uses supported canonical geometry`, () => {
        const { draft, issue } = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, widthMm, projectionMm }, type);
        expect(issue).toBeNull();
        expect(solvePergolaPreview(draft.input, draft.roof).geometry).toBeDefined();
      });
    }
  }
});
