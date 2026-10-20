import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SavedEstimateReview, SavedReviewPrice } from '../../lib/designStudio/savedReview';
import SavedStudioReview, { type SavedStudioReviewProps } from './SavedStudioReview';

const price = (total: number): SavedReviewPrice => ({ state: 'available', totalIncGstCents: total, basis: 'saved-quote', lineItems: [{ description: 'Roof\nSaved specification', qty: 3, unitPriceIncGstCents: 999, lineTotalIncGstCents: total }] });
function review(): SavedEstimateReview {
  return {
    estimate: { id: 'estimate', projectId: 'project', versionLabel: 'V3', status: 'draft', commercialScopeId: 'scope', commercialScopeKind: 'add_on', lock: { isLocked: true, lockReason: 'quote_sent', lockedAt: null, lockedByQuoteVersionId: 'quote', lockedByQuoteRef: 'Q-7', lockedByQuoteVersionNumber: 2, hasDraftQuotes: false, draftQuoteCount: 0 } },
    studio: { state: 'unpriced', designId: 'design', revision: 4, sourceEstimateId: 'original', sourceKind: 'imported' },
    currentPrice: { state: 'unavailable', totalIncGstCents: null, lineItems: [], reason: 'This revision has no verified price.' },
    sourceEstimate: { id: 'original', versionLabel: 'V1', price: price(1000123) },
    quote: { id: 'quote', quoteRef: 'Q-7', versionNumber: 2, status: 'SENT', sourceEstimateVersionId: 'estimate', sourceEstimateVersionLabel: 'V3', commercialScopeId: 'scope', sentAt: '2026-09-24T01:00:00Z', pricingSource: 'calculator_live', immutable: true, price: price(1234567) },
    nextAction: { kind: 'create-revision', label: 'Create new revision', reason: 'This estimate has a sent quote.' },
  };
}
function render(value = review(), props: Partial<SavedStudioReviewProps> = {}) {
  const node = document.createElement('div');
  node.innerHTML = renderToStaticMarkup(<SavedStudioReview review={value} projectId="project" {...props} />);
  return node;
}

describe('SavedStudioReview', () => {
  it('makes the original website design available before entering the import form', () => {
    const value = review();
    value.websiteBrief = { schemaVersion: 'studio_website_brief.v1', sourceEstimateId: 'original', summary: 'Pitched pergola · 6.5 × 3.5 m', selections: [{label:'Attachment choice',value:'freestanding'}], reopenUrl:'https://example.test/configurator-preview#design=fixture', importable:true, reason:null };
    const node = render(value, {importHref:'/import'});
    expect(node.textContent).toContain('Pitched pergola · 6.5 × 3.5 m');
    expect(node.querySelector('details')?.open).toBe(true);
    expect([...node.querySelectorAll('a')].find(link => link.textContent?.includes('Open original website design'))?.getAttribute('href')).toBe(value.websiteBrief.reopenUrl);
  });
  it('separates unpriced revisions from original reference and exact frozen quote line totals', () => {
    const node = render();
    const current = node.querySelector('[aria-label="Current estimate price"]')!;
    const source = node.querySelector('[aria-label="Original estimate reference"]')!;
    const quote = node.querySelector('[aria-label="Saved quote version"]')!;
    expect(current.textContent).toContain('Unpriced design');
    expect(current.textContent).not.toContain('$');
    expect(source.textContent).toContain('Reference only');
    expect(source.textContent).toContain('$10,001.23');
    expect(quote.textContent).toContain('Q-7 · Version 2');
    expect(quote.textContent).toContain('Frozen quote version');
    expect(quote.querySelector('tbody td:last-child')?.textContent).toBe('$12,345.67');
    expect(quote.textContent).not.toContain('$29.97');
    expect(quote.querySelector('tbody td')?.textContent).toBe('Roof\nSaved specification');
    expect(node.querySelector('h1')?.textContent).toBe('Untitled Studio design');
    expect(node.textContent).toContain('Add-on scope');
    expect(node.textContent).toContain('Design V3');
  });

  it('does not render internal cost controls or values for a staff projection', () => {
    const node = render();
    expect(node.querySelector('details')).toBeNull();
    expect(node.textContent).not.toContain('Internal costs');
  });

  it('labels authorised internal costs as original source excluding GST, preserving unavailable values', () => {
    const value = review();
    value.internalCosts = { basis: 'retained-source-costs', materialsExGst: 123.45, installExGst: null, overheadExGst: 10, totalExGst: 133.45 };
    const node = render(value);
    expect(node.querySelector('details')?.textContent).toContain('original source');
    expect(node.querySelector('details')?.textContent).toContain('excluding GST');
    expect(node.querySelector('details')?.textContent).toContain('$123.45');
    expect(node.querySelector('details')?.textContent).toContain('Unavailable');
  });

  it('exposes an editing link only for the corresponding allowed action and connected destination', () => {
    const value = review();
    expect(render(value, { editHref: '/edit' }).querySelector('a[href="/edit"]')).toBeNull();
    expect(render(value).querySelector('button')).toBeNull();
    expect(render(value).textContent).toContain('Revision creation is not connected');
    expect(render(value, { revisionHref: '/revision' }).querySelector('a[href="/revision"]')?.textContent).toBe('Create new revision');
    value.nextAction = { kind: 'edit', label: 'Edit design', reason: null };
    expect(render(value).textContent).toContain('Editing is not connected');
    expect(render(value, { editHref: '/edit', revisionHref: '/revision' }).querySelector('a[href="/edit"]')?.textContent).toBe('Edit design');
    expect(render(value, { revisionHref: '/revision' }).querySelector('a[href="/revision"]')).toBeNull();
    value.nextAction.kind = 'unavailable';
    expect(render(value, { editHref: '/edit', revisionHref: '/revision' }).querySelectorAll('a')).toHaveLength(1);
  });

  it('keeps unsupported or incomplete prices unavailable without substituting source totals', () => {
    const value = review();
    value.studio.state = 'unsupported';
    value.quote!.price = { state: 'unavailable', totalIncGstCents: null, lineItems: [], reason: 'Frozen totals are incomplete.' };
    const node = render(value);
    expect(node.querySelector('[aria-label="Current estimate price"]')?.textContent).toContain('Price unavailable');
    expect(node.querySelector('[aria-label="Saved quote version"]')?.textContent).toContain('Frozen totals are incomplete.');
    expect(node.querySelector('[aria-label="Saved quote version"] table')).toBeNull();
  });

  it('shows a configured frozen current price and identifies a draft quote honestly', () => {
    const value = review();
    value.currentPrice = { ...price(10101), basis: 'configured-frozen' } as SavedReviewPrice;
    value.quote!.immutable = false;
    value.quote!.status = 'DRAFT';
    value.sourceEstimate = null;
    const node = render(value);
    expect(node.querySelector('[aria-label="Current estimate price"]')?.textContent).toContain('$101.01');
    expect(node.textContent).toContain('Frozen configured price saved');
    expect(node.textContent).toContain('Saved draft quote');
    expect(node.textContent).not.toContain('Frozen quote version');
    expect(node.querySelector('[aria-label="Original estimate reference"]')).toBeNull();
  });
});
