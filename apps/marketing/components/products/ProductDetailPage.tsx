import Image from 'next/image';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import {
  Button,
  Container,
  Eyebrow,
  Heading,
  ProjectMeta,
  Section,
  Text,
  TextLink,
} from '@/components/marketing-foundation/Primitives';
import {
  ConversionSection,
  ProjectStory,
  SpecificationRows,
} from '@/components/marketing-foundation/Patterns';
import { ResponsiveGallery } from '@/components/marketing-foundation/ResponsiveGallery';
import type { ProductRecord } from '@/data/products';
import { projects } from '@/data/projects';
import { absoluteUrl } from '@/lib/seo';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import MobileProductDisclosure from './MobileProductDisclosure';
import { buildProductDetailViewModel } from './productDetailViewModel';
import styles from './product-pages.module.css';

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
    project.caseStudyHeroImage
    ?? project.gallery[1]
    ?? project.gallery[0]
    ?? project.heroImage;

  return (
    <div className={styles.evidenceStory}>
      <ProjectStory
        image={evidenceMedia.src}
        alt={evidenceMedia.alt}
        objectPosition={evidenceMedia.objectPosition}
        title={project.title}
        metadata={[project.location, project.type]}
        copy={evidence.relevance}
        href={`/projects/${project.slug}`}
      />
      {evidence.status === 'context-only' ? (
        <aside className={styles.evidenceCaveat} aria-label="Evidence limitation">
          <span>Context only</span>
          <p>{evidence.caveat}</p>
        </aside>
      ) : null}
    </div>
  );
}

export default function ProductDetailPage({ product }: ProductDetailPageProps) {
  const enquiryHref = buildEnquiryHref({
    sourcePath: product.route,
    sourceComponent: 'product_cta',
    sourceProduct: product.slug,
  });
  const model = buildProductDetailViewModel(product);

  return (
    <main
      className={styles.productExperience}
      data-marketing-foundation-page
      data-product-detail
      data-product-variant={product.variant}
    >
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.metadata.description,
            image: [product.hero, ...product.gallery].map((media) =>
              absoluteUrl(media.src),
            ),
            brand: { '@type': 'Brand', name: 'Sanctuary Pergolas' },
            category: product.categoryLabel,
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

      <section className={styles.detailHero}>
        <div className={styles.detailHeroMedia}>
          <Image
            src={product.hero.src}
            alt={product.hero.alt}
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 860px) 100vw, 62vw"
            style={{ objectPosition: product.hero.objectPosition }}
          />
        </div>
        <div className={styles.detailHeroCopy}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/products">Products</Link>
            <span aria-hidden="true">/</span>
            <span>{product.categoryLabel}</span>
          </nav>
          <Eyebrow>{product.categoryLabel}</Eyebrow>
          <Heading as="h1" variant="page">{product.name}</Heading>
          <Text size="large">{product.indexSummary}</Text>
          <div className={styles.heroActions}>
            <Button href={enquiryHref}>Send project brief</Button>
            <TextLink href="#product-fit">Check the fit</TextLink>
          </div>
          <ProjectMeta items={[product.hero.caption, product.hero.detail ?? '']} />
        </div>
      </section>

      <Section id="product-fit" tone="warm">
        <Container width="wide">
          <div className={styles.fitGrid}>
            <div className={styles.fitIntro}>
              <Eyebrow>Project fit</Eyebrow>
              <Heading>Where it works.</Heading>
            </div>
            <article className={styles.fitColumn}>
              <span className={styles.fitLabel}>Useful when</span>
              <ul className={styles.fitPrimaryList}>
                <li>{model.visibleFit.suitableCondition}</li>
              </ul>
            </article>
            <article className={styles.fitColumn}>
              <span className={styles.fitLabel}>Confirm</span>
              <ul className={styles.fitPrimaryList}>
                <li>{model.visibleFit.constraint}</li>
              </ul>
            </article>
          </div>
        </Container>
      </Section>

      <ProductGallery product={product} items={model.galleryItems} />

      <Section tone="neutral">
        <Container width="wide">
          <div className={styles.sectionHeadingRow}>
            <div>
              <Eyebrow>Built evidence</Eyebrow>
              <Heading>
                {product.evidence.status === 'not-published'
                  ? 'What we can verify.'
                  : 'One relevant project.'}
              </Heading>
            </div>
          </div>
          <EvidenceStory product={product} />
        </Container>
      </Section>

      <MobileProductDisclosure
        className={styles.detailGroupDisclosure}
        kind={model.disclosureGroups[0].id}
        summary={model.disclosureGroups[0].summary}
      >
        <Section tone="warm" className={styles.definitionSection}>
          <Container width="wide">
            <div className={styles.sectionHeadingRow}>
              <div>
                <Eyebrow>How it works</Eyebrow>
                <Heading>The main idea.</Heading>
              </div>
              <Text size="large">{product.details.overview}</Text>
            </div>
            <ol className={styles.definitionList}>
              {product.details.atAGlance.slice(0, 2).map((item, index) => (
                <li key={item}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
          </Container>
        </Section>
      </MobileProductDisclosure>

      <MobileProductDisclosure
        className={styles.detailGroupDisclosure}
        kind={model.disclosureGroups[1].id}
        summary={model.disclosureGroups[1].summary}
      >
        <Section>
          <Container>
            <div className={styles.sectionHeadingRow}>
              <div>
                <Eyebrow>Project scope</Eyebrow>
                <Heading>What to confirm.</Heading>
              </div>
            </div>
            <div className={styles.specificationRows}>
              <SpecificationRows rows={model.specifications} />
            </div>
            {product.tradeoffs[0] ? (
              <div className={styles.tradeoffList}>
                <article>
                  <span>01</span>
                  <Heading as="h3" variant="card">
                    {product.tradeoffs[0].tension}
                  </Heading>
                  <Text>{product.tradeoffs[0].guidance}</Text>
                </article>
              </div>
            ) : null}
          </Container>
        </Section>
      </MobileProductDisclosure>

      <MobileProductDisclosure
        className={styles.detailGroupDisclosure}
        kind={model.disclosureGroups[2].id}
        summary={model.disclosureGroups[2].summary}
      >
        <Section tone="neutral">
          <Container>
            <div className={styles.sectionHeadingRow}>
              <div>
                <Eyebrow>Next choices</Eyebrow>
                <Heading>Compare and plan.</Heading>
              </div>
            </div>
            <ul className={styles.guideLinkList}>
              {model.alternatives.slice(0, 1).map((alternative) => (
                <li key={alternative.slug}>
                  <div>
                    <Heading as="h3" variant="card">{alternative.name}</Heading>
                    <Text>{alternative.indexSummary}</Text>
                  </div>
                  <TextLink href={alternative.route}>Compare</TextLink>
                </li>
              ))}
              <li>
                <div>
                  <Heading as="h3" variant="card">{product.guide.label}</Heading>
                  <Text>{product.guide.summary}</Text>
                </div>
                <TextLink href={product.guide.href}>Read guide</TextLink>
              </li>
            </ul>
          </Container>
        </Section>
      </MobileProductDisclosure>

      <ConversionSection
        eyebrow="Project brief"
        heading={`Could ${product.shortName.toLowerCase()} suit your project?`}
        copy="Send your suburb, photos and rough dimensions."
        actionLabel="Send project brief"
        href={enquiryHref}
      />
    </main>
  );
}
