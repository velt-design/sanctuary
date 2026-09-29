'use client';
import { type ReactNode, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Container, Heading } from '../marketing-foundation/Primitives';
import { PRODUCT_DESIGNS, PRODUCT_FORM_CHOICES } from './productDesigns';
import { INITIAL_PRODUCT_SELECTION } from './productSelection';
import ProductCard from './ProductCard';
import styles from './product-hub.module.css';

import { COMPARISON_SIZES, type ProductComparisonTable } from './productComparisonTable';

export default function PergolaSelection({ comparison, table }: { comparison: ReactNode; table: ProductComparisonTable }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [sizeIndex, setSizeIndex] = useState(2);
  const currentTable: ProductComparisonTable = refreshing ? { status: 'loading' } : table;
  const selection = useMemo(() => ({ ...INITIAL_PRODUCT_SELECTION, widthMm: COMPARISON_SIZES[sizeIndex][0], projectionMm: COMPARISON_SIZES[sizeIndex][1] }), [sizeIndex]);
  return <section className={styles.selection} id="pergola-forms" aria-labelledby="products-title">
    <Container width="wide">
      <header className={styles.intro}>
        <Heading as="h1" id="products-title" variant="display">Pergolas.</Heading>
      </header>
      <nav className={styles.shapeOverview} aria-label="Explore the three rooflines">
        {PRODUCT_FORM_CHOICES.map(choice => <a key={choice.type} href={`#compare-${choice.type}`}>
          <Image src={`/images/homepage-challenger-rooflines/${PRODUCT_DESIGNS[choice.type].imageFamily}-daylight.webp`} alt="" width={1120} height={1400} sizes="(max-width:760px) 30vw, 1px" />
          <span>{choice.title} <span aria-hidden="true">↘</span></span>
        </a>)}
      </nav>
      <div className={styles.comparisonBar}>
        <fieldset className={styles.sizes} disabled={currentTable.status !== 'priced'}><legend>Width × projection</legend><div>
          {COMPARISON_SIZES.map(([width, projection], index) => <label key={`${width}-${projection}`}><input type="radio" name="example-size" value={`${width}-${projection}`} checked={sizeIndex === index} onChange={() => setSizeIndex(index)} /><span>{width / 1000} × {projection / 1000} m</span></label>)}
        </div></fieldset>
        <p>Acrylic roof · Open sides<br />Installed estimates include GST.</p>
      </div>
      <div className={styles.grid} data-product-form-grid data-price-version={currentTable.status === 'priced' ? currentTable.versionNumber : undefined}>{PRODUCT_FORM_CHOICES.map((choice, index) => <ProductCard key={choice.type} {...choice} selection={selection} table={currentTable} priority={index === 0} />)}</div>
      <div className={styles.tableStatus} aria-live="polite">{currentTable.status !== 'priced' && (currentTable.status === 'loading' ? <span>Loading comparison estimates…</span> : <button type="button" onClick={() => startRefresh(() => router.refresh())}>Retry estimates</button>)}</div>
      <p className={styles.note}>Example estimates, subject to site confirmation. Explore a roofline to choose size, roof and sides, or return to your saved design.</p>
      <p className={styles.illustrationNote}>Design illustrations show the rooflines, not the selected dimensions.</p>
      <details className={styles.comparison}><summary>Comparison details <span aria-hidden="true">+</span></summary><p className={styles.assumptions}>Sizes are width × projection in metres. NZD, rounded to the nearest $100 for comparison. Standard installation allowances included. House-attached at ground level: Pitched and Gable use fascia attachment; Gable has a parallel ridge and open ends. Box attaches to the wall. Size, options and site work affect the final price. Illustrations are generated; furniture and landscaping excluded. Product links preserve your saved choices.</p>{comparison}</details>
    </Container>
  </section>;
}
