import editorial from '../marketing-foundation/editorial/editorial.module.css';
import JsonLd from '../JsonLd';
import { products } from '../../data/products';
import { absoluteUrl } from '../../lib/seo';
import PergolaSelection from './PergolaSelection';
import ProductComparisonSelection from './ProductComparisonSelection';
import { Suspense } from 'react';
import ProductFormComparison from './ProductFormComparison';
import ProductHubDetails from './ProductHubDetails';
import styles from './product-pages.module.css';
import hub from './product-hub.module.css';

export default function ProductsHub() {
  return <main className={`${styles.productExperience} ${editorial.surface} ${hub.overview}`} data-editorial-page="products" data-marketing-foundation-page data-products-index>
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

    <Suspense fallback={<PergolaSelection comparison={<ProductFormComparison />} table={{ status: 'loading' }} />}>
      <ProductComparisonSelection comparison={<ProductFormComparison />} />
    </Suspense>
    <ProductHubDetails />
  </main>;
}
