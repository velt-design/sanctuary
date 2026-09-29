'use client';
import { type ReactNode, useMemo, useState } from 'react';
import Image from 'next/image';
import { Container, Eyebrow, Heading, TextLink } from '../marketing-foundation/Primitives';
import { PRODUCT_DESIGNS, PRODUCT_FORM_CHOICES } from './productDesigns';
import { INITIAL_PRODUCT_SELECTION } from './productSelection';
import ProductCard from './ProductCard';
import styles from './product-hub.module.css';

export default function PergolaSelection({ comparison }: { comparison: ReactNode }) {
  const [widthMm, setWidthMm] = useState(6000);
  const selection = useMemo(() => ({ ...INITIAL_PRODUCT_SELECTION, widthMm }), [widthMm]);
  return <section className={styles.selection} id="pergola-forms" aria-labelledby="products-title">
    <Container width="wide">
      <header className={styles.intro}>
        <div><Eyebrow>For your home</Eyebrow><Heading as="h1" id="products-title" variant="display">Pergolas.</Heading></div>
        <p>Three rooflines. A different way to shape your outdoor space.</p>
      </header>
      <nav className={styles.shapeOverview} aria-label="Explore the three rooflines">
        {PRODUCT_FORM_CHOICES.map(choice => <a key={choice.type} href={`#compare-${choice.type}`}>
          <Image src={`/images/homepage-challenger-rooflines/${PRODUCT_DESIGNS[choice.type].imageFamily}-daylight.webp`} alt="" width={1120} height={1400} sizes="(max-width:760px) 30vw, 1px" />
          <span>{choice.title} <span aria-hidden="true">↘</span></span>
        </a>)}
      </nav>
      <div className={styles.comparisonBar}>
        <fieldset className={styles.sizes}><legend>Compare an example size</legend><div>
          {[3000, 6000, 9000].map(width => <label key={width}><input type="radio" name="example-size" value={width} checked={widthMm === width} onChange={() => setWidthMm(width)} /><span>{width / 1000} × 3 m</span></label>)}
        </div></fieldset>
        <p>Acrylic roof · Open sides<br />Installed estimates include GST.</p>
      </div>
      <div className={styles.grid} data-product-form-grid>{PRODUCT_FORM_CHOICES.map((choice, index) => <ProductCard key={choice.type} {...choice} selection={selection} priority={index === 0} />)}</div>
      <p className={styles.note}>Example estimates, subject to site confirmation. Explore a roofline to choose size, roof and sides, or return to your saved design.</p>
      <details className={styles.assumptions}><summary>Example details &amp; illustrations</summary><p>Sizes are width × projection in metres. NZD, rounded to the nearest $100 for comparison. Standard installation allowances included. House-attached at ground level: Pitched and Gable use fascia attachment; Gable has a parallel ridge and open ends. Box attaches to the wall. Size, options and site work affect the final price. Generated design illustrations show the rooflines, not the selected dimensions; furniture and landscaping excluded. Product links preserve your saved choices.</p></details>
      <details className={styles.comparison}><summary>Compare rooflines in more detail <span aria-hidden="true">+</span></summary>{comparison}</details>
      <TextLink className={styles.bespokeLink} href="#bespoke-design">Looking for a bespoke design?</TextLink>
    </Container>
  </section>;
}
