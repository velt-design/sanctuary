'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { simpleCoverAreaM2 } from '../../lib/simpleCoverCalculator';
import { INITIAL_INPUT, metres, constrainPreviewConnection } from './model';
import PreviewControls from './PreviewControls';
import { usePreviewPrice } from './usePreviewPrice';
import { usePreviewDimension } from './usePreviewDimension';
import styles from './prototype.module.css';
import { INITIAL_ROOF } from './GableChoices';

const PreviewViews = dynamic(() => import('./PreviewViews'), {
  ssr: false, loading: () => <div className={styles.loading} role="status">Preparing your pergola…</div>,
});

export default function ConfiguratorPrototype({ expanded, onToggleExpanded }: { expanded: boolean; onToggleExpanded: () => void }) {
  const [input, setInput] = useState(INITIAL_INPUT);
  const [roof, setRoof] = useState(INITIAL_ROOF);
  const { result, retry } = usePreviewPrice(input, roof.family === 'mono');
  const { activeDimension, showDimension } = usePreviewDimension();
  return <div className={styles.page}>
    <div className={styles.workspace}>
      <div className={styles.visualSlot}>
      <section className={styles.visual} aria-label="Pergola views" data-expanded={expanded}>
        <PreviewViews input={input} roof={roof} activeDimension={activeDimension} expanded={expanded} onToggleExpanded={onToggleExpanded} />
        <div className={styles.specStrip}><span><strong>{metres(input.widthMm)}</strong> width</span><span><strong>{metres(input.projectionMm)}</strong> projection</span><span><strong>{simpleCoverAreaM2(input).toFixed(1)} m²</strong> covered space</span></div>
      </section>
      </div>
      <aside className={styles.sidebar} aria-label="Your pergola choices">
        <PreviewControls input={input} roof={roof} onRoofChange={next => {setInput(current => constrainPreviewConnection(current,next.family));setRoof(next);}} onChange={setInput} onDimensionActivity={showDimension} />
        <section className={styles.price} aria-label="Estimated price" aria-live="polite" aria-atomic="true">
          <p className={styles.eyebrow}>{roof.family === 'gable' ? 'YOUR GABLE PERGOLA' : roof.family === 'box' ? 'YOUR BOX PERIMETER PERGOLA' : 'YOUR SIMPLE PERGOLA'}</p>
          {roof.family !== 'mono' ? <><p className={styles.priceValue}>{roof.family === 'gable' ? 'Your gable, taking shape.' : 'Your box perimeter, taking shape.'}</p><p className={styles.small}>Explore the design here. {roof.family === 'gable' ? 'Gable' : 'Box perimeter'} pricing will be confirmed by Sanctuary.</p></> : !result ? <p className={styles.priceValue}>Updating estimate…</p> : result.status === 'priced'
            ? <><p className={styles.priceValue}><span>From </span>{new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(result.price.fromIncGst)}</p><p className={styles.small}>Including GST · Subject to site confirmation</p></>
            : result.status === 'custom' ? <><p className={styles.priceValue}>A custom fit.</p><p className={styles.small}>{result.reason}</p></>
            : <><p>Estimate unavailable. Keep exploring your design.</p><button className={styles.textButton} onClick={retry}>Retry estimate ↗</button></>}
        </section>
        <footer className={styles.footnote}><span>CONCEPT PREVIEW</span><p>Frame dimensions follow your selections. Framing and supports are representative. Sanctuary will confirm roof detailing, structural suitability and site connections.</p></footer>
      </aside>
    </div>
  </div>;
}
