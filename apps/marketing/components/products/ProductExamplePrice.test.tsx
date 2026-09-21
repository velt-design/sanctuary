import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
const reply = vi.hoisted(() => ({ price: null as unknown, review: null as unknown }));
vi.mock('../configurator-prototype/useConfiguratorPrice', () => ({ useConfiguratorPrice: () => ({ price: reply.price, retry: vi.fn() }) }));
vi.mock('../configurator-prototype/useReviewPrice', () => ({ useReviewPrice: () => reply.review }));
import ProductExamplePrice from './ProductExamplePrice';

afterEach(() => { vi.unstubAllEnvs(); reply.price = null; reply.review = null; });
describe('product example price boundaries', () => {
  it('labels complete development estimates as draft', () => {
    vi.stubEnv('NODE_ENV', 'development');
    reply.price = { status: 'disabled' };
    reply.review = { status: 'priced', amount: 12345, excluded: [] };
    const html = renderToStaticMarkup(<ProductExamplePrice type="gable"/>);
    expect(html).toContain('$12,345');
    expect(html).toContain('Draft example estimate');
    expect(html).toContain('not a published offer');
  });
  it('withholds partial estimates and never exposes review pricing in production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    reply.price = { status: 'disabled' };
    reply.review = { status: 'priced', amount: 12345, excluded: ['blinds'] };
    expect(renderToStaticMarkup(<ProductExamplePrice type="gable"/>)).not.toContain('$12,345');
    vi.stubEnv('NODE_ENV', 'production');
    reply.review = { status: 'priced', amount: 12345, excluded: [] };
    const html = renderToStaticMarkup(<ProductExamplePrice type="gable"/>);
    expect(html).not.toContain('$12,345');
    expect(html).toContain('Estimate unavailable');
    expect(html).toContain('Retry estimate');
  });
  it('uses approved prices when supplied and leaves loading explicit', () => {
    expect(renderToStaticMarkup(<ProductExamplePrice type="pitched"/>)).toContain('Updating estimate');
    reply.price = { status: 'priced', amountIncGst: 14500, breakdown: [] };
    const html = renderToStaticMarkup(<ProductExamplePrice type="pitched"/>);
    expect(html).toContain('$14,500');
    expect(html).not.toContain('Draft example estimate');
  });
  it('keeps draft and unavailable safeguards in compact homepage prices', () => {
    vi.stubEnv('NODE_ENV', 'development');
    reply.price = { status: 'disabled' };
    reply.review = { status: 'priced', amount: 12345, excluded: [] };
    const draft = renderToStaticMarkup(<ProductExamplePrice type="pitched" compact/>);
    expect(draft).toContain('Draft example estimate');
    expect(draft).toContain('not a published offer');
    vi.stubEnv('NODE_ENV', 'production');
    const unavailable = renderToStaticMarkup(<ProductExamplePrice type="pitched" compact/>);
    expect(unavailable).not.toContain('$12,345');
    expect(unavailable).toContain('Retry estimate');
    reply.price = { status: 'priced', amountIncGst: 14500, breakdown: [] };
    expect(renderToStaticMarkup(<ProductExamplePrice type="pitched" compact/>)).toContain('6 × 3 m installed estimate');
  });
});
