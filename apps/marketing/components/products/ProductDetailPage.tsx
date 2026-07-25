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
  FaqList,
  ProjectStory,
  SpecificationRows,
} from '@/components/marketing-foundation/Patterns';
import { ResponsiveGallery } from '@/components/marketing-foundation/ResponsiveGallery';
import type { ProductRecord } from '@/data/products';
import { projects } from '@/data/projects';
import { absoluteUrl } from '@/lib/seo';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import MobileProductDisclosure from './MobileProductDisclosure';
import ProductCard from './ProductCard';
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
          <Heading as="h3">No named heater installation is published yet.</Heading>
        </div>
        <div className={styles.evidenceUnavailableCopy}>
          <Text size="large">{evidence.relevance}</Text>
          <Text>{evidence.caveat}</Text>
          <Text>
            For your project, ask for the current manufacturer information for
            the exact heater, then confirm position, output, clearances,
            controls and electrical scope against the seating plan.
          </Text>
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
        metadata={[
          project.location,
          project.type,
          project.roof,
          project.year,
        ]}
        copy={evidence.relevance}
        href={`/projects/${project.slug}`}
      />
      {evidence.status === 'context-only' ? (
        <aside className={styles.evidenceCaveat} aria-label="Evidence limitation">
          <span>Context, not product proof</span>
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
  const canonical = product.route;

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
            url: absoluteUrl(canonical),
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
                item: absoluteUrl(canonical),
              },
            ],
          },
          ...(model.faqs.length
            ? [
                {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: model.faqs.map((faq) => ({
                    '@type': 'Question',
                    name: faq.question,
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: faq.answer,
                    },
                  })),
                },
              ]
            : []),
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
          <Text size="large">{product.proposition}</Text>
          <div className={styles.heroActions}>
            <Button href={enquiryHref}>Send your project details</Button>
            <TextLink href="#product-fit">See where it fits</TextLink>
          </div>
          <ProjectMeta
            items={[
              product.hero.caption,
              product.hero.detail ?? '',
            ]}
          />
        </div>
      </section>

      <Section>
        <Container>
          <div className={styles.outcomeGrid}>
            <div>
              <Eyebrow>What this helps you achieve</Eyebrow>
              <Heading>{product.outcome.heading}</Heading>
            </div>
            <div className={styles.outcomeCopy}>
              <Text size="large">{product.outcome.copy}</Text>
              <Text>{product.details.overview}</Text>
            </div>
          </div>
        </Container>
      </Section>

      <Section id="product-fit" tone="warm">
        <Container width="wide">
          <div className={styles.fitGrid}>
            <div className={styles.fitIntro}>
              <Eyebrow>Fit before features</Eyebrow>
              <Heading>One useful condition. One constraint to resolve.</Heading>
              <Text>
                The measured house and selected products still decide what is
                feasible.
              </Text>
            </div>
            <article className={styles.fitColumn}>
              <span className={styles.fitLabel}>It can be useful when</span>
              <ul className={styles.fitPrimaryList}>
                <li>{model.visibleFit.suitableCondition}</li>
              </ul>
            </article>
            <article className={styles.fitColumn}>
              <span className={styles.fitLabel}>The project must resolve</span>
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
                  ? 'Be clear about what has and has not been demonstrated.'
                  : 'See the decision in a real Sanctuary project.'}
              </Heading>
            </div>
            <Text>
              This evidence records one measured brief. It is not a guaranteed
              result for every site.
            </Text>
          </div>
          <EvidenceStory product={product} />
        </Container>
      </Section>

      <MobileProductDisclosure
        className={styles.detailGroupDisclosure}
        kind={model.disclosureGroups[0].id}
        summary={model.disclosureGroups[0].summary}
      >
        <div>
          <Section tone="warm" className={styles.definitionSection}>
            <Container width="wide">
              <div className={styles.sectionHeadingRow}>
                <div>
                  <Eyebrow>
                    {product.variant === 'pergola-form'
                      ? 'What defines the form'
                      : 'What defines the option'}
                  </Eyebrow>
                  <Heading>
                    {product.variant === 'pergola-form'
                      ? 'Geometry should improve the room.'
                      : 'Integration matters as much as the product.'}
                  </Heading>
                </div>
                {product.details.howItWorks ? (
                  <Text size="large">{product.details.howItWorks}</Text>
                ) : null}
              </div>
              <ol className={styles.definitionList}>
                {product.details.atAGlance.map((item, index) => (
                  <li key={item}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>{item}</p>
                  </li>
                ))}
              </ol>
            </Container>
          </Section>
          <Section>
            <Container width="wide">
              <div className={styles.supportingFitGrid}>
                <article className={styles.fitColumn}>
                  <span className={styles.fitLabel}>More suitable conditions</span>
                  <ul>
                    {model.supportingFit.suitableConditions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className={styles.fitColumn}>
                  <span className={styles.fitLabel}>More constraints</span>
                  <ul>
                    {model.supportingFit.constraints.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </div>
            </Container>
          </Section>
        </div>
      </MobileProductDisclosure>

      <MobileProductDisclosure
        className={styles.detailGroupDisclosure}
        kind={model.disclosureGroups[1].id}
        summary={model.disclosureGroups[1].summary}
      >
        <div>
          <Section tone="warm">
            <Container>
              <div className={styles.sectionHeadingRow}>
                <div>
                  <Eyebrow>Practical specification</Eyebrow>
                  <Heading>What needs to be included?</Heading>
                </div>
                <Text>
                  The proposal should identify the completed design, selected
                  products, installation scope and open confirmations.
                </Text>
              </div>
              <div className={styles.specificationRows}>
                <SpecificationRows rows={model.specifications} />
              </div>
            </Container>
          </Section>
          <Section>
            <Container width="wide">
              <div className={styles.optionsTradeoffs}>
                <div className={styles.optionsColumn}>
                  <Eyebrow>Options to decide</Eyebrow>
                  <Heading>Choose after the priorities are clear.</Heading>
                  <ul className={styles.plainList}>
                    {(product.details.options ?? []).map((option) => (
                      <li key={option}>{option}</li>
                    ))}
                  </ul>
                </div>
                <div className={styles.tradeoffColumn}>
                  <Eyebrow>Honest trade-offs</Eyebrow>
                  <div className={styles.tradeoffList}>
                    {product.tradeoffs.map((tradeoff, index) => (
                      <article key={tradeoff.tension}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <Heading as="h3" variant="card">
                          {tradeoff.tension}
                        </Heading>
                        <Text>{tradeoff.guidance}</Text>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </Container>
          </Section>
        </div>
      </MobileProductDisclosure>

      <MobileProductDisclosure
        className={styles.detailGroupDisclosure}
        kind={model.disclosureGroups[2].id}
        summary={model.disclosureGroups[2].summary}
      >
        <div>
          <Section tone="neutral">
            <Container width="wide">
              <div className={styles.sectionHeadingRow}>
                <div>
                  <Eyebrow>Compare the closest choices</Eyebrow>
                  <Heading>Use the trade-off to narrow the answer.</Heading>
                </div>
                <Text>
                  An alternative may suit a different priority around
                  openness, height, control or scope.
                </Text>
              </div>
              <div className={styles.alternativeGrid}>
                {model.alternatives.map((alternative) => (
                  <ProductCard
                    key={alternative.slug}
                    product={alternative}
                    compact
                  />
                ))}
              </div>
            </Container>
          </Section>

          <Section>
            <Container width="wide">
              <div className={styles.sectionHeadingRow}>
                <div>
                  <Eyebrow>
                    {product.variant === 'pergola-form'
                      ? 'Complete the room'
                      : 'Coordinate the wider system'}
                  </Eyebrow>
                  <Heading>Related decisions should be planned together.</Heading>
                </div>
                <Text>
                  Structure, edges, lighting and electrical items can compete
                  for the same space.
                </Text>
              </div>
              <div className={styles.relatedProductGrid}>
                {model.relatedProducts.map((related) => (
                  <article className={styles.relatedProduct} key={related.slug}>
                    <div className={styles.relatedProductMedia}>
                      <Image
                        src={related.hero.src}
                        alt={related.hero.alt}
                        fill
                        sizes="(max-width: 640px) 112px, (max-width: 700px) 100vw, 33vw"
                        style={{ objectPosition: related.hero.objectPosition }}
                      />
                    </div>
                    <div>
                      <Heading as="h3" variant="card">{related.name}</Heading>
                      <Text>{related.indexSummary}</Text>
                      <TextLink href={related.route}>Explore this option</TextLink>
                    </div>
                  </article>
                ))}
              </div>
            </Container>
          </Section>

          <Section tone="inverse">
            <Container>
              <div className={styles.guideFeature}>
                <div>
                  <Eyebrow>Related planning guide</Eyebrow>
                  <Heading>{product.guide.label}</Heading>
                </div>
                <div>
                  <Text size="large">{product.guide.summary}</Text>
                  <TextLink href={product.guide.href}>
                    Read the planning guide
                  </TextLink>
                </div>
              </div>
            </Container>
          </Section>

          {model.faqs.length ? (
            <Section>
              <Container>
                <div className={styles.sectionHeadingRow}>
                  <div>
                    <Eyebrow>Focused questions</Eyebrow>
                    <Heading>What people usually ask next.</Heading>
                  </div>
                  <Text>
                    The final answer follows the measured site, selected
                    product and completed design.
                  </Text>
                </div>
                <FaqList items={model.faqs} />
              </Container>
            </Section>
          ) : null}
        </div>
      </MobileProductDisclosure>

      <ConversionSection
        eyebrow="Initial project assessment"
        heading={`Could ${product.shortName.toLowerCase()} suit your deck?`}
        copy="Send your suburb, a few photos and rough dimensions. We can assess the house connection, likely constraints and the most useful next step."
        actionLabel="Send your project details"
        href={enquiryHref}
      />
    </main>
  );
}
