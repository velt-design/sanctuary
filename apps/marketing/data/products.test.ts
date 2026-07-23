import { describe, expect, it } from 'vitest';
import {
  getProduct,
  getProductBySlug,
  productCategories,
  products,
} from './products';

describe('governed product catalogue', () => {
  it('owns the complete ten-route product matrix without duplicate routes or slugs', () => {
    expect(products).toHaveLength(10);
    expect(new Set(products.map((product) => product.slug)).size).toBe(10);
    expect(new Set(products.map((product) => product.route)).size).toBe(10);
    expect(productCategories.map((category) => category.slug)).toEqual([
      'pergolas',
      'screens-walls',
      'lighting-heating',
    ]);
    expect(products.filter((product) => product.variant === 'pergola-form')).toHaveLength(4);
    expect(products.filter((product) => product.variant === 'integrated-option')).toHaveLength(6);
  });

  it('keeps route, metadata, decision, evidence and relationship fields complete', () => {
    for (const product of products) {
      expect(getProduct(product.categorySlug, product.slug)).toBe(product);
      expect(getProductBySlug(product.slug)).toBe(product);
      expect(product.route).toBe(
        `/products/${product.categorySlug}/${product.slug}`,
      );
      expect(product.hero.alt.trim()).not.toBe('');
      expect(product.gallery.length).toBeGreaterThanOrEqual(2);
      expect(product.decision.worksWhen.length).toBeGreaterThanOrEqual(3);
      expect(product.decision.resolve.length).toBeGreaterThanOrEqual(3);
      expect(product.tradeoffs.length).toBeGreaterThanOrEqual(3);
      expect(product.details.atAGlance.length).toBeGreaterThanOrEqual(4);
      expect(product.details.options?.length ?? 0).toBeGreaterThan(0);
      expect(product.details.faqs?.length ?? 0).toBeGreaterThan(0);
      expect(product.alternatives.length).toBeGreaterThanOrEqual(2);
      expect(product.relatedProducts.length).toBeGreaterThanOrEqual(2);
      expect(product.metadata.description.length).toBeGreaterThan(80);
      expect(product.guide.href).toMatch(/^\//);

      for (const relatedSlug of [
        ...product.alternatives,
        ...product.relatedProducts,
      ]) {
        expect(
          getProductBySlug(relatedSlug),
          `${product.slug} references missing product ${relatedSlug}`,
        ).toBeDefined();
      }
    }
  });

  it('makes context-only and unavailable project proof explicit', () => {
    expect(getProductBySlug('acrylic-infill-panels')?.evidence.status).toBe(
      'context-only',
    );
    expect(getProductBySlug('slat-screens')?.evidence.status).toBe(
      'context-only',
    );
    expect(getProductBySlug('patio-heaters')?.evidence.status).toBe(
      'not-published',
    );

    for (const product of products) {
      if (product.evidence.status !== 'governed') {
        expect(product.evidence.caveat.trim()).not.toBe('');
      }
    }
  });

  it('does not expose placeholders or known prohibited sales clichés', () => {
    const publicCopy = JSON.stringify(products);

    expect(publicCopy).not.toMatch(/\[\[VERIFY\]\]/i);
    expect(publicCopy).not.toMatch(/transform your backyard/i);
    expect(publicCopy).not.toMatch(/ultimate outdoor oasis/i);
    expect(publicCopy).not.toMatch(/seamless indoor-outdoor flow/i);
    expect(publicCopy).not.toMatch(/bring your dream to life/i);
    expect(publicCopy).not.toMatch(/unmatched quality|best in class/i);
    expect(publicCopy).not.toMatch(/engineered for New Zealand conditions/i);
    expect(publicCopy).not.toMatch(/\b(?:waterproof|leak-free|all-weather)\b/i);
    expect(publicCopy).not.toMatch(/\bmaintenance-free\b/i);
  });
});
