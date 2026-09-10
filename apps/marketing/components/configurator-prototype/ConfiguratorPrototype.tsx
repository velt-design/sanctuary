'use client';

import { hasSimpleRoofPrice } from './roofFinish';
import dynamic from 'next/dynamic';
import { type ReactNode } from 'react';
import type { SimpleCoverInput, SimpleCoverPublicResult } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import { simpleCoverAreaM2 } from '../../lib/simpleCoverCalculator';
import { metres } from './model';
import PreviewControls from './PreviewControls';
import { usePreviewPrice } from './usePreviewPrice';
import { usePreviewDimension } from './usePreviewDimension';
import styles from './prototype.module.css';
import { usePreviewDraft } from './usePreviewDraft';
import PreviewNextAction from './PreviewNextAction';
import ShareDesign from './ShareDesign';
import PreviewBlindProvider from './PreviewBlindProvider';
import journey from './journey.module.css';

const PreviewViews = dynamic(() => import('./PreviewViews'), {
  ssr: false, loading: () => <div className={styles.loading} role="status">Preparing your pergola…</div>,
});

export type PreviewSelection = { input: SimpleCoverInput; roof: PreviewRoofChoices; result: SimpleCoverPublicResult | null };

export default function ConfiguratorPrototype({ expanded, onToggleExpanded, renderEnquiry }: {
  expanded: boolean; onToggleExpanded: () => void; renderEnquiry?: (selection: PreviewSelection) => ReactNode;
}) {
  const { input, roof, setInput, setRoof, ready, storageAvailable, linkNotice, selectionNotice } = usePreviewDraft();
  const { result, retry } = usePreviewPrice(input, ready && hasSimpleRoofPrice(roof));
  const { activeDimension, showDimension } = usePreviewDimension();
  if (!ready) return <div className={styles.loading} role="status">Preparing your design…</div>;
  return <PreviewBlindProvider input={input} roof={roof} onChange={setRoof}><div className={styles.page} data-layout={renderEnquiry ? 'project' : 'popup'}>
    <div className={styles.workspace}>
      <div className={styles.visualSlot}>
      <section className={styles.visual} aria-label="Pergola views" data-expanded={expanded}>
        <PreviewViews input={input} roof={roof} activeDimension={activeDimension} expanded={expanded} onToggleExpanded={onToggleExpanded} />
        <div className={styles.specStrip}><span><strong>{metres(input.widthMm)}</strong> width</span><span><strong>{metres(input.projectionMm)}</strong> projection</span><span><strong>{simpleCoverAreaM2(input).toFixed(1)} m²</strong> covered space</span></div>
      </section>
      </div>
      <div className={styles.choicesColumn}>
      <aside className={styles.sidebar} aria-label="Your pergola choices">
        {renderEnquiry && <div id="project-design" />}
        {linkNotice && <p className={styles.storageNotice} role="status">{linkNotice === 'loaded' ? 'Shared design opened. Make it your own.' : 'This design link could not be opened. You can continue designing below.'}</p>}
        <PreviewControls input={input} roof={roof} onRoofChange={setRoof} onChange={setInput} onDimensionActivity={showDimension} />
        {selectionNotice && <p className={styles.inputNotice} role="status">{selectionNotice}</p>}
        <section className={styles.price} aria-label="Estimated price" aria-live="polite" aria-atomic="true">
          <p className={styles.eyebrow}>{roof.family === 'gable' ? 'YOUR GABLE PERGOLA' : roof.family === 'box' ? 'YOUR BOX PERIMETER PERGOLA' : 'YOUR SIMPLE PERGOLA'}</p>
          {!hasSimpleRoofPrice(roof) ? <><p className={styles.priceValue}>Your pergola, taking shape.</p><p className={styles.small}>Explore the design here. Your selected roof pricing will be confirmed by Sanctuary.</p></> : !result ? <p className={styles.priceValue}>Updating estimate…</p> : result.status === 'priced'
            ? <><p className={styles.priceValue}><span>From </span>{new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(result.price.fromIncGst)}</p><p className={styles.small}>Including GST · Subject to site confirmation</p></>
            : result.status === 'custom' ? <><p className={styles.priceValue}>A custom fit.</p><p className={styles.small}>{result.reason}</p></>
            : <><p>Estimate unavailable. Keep exploring your design.</p><button className={styles.textButton} onClick={retry}>Retry estimate ↗</button></>}
        </section>
        {!storageAvailable && <p className={styles.storageNotice} role="status">Your design is available as you move between these previews, but cannot be saved for a page refresh in this browser.</p>}
        {renderEnquiry && <div className={journey.projectShare}><ShareDesign draft={{ version: 1, input, roof }} /></div>}
        {renderEnquiry?.({ input, roof, result })}
        <footer className={styles.footnote}><span>CONCEPT PREVIEW</span><p>Frame dimensions follow your selections. Framing and supports are representative. Sanctuary will confirm roof detailing, structural suitability and site connections.</p></footer>
      </aside>
      {!renderEnquiry && <PreviewNextAction selection={{ input, roof, result }} />}
      </div>
    </div>
  </div></PreviewBlindProvider>;
}
