import { describe, expect, it } from 'vitest';
import { designEntryHref, INITIAL_PRODUCT_SELECTION, parseProductSelection, productSelectionDraft, ST_HELIERS_START } from './productSelection';
import { parsePreviewShareHash } from '../configurator-prototype/previewShare';
import { previewBlindOpenings } from '../configurator-prototype/blindSelection';
import { PRODUCT_DESIGNS, type ProductDesignType } from './productDesigns';
import { solvePergolaPreview } from '../configurator-prototype/solvePreview';

describe('product-page draft handoff', () => {
  it('restores older product selections with parallel direction and rejects unknown directions', () => {
    const { orientation: _orientation, ...older } = INITIAL_PRODUCT_SELECTION;
    expect(parseProductSelection(older)?.orientation).toBe('parallel');
    expect(parseProductSelection({ ...older, orientation: 'diagonal' })).toBeNull();
  });
  it.each(['parallel', 'away'] as const)('carries gable %s direction and pine through both destinations', orientation => {
    const { draft, issue } = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, orientation, material: 'solid', sides: 'all' }, 'gable');
    expect(issue).toBeNull();
    expect(draft.roof.orientation).toBe(orientation);
    expect(draft.roof.finish?.ceiling).toBe('thermopine-150');
    expect(solvePergolaPreview(draft.input, draft.roof).geometry).toBeDefined();
    for (const destination of ['configurator', 'enquiry'] as const) {
      const restored = parsePreviewShareHash(new URL(designEntryHref(destination, draft, { sourceProduct: 'gable' }), 'http://localhost').hash)?.draft;
      expect(restored?.roof.orientation).toBe(orientation);
      expect(restored?.roof.finish?.ceiling).toBe('thermopine-150');
    }
  });
  it.each(['configurator', 'enquiry'] as const)('round-trips all selections and price basis into %s, without leaking contact anchors', destination => {
    const { draft, issue } = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, widthMm: 7400, material: 'combination', sides: 'all' });
    expect(issue).toBeNull();
    const href = designEntryHref(destination, draft, { sourcePath: '/products/pergolas/pitched', sourceProduct: 'pitched', sourceComponent: 'product_cta' }, { basis: 'draft', amountIncGst: 31000 });
    const url = new URL(href, 'http://localhost');
    expect(url.searchParams.get('source_product')).toBe('pitched');
    expect(url.hash).not.toContain('contact-form');
    expect(parsePreviewShareHash(url.hash)).toEqual({ draft, estimate: { basis: 'draft', amountIncGst: 31000 } });
    expect(draft.roof.blinds).toHaveLength(previewBlindOpenings(draft.input, draft.roof).length);
  });
  it('rebuilds blind openings after a size change and preserves the named side', () => {
    for (const widthMm of [3000, 6000, 10000]) {
      const { draft, issue } = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, widthMm, sides: 'left' });
      expect(issue).toBeNull();
      expect(draft.roof.blinds?.length).toBeGreaterThan(0);
      expect(draft.roof.blinds?.every(b => b.opening.startsWith('left-'))).toBe(true);
    }
  });
  it('only restores product choices within the offered range and ignores extra fields', () => {
    expect(parseProductSelection({ ...INITIAL_PRODUCT_SELECTION, widthMm: 1499 })).toBeNull();
    expect(parseProductSelection({ ...INITIAL_PRODUCT_SELECTION, sides: 'invented' })).toBeNull();
    expect(parseProductSelection({ ...INITIAL_PRODUCT_SELECTION, connection: 'soffit' })).toEqual(INITIAL_PRODUCT_SELECTION);
  });
  it('seeds the approved project footprint and roof, with project attribution', () => {
    const url = new URL(designEntryHref('configurator', ST_HELIERS_START, { sourceProject: 'st-heliers-townhouse', sourceComponent: 'project_cta' }), 'http://localhost');
    expect(url.searchParams.get('source_project')).toBe('st-heliers-townhouse');
    expect(url.searchParams.has('entry')).toBe(false);
    expect(parsePreviewShareHash(url.hash)?.draft).toEqual(ST_HELIERS_START);
  });
});

describe.each(Object.keys(PRODUCT_DESIGNS) as ProductDesignType[])('%s product family', type => {
  it.each(['acrylic', 'solid', 'combination'] as const)('solves %s with every offered side preset and retains family in both handoffs', material => {
    for (const sides of ['open', 'left', 'right', 'all'] as const) {
      const { draft, issue } = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, material, sides }, type);
      expect(issue).toBeNull();
      expect(draft.roof.family).toBe(PRODUCT_DESIGNS[type].family);
      if (material !== 'acrylic') expect(draft.roof.finish?.ceiling).toBe('thermopine-150');
      expect(draft.input.connection).toBe(PRODUCT_DESIGNS[type].connection);
      expect(solvePergolaPreview(draft.input, draft.roof).geometry).toBeDefined();
      for (const destination of ['configurator', 'enquiry'] as const) {
        const url = new URL(designEntryHref(destination, draft, { sourcePath: `/products/pergolas/${type}`, sourceProduct: type, sourceComponent: 'product_cta' }), 'http://localhost');
        const restored = parsePreviewShareHash(url.hash)?.draft;
        expect(restored?.input).toEqual(draft.input);
        expect({ ...restored?.roof, blinds: restored?.roof.blinds ?? [] }).toEqual({ ...draft.roof, blinds: draft.roof.blinds ?? [] });
        expect(url.searchParams.get('source_product')).toBe(type);
        expect(url.searchParams.get('entry')).toBe(destination === 'configurator' ? 'edit' : null);
      }
      const requested = previewBlindOpenings(draft.input, draft.roof).filter(o => sides === 'all' || o.side === sides);
      expect(draft.roof.blinds?.length ?? 0).toBe(sides === 'open' ? 0 : requested.length);
    }
  });
});
