import Image from 'next/image';
import Link from 'next/link';
import { Container } from '../../components/marketing-foundation/Primitives';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import ChallengerPriceExamples from './ChallengerPriceExamples';
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
      </header>
      <p className={styles.priceNote}>Acrylic roof · Open sides<br />Installed estimates include GST. Subject to site confirmation.</p>
      <div className={styles.rooflineGrid}>{PRODUCT_FORM_CHOICES.map(choice => <article key={choice.type} className={styles.roofline} data-product-type={choice.type}>
        <Link className={styles.rooflineImage} href={`/products/pergolas/${choice.type}`} aria-label={`Explore ${choice.title} pergolas`}>
          <Image src={`/images/homepage-challenger-rooflines/${PRODUCT_DESIGNS[choice.type].imageFamily}-daylight.webp`} alt={`${choice.title} pergola design illustration, attached to a house`} width={1120} height={1400} sizes="(max-width:760px) 42vw, 30vw" />
        </Link>
        <div className={styles.rooflineBody}>
          <h3><Link href={`/products/pergolas/${choice.type}`}>{choice.title}<ArrowUpRight /></Link></h3>
          <ChallengerPriceExamples type={choice.type} />
        </div>
      </article>)}</div>
      <Link className={styles.compareRooflines} href="/products">Compare pergolas <ArrowUpRight /></Link>
      <details className={styles.estimateDetails}><summary>Estimate details &amp; illustrations</summary><p>Example sizes are width × projection, in metres. Prices in NZD, rounded to the nearest $100 for comparison. Each example is attached to the house at ground level. Pitched and Gable use fascia attachment; Gable has a parallel ridge. Box attaches to the wall. Standard installation allowances included; size, options and site work affect the final price. Generated design illustrations; furniture and landscaping excluded. Product links preserve your saved choices.</p></details>
      <div className={styles.pathways} aria-label="Other project pathways">
        <button type="button" data-project-direction="bespoke" aria-expanded={selected === 'bespoke'} onClick={event => onSelect('bespoke', event.detail === 0 ? 'keyboard' : 'pointer')}>Bespoke design <ArrowUpRight /></button>
        <button type="button" data-project-direction="commercial-professional" aria-expanded={selected === 'commercial-professional'} onClick={event => onSelect('commercial-professional', event.detail === 0 ? 'keyboard' : 'pointer')}>Commercial &amp; professionals <ArrowUpRight /></button>
      </div>
    </Container>
  </section>;
}
