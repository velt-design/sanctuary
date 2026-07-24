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
  StaggeredGallery,
} from '@/components/marketing-foundation/Patterns';
import {
  getProductBySlug,
  type ProductRecord,
} from '@/data/products';
import { projects } from '@/data/projects';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import { absoluteUrl } from '@/lib/seo';
import MobileProductDisclosure from './MobileProductDisclosure';
import ProductCard from './ProductCard';
import styles from './product-pages.module.css';

type ProductDetailPageProps = {
  product: ProductRecord;
};

function listAsSentence(items?: string[]): string {
  return (items ?? []).join(' · ');
}

function getSpecificationRows(product: ProductRecord) {
  const details = product.details;
  return [
    {
      label: 'Structure and materials',
      value:
        listAsSentence(details.structureMaterials) ||
        'Specified for the completed design.',
    },
    {
      label: 'What the design confirms',
      value:
        listAsSentence(details.indicativePerformance) ||
        listAsSentence(details.performance) ||
        'Final details follow the measured site and selected products.',
    },
    {
      label: 'Installation scope',
      value:
        listAsSentence(details.install) ||
        'Sequence and responsibilities are confirmed in the project proposal.',
    },
    {
      label: 'Care',
      value:
        listAsSentence(details.maintenance) ||
        'Cleaning and inspection follow the current guidance for the selected products.',
    },
  ].filter((row) => row.value);
}

