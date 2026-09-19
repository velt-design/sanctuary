import { Heading, Text, TextLink } from '../marketing-foundation/Primitives';
import { buildProductHubViewModel } from './productHubViewModel';
import styles from './product-pages.module.css';
import DecisionTrackingRegion from '../journey/DecisionTrackingRegion';

export default function ProductFormComparison() {
  const { comparisonRows } = buildProductHubViewModel();
  return <DecisionTrackingRegion source="product_comparison"><div className={styles.formComparisonSection} data-product-form-comparison>
    <Heading as="h3" variant="card">Compare the shape and what it asks of the site.</Heading>
    <Text>Roof material, orientation and nearby rooms affect daylight separately from the form. Confirm heights, connections and drainage against your site.</Text>
    <div role="table" aria-label="Pergola form comparison" className={styles.formComparison}>
      <div role="row" className={styles.comparisonHeader}>
        {['Form', 'Roof shape', 'Consider when', 'Check on your site'].map(label => <span role="columnheader" key={label}>{label}</span>)}
      </div>
      {comparisonRows.map(row => <div role="row" key={row.product.slug} className={styles.comparisonRow}>
        <div role="rowheader"><TextLink href={row.product.route} data-journey-action="compare" data-journey-destination="product">{row.product.shortName}</TextLink></div>
        <div role="cell" data-label="Roof shape">{row.geometry}</div>
        <div role="cell" data-label="Consider when">{row.usefulWhen}</div>
        <div role="cell" data-label="Check on your site">{row.constraint}</div>
      </div>)}
    </div>
  </div></DecisionTrackingRegion>;
}
