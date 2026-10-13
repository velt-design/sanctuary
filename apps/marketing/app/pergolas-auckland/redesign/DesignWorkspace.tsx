'use client';
import Image from 'next/image';
import Link from 'next/link';
import ArrowUpRight from '@/components/marketing-foundation/ArrowUpRight';
import DimensionControl from '@/components/marketing-foundation/DimensionControl';
import type { LandingSourcePath } from '@/components/configurator-prototype/draftScope';
import { PRODUCT_DESIGNS, PRODUCT_FORM_CHOICES } from '@/components/products/productDesigns';
import { PRODUCT_MATERIALS } from '@/components/products/productSelectionValues';
import { useLandingSelection } from '../useLandingSelection';
import LandingEstimate from '../LandingEstimate';
import styles from './workspace.module.css';

export default function DesignWorkspace({ sourcePath }: { sourcePath: LandingSourcePath }) {
  const state = useLandingSelection(sourcePath);
  const { type, selection, design, update, resume } = state;
  const saved = resume && design?.restored ? design.draft : null;
  const family = saved ? saved.roof.family === 'mono' ? 'pitched' : saved.roof.family : PRODUCT_DESIGNS[type].imageFamily;
  const material = saved ? saved.roof.finish?.material ?? 'acrylic' : selection.material;
  const image = `/images/configurator/${material === 'acrylic' ? `shape-${family}` : `roof-${family}-${material}`}-v1.webp`;
  const title = family === 'pitched' ? 'Pitched' : family === 'box' ? 'Box' : 'Gable';
  const width = saved?.input.widthMm ?? selection.widthMm;
  const projection = saved?.input.projectionMm ?? selection.projectionMm;
  return <section className={styles.section} id="explore-options" aria-labelledby="workspace-title">
    <header className={styles.heading}><p className={styles.eyebrow}>01 / Shape your pergola</p><div><h2 id="workspace-title">A shape. A size.<br />An idea of cost.</h2><p>Choose a roofline, add a rough size and compare materials. Your installed estimate updates as you explore.</p></div></header>
    {state.recovery && <p role="status">{state.recovery}</p>}
    <div className={styles.workspace}>
      <div className={styles.visualSide}>
        {resume ? <div className={styles.savedHeading}><span>Your saved exploration</span><button type="button" onClick={state.explore}>Start another idea <ArrowUpRight /></button></div> : <fieldset className={styles.rooflines} disabled={!state.ready}><legend>Choose your roofline</legend>{PRODUCT_FORM_CHOICES.map((option, index) => <label key={option.type} data-selected={type === option.type}><input type="radio" name="redesign-roofline" checked={type === option.type} onChange={() => update(option.type)} /><span className={styles.choiceNumber} aria-hidden="true">0{index + 1}</span><span>{option.title}</span></label>)}</fieldset>}
        <div className={styles.visual}>
          <Image src={image} alt={`${title} roofline with ${material === 'acrylic' ? 'acrylic roofing' : material === 'solid' ? 'solid roofing' : 'solid roofing and a central skylight'}. Style illustration.`} width={1200} height={900} sizes="(max-width: 820px) 100vw, 60vw" />
          <div className={styles.designLabel}><span>{title}</span><span>{(width / 1000).toFixed(1)} × {(projection / 1000).toFixed(1)} m</span></div>
        </div>
        <p className={styles.illustration}>Roofline illustration. Dimensions, house connection and added options are not shown. See your complete design in the designer.</p>
        <p className={styles.visualNote}>{resume ? 'Your complete saved choices are carried into the estimate and enquiry.' : PRODUCT_DESIGNS[type].introduction}<span>{resume ? 'Pick up where you left off.' : 'Designed around your home.'}</span></p>
      </div>
      <div className={styles.controls}>
        {resume ? <div className={styles.savedSummary}><h3>Your design, kept together.</h3>{saved ? <><dl>{design!.summary.filter(row => !['Size', 'Roofline'].includes(row.label)).map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><p>The estimate includes these saved choices. Continue in the designer to change them.</p></> : <p>Restoring your design…</p>}</div> : <>
          <fieldset className={styles.dimensions} disabled={!state.ready}><legend>A rough size is enough</legend><DimensionControl axis="width" label="Width" value={selection.widthMm} min={1500} max={10000} onChange={widthMm => update(type, { widthMm })}/><DimensionControl axis="projection" label="Projection" value={selection.projectionMm} min={1500} max={6000} onChange={projectionMm => update(type, { projectionMm })}/></fieldset>
          <fieldset className={styles.materials} disabled={!state.ready}><legend>Light, shade, or a little of both?</legend><div>{PRODUCT_MATERIALS.map(option => <label key={option.value} data-selected={selection.material === option.value}><input type="radio" name="redesign-material" checked={selection.material === option.value} onChange={() => update(type, { material: option.value })}/><span>{option.label}</span></label>)}</div><p className={styles.materialDetail}>{PRODUCT_MATERIALS.map(option => <span key={option.value} aria-hidden={selection.material !== option.value} data-active={selection.material === option.value}>{option.detail}</span>)}</p></fieldset>
          <p className={styles.assumptions}>Open sides · Ground level · {PRODUCT_DESIGNS[type].attachment}{type === 'gable' ? ' · Parallel ridge, open ends' : ''}</p>
        </>}
        <div className={styles.estimateArea}>
          {design ? <LandingEstimate className={styles.estimate} key={JSON.stringify(design.draft)} design={design}/> : <div className={styles.estimate} aria-live="polite"><span>Initial installed estimate</span><strong>{state.failed ? 'Options unavailable' : 'Preparing your options…'}</strong><p>You can discuss your project below at any time.</p><div>{state.failed && <button type="button" onClick={state.retry}>Retry options</button>}</div></div>}
          <div className={styles.actions}>{design && !design.issue ? <><Link className={styles.primary} href={design.enquiryHref} onClick={state.continueDesign} prefetch={false}>Enquire about this design <ArrowUpRight /></Link><Link className={styles.secondary} href={design.designerHref} onClick={state.continueDesign} prefetch={false}>{resume ? 'Continue your design' : 'Customise in 3D'} <ArrowUpRight /></Link></> : <><a className={styles.primary} href="#project-details">Discuss your project <ArrowUpRight /></a><span className={styles.actionHint}>{design?.issue ? 'For this size, start with a conversation.' : 'Your design links will appear when ready.'}</span></>}</div>
          <p className={styles.issue} role="status">{design?.issue ? `${design.issue} This roof supports a projection up to ${design.projectionMax / 1000} m in the designer. Talk to us about a larger roof.` : 'Your choices carry through. No contact details needed to explore.'}</p>
        </div>
        {!state.storageAvailable && <p className={styles.notice} role="status">Your browser cannot save choices for a return visit. The design buttons still carry your current selections.</p>}
      </div>
    </div>
    <div className={styles.below}><p>Estimate includes the selected structure, roof, any priced designer options, standard installation allowances and GST. <a href="#what-is-included">See what’s included.</a></p><a className={styles.help} href="#project-details">Not sure of your size? Let’s talk <ArrowUpRight /></a></div>
    {state.otherDraft && <Link className={styles.other} href="/configurator-preview?open=1&design_scope=default" prefetch={false}>Return to your other saved design</Link>}
    <noscript><p>Explore <a href="/products">our pergola styles</a> or <a href="#project-details">send your project enquiry</a>. The enquiry form works without the designer.</p></noscript>
  </section>;
}