function ProductGallery({
  product,
  placement,
}: ProductDetailPageProps & { placement: 'intro' | 'evidence' }) {
  return (
    <Section
      compact={placement === 'intro'}
      className={placement === 'intro' ? styles.introGallerySection : undefined}
      aria-label={
        placement === 'intro'
          ? `${product.name} gallery`
          : `${product.name} gallery with project evidence`
      }
      data-product-gallery={placement}
    >
      <Container width="wide">
        <StaggeredGallery
          className={placement === 'intro' ? styles.introGallery : undefined}
          items={product.gallery.map((media) => ({
            image: media.src,
            alt: media.alt,
            title: media.caption,
            detail: media.detail,
            objectPosition: media.objectPosition,
          }))}
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
    project.caseStudyHeroImage ??
    project.gallery[1] ??
    project.gallery[0] ??
    project.heroImage;

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
  const alternatives = product.alternatives
    .map(getProductBySlug)
    .filter((item): item is ProductRecord => Boolean(item));
  const alternativeSlugs = new Set(alternatives.map((item) => item.slug));
  const relatedProducts = product.relatedProducts
    .map(getProductBySlug)
    .filter(
      (item): item is ProductRecord =>
        item !== undefined && !alternativeSlugs.has(item.slug),
    );
  const faqs = (product.details.faqs ?? []).map((faq) => ({
    question: faq.q,
    answer: faq.a,
  }));
  const canonical = product.route;
  const specifications = getSpecificationRows(product);
  const heroEnquiryHref = buildEnquiryHref({
    enquiryType: 'residential',
    sourcePath: product.route,
    sourceComponent: 'product-hero',
    productSlug: product.slug,
  });
  const finalEnquiryHref = buildEnquiryHref({
    enquiryType: 'residential',
    sourcePath: product.route,
    sourceComponent: 'product-final',
    productSlug: product.slug,
  });

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
          ...(faqs.length
            ? [
                {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: faqs.map((faq) => ({
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
            <Button href={heroEnquiryHref}>
              Send your project details
            </Button>
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

      <ProductGallery product={product} placement="intro" />

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

      <Section tone="warm">
        <Container width="wide">
          <div className={styles.sectionHeadingRow}>
            <div>
              <Eyebrow>
                {product.variant === 'pergola-form'
                  ? 'What defines the form'
                  : 'What defines the product'}
              </Eyebrow>
              <Heading>
                {product.variant === 'pergola-form'
                  ? 'Geometry only matters when it improves the room.'
                  : 'Integration matters as much as the product itself.'}
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

      <Section id="product-fit">
        <Container width="wide">
          <div className={styles.fitGrid}>
            <div className={styles.fitIntro}>
              <Eyebrow>Fit before features</Eyebrow>
              <Heading>Where it can work, and what still needs an answer.</Heading>
              <Text>
                These are design prompts, not a substitute for measuring the
                house or confirming the selected products.
              </Text>
            </div>
            <MobileProductDisclosure
              kind="works-when"
              summary="When this choice can work"
            >
              <article className={styles.fitColumn}>
                <span className={styles.fitLabel}>It can be a useful choice when</span>
                <ul>
                  {product.decision.worksWhen.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </MobileProductDisclosure>
            <MobileProductDisclosure
              kind="must-resolve"
              summary="What the project must resolve"
            >
              <article className={styles.fitColumn}>
                <span className={styles.fitLabel}>The project must resolve</span>
                <ul>
                  {product.decision.resolve.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </MobileProductDisclosure>
          </div>
        </Container>
      </Section>

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
              Project records describe one measured brief. They show how
              Sanctuary resolved that context, not a guaranteed result for
              every site.
            </Text>
          </div>
          <EvidenceStory product={product} />
        </Container>
      </Section>

      <ProductGallery product={product} placement="evidence" />

      <Section tone="warm">
        <Container>
          <div className={styles.sectionHeadingRow}>
            <div>
              <Eyebrow>Practical specification</Eyebrow>
              <Heading>What exactly needs to be included?</Heading>
            </div>
            <Text>
              The proposal should identify the completed design, selected
              products, installation scope and the information still subject to
              site or supplier confirmation.
            </Text>
          </div>
          <MobileProductDisclosure
            className={styles.specificationDisclosure}
            kind="specification"
            summary="View the proposal checklist"
          >
            <div className={styles.specificationRows}>
              <SpecificationRows rows={specifications} />
            </div>
          </MobileProductDisclosure>
        </Container>
      </Section>

      <Section>
        <Container width="wide">
          <div className={styles.optionsTradeoffs}>
            <div className={styles.optionsColumn}>
              <Eyebrow>Options to decide</Eyebrow>
              <Heading>Choose only after the priorities are clear.</Heading>
              <ul className={styles.plainList}>
                {(product.details.options ?? []).map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
            </div>
            <MobileProductDisclosure
              className={styles.tradeoffDisclosure}
              kind="tradeoffs"
              summary="Review the main trade-offs"
            >
              <div className={styles.tradeoffColumn}>
                <Eyebrow>Honest trade-offs</Eyebrow>
                <div className={styles.tradeoffList}>
                  {product.tradeoffs.map((tradeoff, index) => (
                    <article key={tradeoff.tension}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <Heading as="h3" variant="card">{tradeoff.tension}</Heading>
                      <Text>{tradeoff.guidance}</Text>
                    </article>
                  ))}
                </div>
              </div>
            </MobileProductDisclosure>
          </div>
        </Container>
      </Section>

      <Section tone="neutral">
        <Container width="wide">
          <div className={styles.sectionHeadingRow}>
            <div>
              <Eyebrow>Compare the closest choices</Eyebrow>
              <Heading>Use the tension to narrow the answer.</Heading>
            </div>
            <Text>
              The alternative is not “better” in the abstract. It may suit a
              different priority around openness, height, control or scope.
            </Text>
          </div>
          <div className={styles.alternativeGrid}>
            {alternatives.map((alternative) => (
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
              <Heading>Related decisions work better when planned together.</Heading>
            </div>
            <Text>
              Structure, edges, lighting and electrical items compete for the
              same space. Resolve them before fabrication wherever possible.
            </Text>
          </div>
          <div className={styles.relatedProductGrid}>
            {relatedProducts.map((related) => (
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
              <TextLink href={product.guide.href}>Read the planning guide</TextLink>
            </div>
          </div>
        </Container>
      </Section>

      {faqs.length ? (
        <Section>
          <Container>
            <div className={styles.sectionHeadingRow}>
              <div>
                <Eyebrow>Focused questions</Eyebrow>
                <Heading>What homeowners usually ask next.</Heading>
              </div>
              <Text>
                The final answer follows the measured site, selected product
                and completed design.
              </Text>
            </div>
            <FaqList items={faqs} />
          </Container>
        </Section>
      ) : null}

      <ConversionSection
        eyebrow="Initial project assessment"
        heading={`Could ${product.shortName.toLowerCase()} suit your deck?`}
        copy="Send your suburb, a few photos and rough dimensions. We can assess the house connection, likely constraints and the most useful next step."
        actionLabel="Send your project details"
        href={finalEnquiryHref}
      />
    </main>
  );
}
