import { hasSimpleRoofPrice } from "./roofFinish";
import Link from 'next/link';
import type { PreviewSelection } from './ConfiguratorPrototype';
import ShareDesign from './ShareDesign';
import styles from './journey.module.css';

export default function PreviewNextAction({ selection }: { selection: PreviewSelection }) {
  const { roof, input, result } = selection;
  const priced = hasSimpleRoofPrice(roof) && result?.status === 'priced' ? result : null;
  const label = !hasSimpleRoofPrice(roof) || result?.status === 'custom' ? 'Pricing confirmed by Sanctuary'
    : !result ? 'Updating estimate…' : 'Estimate unavailable';
  return <footer className={styles.next} aria-label="Continue your design">
    <div className={styles.nextRow}>
      <div className={styles.estimate}>
        <strong>{priced ? `From ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(priced.price.fromIncGst)}` : label}</strong>
        {priced && <span>Incl. GST · Subject to site confirmation</span>}
      </div>
      <Link href="/contact?configurator=preview" prefetch={false} aria-label="Continue with this design">Continue ↗</Link>
    </div>
    <ShareDesign draft={{ version: 1, input, roof }} />
  </footer>;
}
