import cardLinks from '@/components/marketing-foundation/cardLinks.module.css';
import editorial from '@/components/marketing-foundation/editorial/editorial.module.css';
import JsonLd from '@/components/JsonLd';
import {
  Container,
  Eyebrow,
  Heading,
  Section,
  Text,
  TextLink,
} from '@/components/marketing-foundation/Primitives';
import {
  ProjectStory,
} from '@/components/marketing-foundation/Patterns';
import {
  products,
} from '@/data/products';
import { absoluteUrl } from '@/lib/seo';
import PergolaSelection from './PergolaSelection';
import { buildAssistedEnquiryHref } from '@/lib/configuratorEntry';
import { buildProductHubViewModel } from './productHubViewModel';
import styles from './product-pages.module.css';

export default function ProductsHub() {
  const {
    guideLinks,
    optionGateways,
    projectStories,
  } = buildProductHubViewModel();

  return (
    <main
      className={`${styles.productExperience} ${editorial.surface}`}
      data-editorial-page="products"
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
            numberOfItems: products.filter(product => product.slug !== 'hip').length,
            itemListElement: products.filter(product => product.slug !== 'hip').map((product, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: product.name,
              url: absoluteUrl(product.route),
            })),
          },
        ]}
      />

      <PergolaSelection />
      <Section id="bespoke-design" tone="warm">
        <Container width="wide"><div className={styles.sectionHeadingRow}>
          <div><Eyebrow>Bespoke design</Eyebrow><Heading>A different shape.<br/>A particular space.</Heading></div>
          <div><Text>Work with us on a pergola designed around your home. Share your ideas, photos or plans, and we’ll help shape the design.</Text><TextLink href={buildAssistedEnquiryHref({ sourcePath: '/products', sourceComponent: 'product_cta' }, 'bespoke')}>Discuss a bespoke design</TextLink></div>
        </div></Container>
      </Section>

      <Section tone="neutral">
        <Container width="wide">
          <div className={styles.sectionHeadingRow}><div><Eyebrow>The finishing details</Eyebrow><Heading>Make it yours.</Heading></div><Text>Add privacy, shelter or a little more time outside.</Text></div>
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
                      <li key={product.slug} className={cardLinks.surface}>
                        <TextLink className={cardLinks.hitLink} href={product.route}>
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
              <Heading>Made for a real home.</Heading>
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

    </main>
  );
}
