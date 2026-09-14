import type { ConfiguratorPublicPrice } from '../../lib/configuratorPublicPrice';
import { reviewMoney } from './ReviewPriceDisplay';
import styles from './prototype.module.css';

export default function PublishedPriceDisplay({ value, retry }: { value: ConfiguratorPublicPrice | null; retry: () => void }) {
  if (!value) return <p className={styles.priceValue}>Updating estimate…</p>;
  if (value.status === 'custom') return <><p className={styles.priceValue}>Price to be confirmed.</p><p className={styles.small}>{value.reason}</p></>;
  if (value.status !== 'priced') return <><p>Estimate unavailable. You can keep designing and request a site measure.</p><button className={styles.textButton} onClick={retry}>Retry estimate ↗</button></>;
  return <><p className={styles.priceValue}>{reviewMoney(value.amountIncGst)}</p>
    <p className={styles.small}>Installed estimate · Including GST · Subject to site confirmation</p>
    <details><summary>See price breakdown · including GST</summary><dl>{value.breakdown.map((line, index) =>
      <div key={index}><dt>{line.label}</dt><dd>{reviewMoney(line.amountIncGst)}</dd></div>)}</dl></details>
    <p className={styles.small}>Selected accessories are included. Foundations, unusual access or fixings, new electrical supply and travel outside our service area are assessed separately before you commit.</p>
  </>;
}
