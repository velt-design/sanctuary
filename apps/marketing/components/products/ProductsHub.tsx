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
import ProductCard from './ProductCard';
import { buildProductHubViewModel } from './productHubViewModel';
import styles from './product-pages.module.css';

export default function ProductsHub() {
  const enquiryHref = buildEnquiryHref({
    sourcePath: '/products',
    sourceComponent: 'product_cta',
  });
  const {
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
            name: 'Sanctuary pergola forms and options',
            description:
              'Compare pergola forms, screens, lighting and heating for a custom Sanctuary outdoor room.',
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
          <Eyebrow>Pergola choices</Eyebrow>
          <Heading as="h1" variant="display">
            Pergola forms and options.
          </Heading>
          <Text size="large">
            Choose a roof form, then add only the edges, lighting or heat the
            space needs.
          </Text>
          <div className={styles.heroActions}>
            <Button href={enquiryHref}>Send project brief</Button>
            <TextLink href="#pergola-forms">See the options</TextLink>
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

      <Section tone="neutral">
        <Container width="wide">
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
                  <Heading as="h2" variant="card">{category.heading}</Heading>
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
              <Eyebrow>Built example</Eyebrow>
              <Heading>One brief, one response.</Heading>
            </div>
          </div>
          <div className={styles.projectGrid} data-product-project-grid>
            {projectStories.map((project) => (
              <ProjectStory
                key={project.slug}
                image={project.heroImage.src}
                alt={project.heroImage.alt}
                objectPosition={project.heroImage.objectPosition}
                title={project.title}
                metadata={[project.location, project.type, project.roof]}
                copy={project.blurb}
                href={`/projects/${project.slug}`}
              />
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="warm">
        <Container>
          {guideLinks.map((guide) => (
            <div className={styles.guideFeature} key={guide.href}>
              <div>
                <Eyebrow>Planning guide</Eyebrow>
                <Heading>{guide.label}</Heading>
              </div>
              <div>
                <Text>{guide.copy}</Text>
                <TextLink href={guide.href}>Read guide</TextLink>
              </div>
            </div>
          ))}
        </Container>
      </Section>

      <ConversionSection
        eyebrow="Project brief"
        heading="Not sure which option fits?"
        copy="Send your suburb, photos and rough dimensions."
        actionLabel="Send project brief"
        href={enquiryHref}
      />
    </main>
  );
}
