import { describe, expect, it } from 'vitest';
import { products } from '../../data/products';
import {
  buildProductDetailViewModel,
  PRODUCT_DETAIL_DISCLOSURE_GROUPS,
} from './productDetailViewModel';

describe('product detail editorial view model', () => {
  it('gives every canonical product the same three purposeful groups', () => {
    expect(products).toHaveLength(10);

    for (const product of products) {
      const model = buildProductDetailViewModel(product);

      expect(model.disclosureGroups).toEqual(
        PRODUCT_DETAIL_DISCLOSURE_GROUPS,
      );
      expect(model.disclosureGroups).toHaveLength(3);
      expect(model.visibleFit.suitableCondition).toBe(
        product.decision.worksWhen[0],
      );
      expect(model.visibleFit.constraint).toBe(product.decision.resolve[0]);
      expect(model.specifications.map((row) => row.label)).toEqual([
        'Structure and materials',
        'What the design confirms',
        'Installation scope',
        'Care',
      ]);
    }
  });

  it('builds one deliberate gallery sequence without repeating inventory', () => {
    for (const product of products) {
      const model = buildProductDetailViewModel(product);

      expect(model.galleryItems.map((item) => item.image)).toEqual(
        product.gallery.map((item) => item.src),
      );
      expect(new Set(model.galleryItems.map((item) => item.image)).size).toBe(
        model.galleryItems.length,
      );
    }
  });

  it('preserves governed, context-only and unpublished evidence states', () => {
    const states = new Set(
      products.map(
        (product) => buildProductDetailViewModel(product).evidenceStatus,
      ),
    );

    expect(states).toEqual(
      new Set(['governed', 'context-only', 'not-published']),
    );
  });

  it('filters missing and duplicate related catalogue entries safely', () => {
    const product = products[0];
    const model = buildProductDetailViewModel(product, [product]);

    expect(model.alternatives).toEqual([]);
    expect(model.relatedProducts).toEqual([]);
  });
});
