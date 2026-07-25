import {
  products,
  type ProductRecord,
} from '../../data/products';

export const PRODUCT_DETAIL_DISCLOSURE_GROUPS = [
  {
    id: 'fit-and-definition',
    summary: 'How it works and where it fits',
  },
  {
    id: 'specification-and-tradeoffs',
    summary: 'Specification, options and trade-offs',
  },
  {
    id: 'related-support',
    summary: 'Compare alternatives and related guidance',
  },
] as const;

function listAsSentence(items?: string[]): string {
  return (items ?? []).join(' · ');
}

function getSpecificationRows(product: ProductRecord) {
  const details = product.details;

  return [
    {
      label: 'Structure and materials',
      value:
        listAsSentence(details.structureMaterials)
        || 'Specified for the completed design.',
    },
    {
      label: 'What the design confirms',
      value:
        listAsSentence(details.indicativePerformance)
        || listAsSentence(details.performance)
        || 'Final details follow the measured site and selected products.',
    },
    {
      label: 'Installation scope',
      value:
        listAsSentence(details.install)
        || 'Sequence and responsibilities are confirmed in the project proposal.',
    },
    {
      label: 'Care',
      value:
        listAsSentence(details.maintenance)
        || 'Cleaning and inspection follow the current guidance for the selected products.',
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
  });

  return {
    disclosureGroups: PRODUCT_DETAIL_DISCLOSURE_GROUPS,
    visibleFit: {
      suitableCondition: product.decision.worksWhen[0],
      constraint: product.decision.resolve[0],
    },
    supportingFit: {
      suitableConditions: product.decision.worksWhen.slice(1),
      constraints: product.decision.resolve.slice(1),
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
    faqs: (product.details.faqs ?? []).map((faq) => ({
      question: faq.q,
      answer: faq.a,
    })),
    evidenceStatus: product.evidence.status,
  };
}
