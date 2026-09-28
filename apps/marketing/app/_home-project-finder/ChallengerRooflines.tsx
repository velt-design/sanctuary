import Image from 'next/image';
import Link from 'next/link';
import { Container } from '../../components/marketing-foundation/Primitives';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import ProductExamplePrice from '../../components/products/ProductExamplePrice';
import { PRODUCT_FORM_CHOICES, PRODUCT_DESIGNS } from '../../components/products/productDesigns';
import type { ProjectFinderHomeDirection } from '../../lib/projectFinderContract';
import styles from './challengerHomepage.module.css';

type Props = {
  selected?: ProjectFinderHomeDirection;
  onSelect: (direction: ProjectFinderHomeDirection, method: 'pointer' | 'keyboard') => void;
};

export default function ChallengerRooflines({ selected, onSelect }: Props) {
  return <section id="project-finder" className={styles.rooflines} aria-labelledby="project-finder-heading">
    <Container width="wide" id="project-finder-opening" data-project-finder-opening>
      <header className={styles.sectionHeader}>
        <h2 id="project-finder-heading">Choose your roofline.</h2>
        <Link href="/products">Compare pergolas <ArrowUpRight /></Link>
      </header>
      <p className={styles.priceNote}>6 × 3 m · Acrylic roof · Open sides<br />Installed estimates include GST. Subject to site confirmation.</p>
      <div className={styles.rooflineGrid}>{PRODUCT_FORM_CHOICES.map(choice => <article key={choice.type} className={styles.roofline} data-product-type={choice.type}>
        <Link className={styles.rooflineImage} href={`/products/pergolas/${choice.type}`} aria-label={`Explore ${choice.title} pergolas`}>
          <Image src={`/images/portrait-roofline-trial/${PRODUCT_DESIGNS[choice.type].imageFamily}-${choice.type === 'gable' ? 'v1' : 'v2'}.webp`} alt={`${choice.title} pergola design illustration, attached to a house`} width={1120} height={1400} sizes="(max-width:760px) 42vw, 30vw" />
        </Link>
        <div className={styles.rooflineBody}>
          <h3><Link href={`/products/pergolas/${choice.type}`}>{choice.title}<ArrowUpRight /></Link></h3>
          <p className={styles.rooflineDescription}>{choice.type === 'pitched' ? 'A simple slope.' : choice.type === 'gable' ? 'An open, raised ridge.' : 'A level outer frame.'}</p>
          <ProductExamplePrice type={choice.type} compact />
        </div>
      </article>)}</div>
      <details className={styles.estimateDetails}><summary>Estimate details &amp; illustrations</summary><p>Prices in NZD. The example is attached to the house at ground level. Pitched and Gable use fascia attachment; Gable has a parallel ridge. Box attaches to the wall. Standard installation allowances included; size, options and site work affect the final price. Generated design illustrations; furniture and landscaping excluded. Product links preserve your saved choices.</p></details>
      <div className={styles.pathways} aria-label="Other project pathways">
        <button type="button" data-project-direction="bespoke" aria-expanded={selected === 'bespoke'} onClick={event => onSelect('bespoke', event.detail === 0 ? 'keyboard' : 'pointer')}>Bespoke design <ArrowUpRight /></button>
        <button type="button" data-project-direction="commercial-professional" aria-expanded={selected === 'commercial-professional'} onClick={event => onSelect('commercial-professional', event.detail === 0 ? 'keyboard' : 'pointer')}>Commercial &amp; professionals <ArrowUpRight /></button>
      </div>
    </Container>
  </section>;
}
