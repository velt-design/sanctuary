'use client';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import controls from '../marketing-foundation/design-controls.module.css';
import DimensionControl from '../marketing-foundation/DimensionControl';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { PRODUCT_MATERIALS, PRODUCT_SIDES, type ProductSelection } from './productSelection';
import styles from './product-selection.module.css';
import type { PreviewDraft } from '../configurator-prototype/previewDraft';
import PergolaFootprint from '../configurator-prototype/PergolaFootprint';

const tabs = ['Size', 'Roof', 'Sides'] as const;
export default function ProductChoices({ draft, imageFamily = 'pitched', projectionMax = 6000, adjustment = '', selection, update, ready, issue, onSectionChange, onResizingChange }: { onResizingChange?: (resizing: boolean) => void; onSectionChange?: (section: 'Size' | 'Roof' | 'Sides') => void; draft?: PreviewDraft; imageFamily?: 'pitched' | 'gable' | 'box'; projectionMax?: number; adjustment?: string; selection: ProductSelection; update: (patch: Partial<ProductSelection>) => void; ready: boolean; issue: string | null }) {
  const [active, setActive] = useState(0);
  const [resizing, setResizing] = useState(false);
  useEffect(() => { onResizingChange?.(resizing); }, [resizing, onResizingChange]);
  useEffect(() => {
    const finish = () => setResizing(false);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', finish);
    };
  }, []);
  const isRange = (target: EventTarget) => target instanceof HTMLInputElement && target.type === 'range';
  const summaries = [`${selection.widthMm / 1000} × ${selection.projectionMm / 1000} m`, PRODUCT_MATERIALS.find(m => m.value === selection.material)!.label, PRODUCT_SIDES.find(s => s.value === selection.sides)!.label];
  function choose(index: number) { setActive(index); onSectionChange?.(tabs[index]); }
  return <div className={styles.chooser} aria-busy={!ready}
    onPointerDownCapture={event => { if (isRange(event.target)) setResizing(true); }}
    onKeyDownCapture={event => { if (isRange(event.target) && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) setResizing(true); }}
    onKeyUpCapture={event => { if (isRange(event.target)) setResizing(false); }}
    onBlurCapture={event => { if (isRange(event.target)) setResizing(false); }}>
    <div className={styles.tabs} role="tablist" aria-label="Choose your pergola details">{tabs.map((tab, index) => <button key={tab} id={`product-tab-${index}`} role="tab" aria-selected={active === index} aria-controls={`product-panel-${index}`} tabIndex={active === index ? 0 : -1}
      onClick={() => choose(index)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
        if (next !== null) { event.preventDefault(); choose(next); document.getElementById(`product-tab-${next}`)?.focus(); }
      }}><span>{String(index + 1).padStart(2, '0')} / {tab}</span><small>{summaries[index]}</small></button>)}</div>
    <div className={styles.panels}>
      <div role="tabpanel" id="product-panel-0" aria-labelledby="product-tab-0" data-hidden={active !== 0} aria-hidden={active !== 0} inert={active !== 0} tabIndex={0}>
        {imageFamily === 'gable' && <fieldset disabled={!ready} className={`${controls.segmented} ${styles.gableDirection}`}><legend>Gable direction</legend><div>
          {(['parallel', 'away'] as const).map(direction => <label key={direction} data-selected={(selection.orientation ?? 'parallel') === direction}>
            <input type="radio" name="product-gable-direction" checked={(selection.orientation ?? 'parallel') === direction} onChange={() => update({ orientation: direction })}/>
            <span>{direction === 'parallel' ? 'Parallel to house' : 'Extending from house'}</span>
          </label>)}
        </div></fieldset>}
        {draft && <div className={styles.mobilePlan} aria-label="Size plan"><PergolaFootprint input={draft.input} roof={draft.roof} activeDimension={null} resizing={resizing}/></div>}
        <fieldset disabled={!ready} className={styles.group}><legend>Make room for your everyday.</legend>
          <div className={styles.dimensions}>{(['widthMm', 'projectionMm'] as const).map(key => <DimensionControl key={key} axis={key === 'widthMm' ? 'width' : 'projection'} label={key === 'widthMm' ? 'Width' : 'Projection'} value={selection[key]} min={1500} max={key === 'widthMm' ? 10000 : projectionMax} onChange={value => update({ [key]: value })}/>)}</div>
        </fieldset>
        <p className={styles.detail}>Start with rough dimensions. We’ll confirm the fit at your home.</p>
      </div>
      <div role="tabpanel" id="product-panel-1" aria-labelledby="product-tab-1" data-hidden={active !== 1} aria-hidden={active !== 1} inert={active !== 1} tabIndex={0}>
        <fieldset disabled={!ready} className={styles.group}><legend>Find your balance of light and shade.</legend>
          <div className={styles.roofChoices}>{PRODUCT_MATERIALS.map(option => <label className={controls.choice} key={option.value} data-selected={selection.material === option.value}>
            <Image src={`/images/configurator/${option.value === 'acrylic' ? `shape-${imageFamily}` : `roof-${imageFamily}-${option.value}`}-v1.webp`} width={200} height={140} alt="" sizes="160px" />
            <span><input type="radio" name="product-roof" checked={selection.material === option.value} onChange={() => update({ material: option.value })} />{option.label}</span>
          </label>)}</div>
          <p className={styles.materialDetail}>{PRODUCT_MATERIALS.find(m => m.value === selection.material)!.detail}</p>
          <p className={styles.micro}>Material illustrations. Your selected dimensions appear in the model.</p>
        </fieldset>
      </div>
      <div role="tabpanel" id="product-panel-2" aria-labelledby="product-tab-2" data-hidden={active !== 2} aria-hidden={active !== 2} inert={active !== 2} tabIndex={0}>
        <fieldset disabled={!ready} className={styles.group}><legend>Open to the garden. Or a little more shelter.</legend>
          <div className={styles.sideChoices}>{PRODUCT_SIDES.map(option => <label key={option.value} data-selected={selection.sides === option.value}>
            <span><input type="radio" name="product-sides" checked={selection.sides === option.value} onChange={() => update({ sides: option.value })} />{option.label}</span>
          </label>)}</div>
          <p className={styles.detail}>Side names look out from the house. Choose a template to see it on your pergola. For other combinations, choose Customise further.</p>
          <p className={styles.micro}>Ziptrak · Shadeview Urban Carbon · Uncovered. Space above blinds stays open.</p>
        </fieldset>
      </div>
    </div>
    <div className={styles.choiceFooter}><span role="status" data-default={!issue && !adjustment}>{issue ? `${issue} Reduce the size or choose open sides.` : adjustment || 'Your model and estimate update as you choose.'}</span>
      {active < 2 && <button onClick={() => { choose(active + 1); document.getElementById(`product-tab-${active + 1}`)?.focus(); }}>Next: {tabs[active + 1]} <ArrowUpRight style={{transform:'rotate(45deg)'}}/></button>}
    </div>
  </div>;
}
