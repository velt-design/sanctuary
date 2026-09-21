import Link from 'next/link';
import Image from 'next/image';
import { Container, Eyebrow, Heading } from '../../components/marketing-foundation/Primitives';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import ProductExamplePrice from '../../components/products/ProductExamplePrice';
import { PRODUCT_FORM_CHOICES, PRODUCT_DESIGNS } from '../../components/products/productDesigns';
import type { ProjectFinderHomeDirection } from '../../lib/projectFinderContract';
import styles from './homePergolaSelection.module.css';

type Props = {
  selected?: ProjectFinderHomeDirection;
  onSelect: (direction: ProjectFinderHomeDirection, method: 'pointer' | 'keyboard') => void;
};

export default function HomePergolaSelection({ selected, onSelect }: Props) {
  return <section id="project-finder" className={styles.section} aria-labelledby="project-finder-heading">
    <Container width="wide" id="project-finder-opening" data-project-finder-opening>
      <header className={styles.header}>
        <div><Eyebrow>Made for your home</Eyebrow><Heading id="project-finder-heading">Find your pergola.</Heading></div>
        <div className={styles.introduction}><p>Three rooflines. Made to fit your home.</p>
          <button type="button" className={styles.bespokeLink} aria-expanded={selected === 'bespoke'} onClick={event => onSelect('bespoke', event.detail === 0 ? 'keyboard' : 'pointer')}>Looking for something bespoke? <ArrowUpRight/></button>
        </div>
      </header>
      <p className={styles.estimateNote}>Example prices include GST. Final price subject to site confirmation.</p>
      <div className={styles.grid}>{PRODUCT_FORM_CHOICES.map(choice => <article key={choice.type} className={styles.card} data-product-type={choice.type}>
        <Link className={styles.imageLink} href={`/products/pergolas/${choice.type}`} aria-label={`Explore ${choice.title} pergolas`}>
          <Image src={`/images/portrait-roofline-trial/${PRODUCT_DESIGNS[choice.type].imageFamily}-${choice.type === 'gable' ? 'v1' : 'v2'}.webp`} alt={`${choice.title} pergola illustration with outdoor furniture`} width={1120} height={1400} sizes="(max-width:760px) 100vw, 33vw"/>
        </Link>
        <div className={styles.cardHeading}><Heading as="h3" variant="card">{choice.title}</Heading><p>{choice.type === 'pitched' ? 'A simple, sloping roof.' : choice.type === 'gable' ? 'A raised, open roofline.' : 'A clean, level frame.'}</p></div>
        <ProductExamplePrice type={choice.type} compact/>
        <Link className={styles.explore} href={`/products/pergolas/${choice.type}`}>Explore {choice.title}<ArrowUpRight/></Link>
      </article>)}</div>
      <div className={styles.compare}>
        <div>
          <details><summary>About these estimates</summary><p>Prices in NZD. 6 × 3 m, acrylic roof and open sides, attached to the house at ground level. Pitched and Gable use fascia attachment; Gable has a parallel ridge. Box attaches to the wall. Standard installation allowances included; size, options and site work affect the final price. Generated illustrations; furniture and landscaping excluded.</p></details>
        </div>
        <Link href="/products">Compare pergolas <ArrowUpRight/></Link>
      </div>
      <div className={styles.pathways} aria-label="Other project pathways">
        <button type="button" data-project-direction="bespoke" aria-expanded={selected === 'bespoke'} onClick={event => onSelect('bespoke', event.detail === 0 ? 'keyboard' : 'pointer')}>
          <span><strong>Bespoke design</strong><span>Something different in mind?</span></span><ArrowUpRight/>
        </button>
        <button type="button" data-project-direction="commercial-professional" aria-expanded={selected === 'commercial-professional'} onClick={event => onSelect('commercial-professional', event.detail === 0 ? 'keyboard' : 'pointer')}>
          <span><strong>Commercial &amp; professionals</strong><span>For venues, architects, designers and builders.</span></span><ArrowUpRight/>
        </button>
      </div>
    </Container>
  </section>;
}
