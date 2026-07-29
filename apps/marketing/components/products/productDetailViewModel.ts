import {
  products,
  type ProductRecord,
} from '../../data/products';

export const PRODUCT_DETAIL_DISCLOSURE_GROUPS = [
  {
    id: 'fit-and-definition',
    summary: 'How it works',
  },
  {
    id: 'specification-and-tradeoffs',
    summary: 'What to confirm',
  },
  {
    id: 'related-support',
    summary: 'Compare and plan',
  },
] as const;

function getSpecificationRows(product: ProductRecord) {
  const details = product.details;

  return [
    {
      label: 'Structure',
      value:
        details.structureMaterials?.[0]
        || 'Specified for the completed design.',
    },
    {
      label: 'Performance',
      value:
        details.indicativePerformance?.[0]
        || details.performance?.[0]
        || 'Final details follow the measured site and selected products.',
    },
    {
      label: 'Installation',
      value:
        details.install?.[0]
        || 'Sequence and responsibilities are confirmed in the project proposal.',
    },
  ];
}

export function buildProductDetailViewModel(
  product: ProductRecord,
  catalogue: readonly ProductRecord[] = products,
) {
  const productBySlug = new Map(
    catalogue.map((catalogueProduct) => [
      catalogueProduct.slug,
      catalogueProduct,
    ]),
  );
  const alternatives = product.alternatives.flatMap((slug) => {
    const alternative = productBySlug.get(slug);
    return alternative ? [alternative] : [];
  });
  const alternativeSlugs = new Set(
    alternatives.map((alternative) => alternative.slug),
  );
  const relatedProducts = product.relatedProducts.flatMap((slug) => {
    const relatedProduct = productBySlug.get(slug);
    return relatedProduct && !alternativeSlugs.has(relatedProduct.slug)
      ? [relatedProduct]
      : [];
  }).slice(0, 1);

  return {
    disclosureGroups: PRODUCT_DETAIL_DISCLOSURE_GROUPS,
    visibleFit: {
      suitableCondition: product.decision.worksWhen[0],
      constraint: product.decision.resolve[0],
    },
    galleryItems: product.gallery.map((media) => ({
      id: media.src,
      image: media.src,
      alt: media.alt,
      caption: media.caption,
      detail: media.detail,
      objectPosition: media.objectPosition,
      mobileRatio: 'landscape' as const,
      ratio: 'landscape' as const,
      sizes: '(max-width: 860px) 100vw, 72vw',
    })),
    specifications: getSpecificationRows(product),
    alternatives,
    relatedProducts,
    evidenceStatus: product.evidence.status,
  };
}
