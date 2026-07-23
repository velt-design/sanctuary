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
  getProductsByCategory,
  productCategories,
  products,
} from '@/data/products';
import { projects } from '@/data/projects';
import { absoluteUrl } from '@/lib/seo';
import ProductCard from './ProductCard';
import styles from './product-pages.module.css';

const formComparison = [
  {
    slug: 'pitched',
    geometry: 'One roof plane',
    usefulWhen: 'Height is tighter or the new roof should sit quietly beside the house.',
    constraint: 'High edge, low edge, fall and discharge must work together.',
  },
  {
    slug: 'gable',
    geometry: 'Two planes and a ridge',
    usefulWhen: 'The deck benefits from height, symmetry and a pavilion-like room.',
    constraint: 'Ridge height and gable ends make the roof more visually present.',
  },
  {
    slug: 'hip',
    geometry: 'Several planes and hips',
    usefulWhen: 'The room is seen from several sides or responds to corners.',
    constraint: 'More roof junctions and drainage directions need resolution.',
  },
  {
    slug: 'box-perimeter',
    geometry: 'Level outer frame',
    usefulWhen: 'A crisp horizontal line suits a contemporary house or outlook.',
    constraint: 'The perimeter must contain structure, roof fall and drainage access.',
  },
] as const;

const guideLinks = [
  {
    href: '/pergola-cost-auckland',
    label: 'Pergola cost and scope',
    copy: 'Understand what changes scope before comparing quotes or expecting a useful estimate.',
  },
  {
    href: '/custom-pergolas-auckland',
    label: 'Why custom design matters',
    copy: 'See how measured levels, the house connection and project priorities shape the result.',
  },
  {
    href: '/pergolas-with-blinds',
    label: 'Planning screens and blinds',
    copy: 'Compare fixed and deployable edges before deciding how open the room should feel.',
  },
];

export default function ProductsHub() {
  const pergolaForms = getProductsByCategory('pergolas');
  const edgeProducts = getProductsByCategory('screens-walls');
  const comfortProducts = getProductsByCategory('lighting-heating');
  const projectStories = [
    projects.find((project) => project.slug === 'warkworth-outdoor-room'),
    projects.find((project) => project.slug === 'muriwai-courtyard'),
    projects.find((project) => project.slug === 'waiheke-holiday-home'),
  ].filter((project): project is (typeof projects)[number] => Boolean(project));

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
            <Button href="/contact?enquiry=residential#contact-form">
              Send your project details
            </Button>
            <TextLink href="#pergola-forms">Compare the choices</TextLink>
          </div>
        </Container>
      </section>

      <Section>
        <Container>
          <div className={styles.introGrid}>
            <div>
              <Eyebrow>Start with the problem</Eyebrow>
              <Heading>What needs to change about the deck?</Heading>
            </div>
            <div className={styles.introCopy}>
              <Text size="large">
                You may want shelter from rain, less low sun, more privacy or a
                space that works after dark. The useful product choice follows
                that outcome.
              </Text>
              <Text>
                Roof shape then affects light, height, drainage and how the
                addition fits the house. Screens and services complete the room
                only where they solve a real edge or comfort problem.
              </Text>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="warm" id="pergola-forms">
        <Container width="wide">
          <div className={styles.chapterHeading}>
            <div>
              <Eyebrow>{productCategories[0].label}</Eyebrow>
              <Heading>{productCategories[0].heading}</Heading>
            </div>
            <Text size="large">{productCategories[0].introduction}</Text>
          </div>
          <div className={styles.formGrid}>
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
              This is a starting comparison. The measured house, drainage path
              and completed structure decide what is feasible.
            </Text>
          </div>
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
            {formComparison.map((row) => {
              const product = products.find((item) => item.slug === row.slug);
              if (!product) return null;
              return (
                <div className={styles.comparisonRow} role="row" key={row.slug}>
                  <div role="rowheader">
                    <TextLink href={product.route}>{product.shortName}</TextLink>
                  </div>
                  <div role="cell" data-label="Geometry">{row.geometry}</div>
                  <div role="cell" data-label="Useful when">{row.usefulWhen}</div>
                  <div role="cell" data-label="Constraint">{row.constraint}</div>
                </div>
              );
            })}
          </div>
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
          <div
            className={styles.optionChapter}
            id={productCategories[1].slug}
          >
            <div className={styles.optionChapterHeading}>
              <span>01</span>
              <div>
                <Heading as="h3" variant="card">
                  {productCategories[1].label}
                </Heading>
                <Text>{productCategories[1].introduction}</Text>
              </div>
            </div>
            <div className={styles.optionGrid}>
              {edgeProducts.map((product) => (
                <ProductCard key={product.slug} product={product} compact />
              ))}
            </div>
          </div>
          <div
            className={styles.optionChapter}
            id={productCategories[2].slug}
          >
            <div className={styles.optionChapterHeading}>
              <span>02</span>
              <div>
                <Heading as="h3" variant="card">
                  {productCategories[2].label}
                </Heading>
                <Text>{productCategories[2].introduction}</Text>
              </div>
            </div>
            <div className={styles.optionGrid}>
              {comfortProducts.map((product) => (
                <ProductCard key={product.slug} product={product} compact />
              ))}
            </div>
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
          <div className={styles.projectGrid}>
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
          <div className={styles.guideGrid}>
            {guideLinks.map((guide, index) => (
              <article className={styles.guideCard} key={guide.href}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <Heading as="h3" variant="card">{guide.label}</Heading>
                <Text>{guide.copy}</Text>
                <TextLink href={guide.href}>Read the guide</TextLink>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <ConversionSection
        eyebrow="Initial project assessment"
        heading="Show us the deck, the house and what you want to improve."
        copy="Send your suburb, a few photos and rough dimensions. We can give you an initial view on suitable forms, the questions to resolve and a useful next step."
        actionLabel="Send your project details"
        href="/contact?enquiry=residential#contact-form"
      />
    </main>
  );
}
