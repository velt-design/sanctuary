import Image from 'next/image';
import JsonLd from '@/components/JsonLd';
import {
  Button,
  Container,
  Eyebrow,
  Heading,
  Section,
  Text,
  TextLink,
} from '@/components/marketing-foundation/Primitives';
import {
  ConversionSection,
  ProjectStory,
} from '@/components/marketing-foundation/Patterns';
import {
  productCategories,
  products,
} from '@/data/products';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import { absoluteUrl } from '@/lib/seo';
import MobileProductDisclosure from './MobileProductDisclosure';
import ProductCard from './ProductCard';
import { buildProductHubViewModel } from './productHubViewModel';
import styles from './product-pages.module.css';

export default function ProductsHub() {
  const enquiryHref = buildEnquiryHref({
    sourcePath: '/products',
    sourceComponent: 'product_cta',
  });
  const {
    comparisonRows,
    guideLinks,
    optionGateways,
    pergolaForms,
    projectStories,
  } = buildProductHubViewModel();

  return (
    <main
      className={styles.productExperience}
      data-marketing-foundation-page
      data-products-index
    >
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Sanctuary pergola forms and integrated options',
            description:
              'Compare pergola forms, screens, edge treatments, lighting and heating for a custom Sanctuary outdoor room.',
            url: absoluteUrl('/products'),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Sanctuary pergola products',
            numberOfItems: products.length,
            itemListElement: products.map((product, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: product.name,
              url: absoluteUrl(product.route),
            })),
          },
        ]}
      />

      <section className={styles.indexHero}>
        <div className={styles.indexHeroMedia}>
          <Image
            src="/images/project-riverhead-gable-01.jpg"
            alt="Riverhead gable pavilion beside a pool and garden"
            fill
            loading="eager"
            fetchPriority="high"
            sizes="100vw"
            style={{ objectPosition: '50% 45%' }}
          />
        </div>
        <div className={styles.heroShade} aria-hidden="true" />
        <Container width="wide" className={styles.indexHeroContent}>
          <Eyebrow>Pergola forms and integrated options</Eyebrow>
          <Heading as="h1" variant="display">
            Cover the deck. Keep the light.
          </Heading>
          <Text size="large">
            Sanctuary designs the roof, edges and evening comfort around the
            house and the way you want to use the room.
          </Text>
          <div className={styles.heroActions}>
            <Button href={enquiryHref}>
              Send your project details
            </Button>
            <TextLink href="#pergola-forms">Compare the choices</TextLink>
          </div>
        </Container>
      </section>

      <Section tone="warm" id="pergola-forms">
        <Container width="wide">
          <div className={styles.chapterHeading}>
            <div>
              <Eyebrow>{productCategories[0].label}</Eyebrow>
              <Heading>{productCategories[0].heading}</Heading>
            </div>
            <Text size="large">{productCategories[0].introduction}</Text>
          </div>
          <div className={styles.formGrid} data-product-form-grid>
            {pergolaForms.map((product, index) => (
              <ProductCard
                key={product.slug}
                product={product}
                priority={index === 0}
                number={index + 1}
              />
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container width="wide">
          <div className={styles.sectionHeadingRow}>
            <div>
              <Eyebrow>Compare the consequence</Eyebrow>
              <Heading>The form is more than a silhouette.</Heading>
            </div>
            <Text>
              Compare the practical consequence of each shape. The measured
              house, drainage path and completed structure decide what is
              feasible.
            </Text>
          </div>
          <MobileProductDisclosure
            className={styles.formComparisonDisclosure}
            kind="form-comparison"
            summary="Compare all four forms"
          >
            <div
              className={styles.formComparison}
              role="table"
              aria-label="Comparison of Sanctuary pergola forms"
            >
              <div className={styles.comparisonHeader} role="row">
                <div role="columnheader">Form</div>
                <div role="columnheader">Defining geometry</div>
                <div role="columnheader">Useful conditions</div>
                <div role="columnheader">Important constraint</div>
              </div>
              {comparisonRows.map((row) => (
                <div
                  className={styles.comparisonRow}
                  role="row"
                  key={row.product.slug}
                >
                  <div role="rowheader">
                    <TextLink href={row.product.route}>
                      {row.product.shortName}
                    </TextLink>
                  </div>
                  <div role="cell" data-label="Geometry">{row.geometry}</div>
                  <div role="cell" data-label="Useful when">{row.usefulWhen}</div>
                  <div role="cell" data-label="Constraint">{row.constraint}</div>
                </div>
              ))}
            </div>
          </MobileProductDisclosure>
        </Container>
      </Section>

      <Section tone="neutral">
        <Container width="wide">
          <div className={styles.chapterHeading}>
            <div>
              <Eyebrow>Complete the outdoor room</Eyebrow>
              <Heading>Control the edges. Plan the evening.</Heading>
            </div>
            <Text size="large">
              Add only what makes the room work better. A fixed screen,
              deployable blind, lighting layer or heater each solves a
              different problem and brings different coordination needs.
            </Text>
          </div>
          <div className={styles.optionGatewayGrid}>
            {optionGateways.map(
              ({ category, products: optionProducts }, index) => (
                <article
                  className={styles.optionGateway}
                  id={category.slug}
                  key={category.slug}
                  data-product-option-gateway={category.slug}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <Heading as="h3" variant="card">{category.label}</Heading>
                  <Text>{category.introduction}</Text>
                  <ul className={styles.optionLinkList}>
                    {optionProducts.map((product) => (
                      <li key={product.slug}>
                        <TextLink href={product.route}>
                          {product.shortName}
                        </TextLink>
                        <Text>{product.indexSummary}</Text>
                      </li>
                    ))}
                  </ul>
                </article>
              ),
            )}
          </div>
        </Container>
      </Section>

      <Section>
        <Container width="wide">
          <div className={styles.sectionHeadingRow}>
            <div>
              <Eyebrow>Built evidence</Eyebrow>
              <Heading>Different houses lead to different answers.</Heading>
            </div>
            <Text>
              These projects show how form, light, exposure and connection were
              resolved for specific briefs. They are evidence, not templates.
            </Text>
          </div>
          <div className={styles.projectGrid} data-product-project-grid>
            {projectStories.map((project) => (
              <ProjectStory
                key={project.slug}
                image={project.heroImage.src}
                alt={project.heroImage.alt}
                objectPosition={project.heroImage.objectPosition}
                title={project.title}
                metadata={[
                  project.location,
                  project.type,
                  project.roof,
                  project.year,
                ]}
                copy={project.blurb}
                href={`/projects/${project.slug}`}
              />
            ))}
          </div>
          <div className={styles.allProjectsLink}>
            <TextLink href="/projects">View all completed projects</TextLink>
          </div>
        </Container>
      </Section>

      <Section tone="warm">
        <Container>
          <div className={styles.sectionHeadingRow}>
            <div>
              <Eyebrow>Planning guides</Eyebrow>
              <Heading>Go deeper when you are ready.</Heading>
            </div>
            <Text>
              Product pages help you choose a direction. These guides explain
              the planning questions, scope and trade-offs in more detail.
            </Text>
          </div>
          <MobileProductDisclosure
            className={styles.guideDisclosure}
            kind="planning-guides"
            summary="Explore planning guides"
          >
            <ul className={styles.guideLinkList}>
              {guideLinks.map((guide) => (
                <li key={guide.href}>
                  <div>
                    <Heading as="h3" variant="card">{guide.label}</Heading>
                    <Text>{guide.copy}</Text>
                  </div>
                  <TextLink href={guide.href}>Read the guide</TextLink>
                </li>
              ))}
            </ul>
          </MobileProductDisclosure>
        </Container>
      </Section>

      <ConversionSection
        eyebrow="Initial project assessment"
        heading="Show us the deck, the house and what you want to improve."
        copy="Send your suburb, a few photos and rough dimensions. We can give you an initial view on suitable forms, the questions to resolve and a useful next step."
        actionLabel="Send your project details"
        href={enquiryHref}
      />
    </main>
  );
}
