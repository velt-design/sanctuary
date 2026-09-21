import cardLinks from '@/components/marketing-foundation/cardLinks.module.css';
import composition from '@/components/marketing-foundation/editorial/composition.module.css';
import EditorialProductContent from '@/components/marketing-foundation/editorial/EditorialProductContent';
import editorial from '@/components/marketing-foundation/editorial/editorial.module.css';
import JsonLd from '@/components/JsonLd';
import {
  Container,
  Eyebrow,
  Figure,
  Heading,
  Section,
  Text,
  TextLink,
} from '@/components/marketing-foundation/Primitives';
import { ResponsiveGallery } from '@/components/marketing-foundation/ResponsiveGallery';
import type { ProductRecord } from '@/data/products';
import { projects } from '@/data/projects';
import { absoluteUrl } from '@/lib/seo';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import { buildProductDetailViewModel } from './productDetailViewModel';
import styles from './product-pages.module.css';
import ProductSelector from './ProductSelector';
import { isProductDesignType, productSelectionAnchor } from './productDesigns';
import DesignNextSteps from '../journey/DesignNextSteps';

type ProductDetailPageProps = {
  product: ProductRecord;
};

function ProductGallery({
  product,
  items,
}: ProductDetailPageProps & {
  items: ReturnType<typeof buildProductDetailViewModel>['galleryItems'];
}) {
  return (
    <Section
      compact
      className={styles.productGallerySection}
      aria-label={`${product.name} gallery`}
      data-product-gallery="primary"
    >
      <Container width="wide">
        <ResponsiveGallery
          className={styles.productGallery}
          items={items}
          label={`${product.name} project gallery`}
          swipe
        />
      </Container>
    </Section>
  );
}

function EvidenceStory({ product }: ProductDetailPageProps) {
  const evidence = product.evidence;

  if (evidence.status === 'not-published') {
    return (
      <div className={styles.evidenceUnavailable}>
        <div>
          <Eyebrow>Evidence status</Eyebrow>
          <Heading as="h3">No named heater installation is published.</Heading>
        </div>
        <div className={styles.evidenceUnavailableCopy}>
          <Text size="large">{evidence.relevance}</Text>
          <Text>{evidence.caveat}</Text>
        </div>
      </div>
    );
  }

  const project = projects.find((item) => item.slug === evidence.projectSlug);
  if (!project) {
    throw new Error(
      `Missing governed product evidence project: ${evidence.projectSlug}`,
    );
  }
  const evidenceMedia =
    (product.slug === 'gable' ? product.gallery[0] : undefined)
    ?? project.caseStudyHeroImage
    ?? project.gallery[1]
    ?? project.gallery[0]
    ?? project.heroImage;

  return <div className={`${composition.bridgeGrid} ${cardLinks.surface}`}>
    <Figure image={evidenceMedia.src} alt={evidenceMedia.alt} objectPosition={evidenceMedia.objectPosition} ratio="standard" />
    <div><Eyebrow>See it built / {project.location.split(',')[0]}</Eyebrow>
      <Heading>{product.slug === 'gable' ? <>A room beside<br />the house.</> : project.title}</Heading>
      <Text>{evidence.relevance}</Text>
      {evidence.status === 'context-only' && <aside aria-label="Evidence limitation"><Eyebrow>Context only</Eyebrow><Text>{evidence.caveat}</Text></aside>}
      <TextLink className={cardLinks.hitLink} href={'/projects/'+project.slug}>Explore {project.title}</TextLink>
    </div>
  </div>;

}

export default function ProductDetailPage({ product }: ProductDetailPageProps) {
  const enquiryHref = buildEnquiryHref({
    sourcePath: product.route,
    sourceComponent: 'product_cta',
    sourceProduct: product.slug,
  });
  const model = buildProductDetailViewModel(product);
  const designType = isProductDesignType(product.slug) ? product.slug : null;

  return (
    <main
      className={`${styles.productExperience} ${editorial.surface}`}
      data-editorial-page="product"
      data-marketing-foundation-page
      data-product-detail
      data-product-variant={product.variant}
    >
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            // Quote-led catalogue pages have no published offer or product review.
            // Describe the page without claiming Product rich-result eligibility.
            '@type': 'WebPage',
            name: product.name,
            description: product.metadata.description,
            image: [product.hero, ...product.gallery].map((media) =>
              absoluteUrl(media.src),
            ),
            url: absoluteUrl(product.route),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: absoluteUrl('/'),
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Products',
                item: absoluteUrl('/products'),
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: product.categoryLabel,
                item: absoluteUrl(`/products#${product.categorySlug}`),
              },
              {
                '@type': 'ListItem',
                position: 4,
                name: product.name,
                item: absoluteUrl(product.route),
              },
            ],
          },
        ]}
      />

      <EditorialProductContent product={product} enquiryHref={enquiryHref}
        selection={designType ? <ProductSelector key={designType} product={product} type={designType} /> : undefined}
        nextSteps={model.showDesignNextSteps ? <DesignNextSteps sourcePath={product.route} sourceProduct={product.slug} selectionHref={designType ? `#${productSelectionAnchor(designType)}` : undefined} /> : undefined}
        gallery={<ProductGallery product={product} items={model.galleryItems} />}
        evidence={<EvidenceStory product={product} />}
        supportingLinks={<><div className={styles.guideLinkList}>{model.relatedProducts.map(related => <TextLink key={related.slug} href={related.route}>{related.name}</TextLink>)}</div><ul className={styles.guideLinkList}>{[product.guide].map(guide => <li key={guide.href} className={cardLinks.surface}><Heading as="h3" variant="card">{guide.label}</Heading><TextLink className={cardLinks.hitLink} aria-label={`Read guide: ${guide.label}`} href={guide.href}>Read guide</TextLink></li>)}</ul></>}
      />
    </main>
  );
}
