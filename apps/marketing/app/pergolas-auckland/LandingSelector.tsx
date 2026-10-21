'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Container, Eyebrow, Heading } from '@/components/marketing-foundation/Primitives';
import DimensionControl from '@/components/marketing-foundation/DimensionControl';
import ArrowUpRight from '@/components/marketing-foundation/ArrowUpRight';
import { PRODUCT_DESIGNS, PRODUCT_FORM_CHOICES } from '@/components/products/productDesigns';
import { PRODUCT_MATERIALS } from '@/components/products/productSelectionValues';
import { useLandingSelection } from './useLandingSelection';
import LandingEstimate from './LandingEstimate';
import styles from './landing-selector.module.css';

export default function LandingSelector() {
  const state = useLandingSelection();
  const { type, selection, design, update, resume } = state;
  const selected = PRODUCT_DESIGNS[type];
  return <section id="explore-options" className={styles.section} aria-labelledby="landing-options-title" data-service-major-section="selector">
    <Container width="wide">
      <header className={styles.heading}><div><Eyebrow>Start with your space</Eyebrow><Heading id="landing-options-title">Find your roofline.</Heading></div><p>Three ways to cover your outdoors.<br />Choose a starting point, then make it yours.</p></header>
      {state.recovery && <p role="status">{state.recovery}</p>}
      {resume ? <div className={styles.resume}>
        <div><Eyebrow>Your saved exploration</Eyebrow><h3>Pick up where you left off.</h3><p>Your complete design, including changes in the designer, is saved separately from your other designs.</p></div>
        <button className={styles.textButton} type="button" onClick={state.explore}>Explore a different starting design</button>
      </div> : <>
        <fieldset className={styles.rooflines} disabled={!state.ready}><legend>Roofline</legend>{PRODUCT_FORM_CHOICES.map(option => <label key={option.type} data-selected={type === option.type}>
          <input type="radio" name="landing-roofline" checked={type === option.type} onChange={() => update(option.type)}/>
          <Image src={`/images/homepage-challenger-rooflines/${PRODUCT_DESIGNS[option.type].imageFamily}-daylight.webp`} alt="" width={1120} height={1400} sizes="(max-width:720px) 31vw, 30vw" />
          <span className={styles.rooflineName}>{option.title}<span aria-hidden="true"><ArrowUpRight /></span></span><span className={styles.rooflineDetail}>{option.description}</span>
        </label>)}</fieldset>
        <p className={styles.illustration}>Roofline illustrations. These show the style, not your selected dimensions. Furniture and landscaping are excluded.</p>
      </>}
      <div className={styles.configure}>
        <div className={styles.choices}>
          {resume ? <div className={styles.savedSummary} aria-live="polite">{design?.restored ? <><span>{design.draft.roof.family === 'mono' ? 'Pitched' : design.draft.roof.family === 'box' ? 'Box' : 'Gable'}</span><strong>{design.draft.input.widthMm / 1000} × {design.draft.input.projectionMm / 1000} m</strong><dl>{design.summary.filter(row => !['Size', 'Roofline'].includes(row.label)).map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><p>The estimate follows these saved choices. Continue in the designer to change them.</p></> : <p>Restoring your design…</p>}</div> : <>
            <fieldset disabled={!state.ready} className={styles.dimensions}><legend>01 / Size</legend><DimensionControl axis="width" label="Width" value={selection.widthMm} min={1500} max={10000} onChange={widthMm => update(type, { widthMm })}/><DimensionControl axis="projection" label="Projection" value={selection.projectionMm} min={1500} max={6000} onChange={projectionMm => update(type, { projectionMm })}/></fieldset>
            <fieldset disabled={!state.ready} className={styles.materials}><legend>02 / Roofing</legend><div>{PRODUCT_MATERIALS.map(material => <label key={material.value} data-selected={selection.material === material.value}><input type="radio" name="landing-material" checked={selection.material === material.value} onChange={() => update(type, { material: material.value })}/><span>{material.label}</span></label>)}</div><p>{PRODUCT_MATERIALS.find(material => material.value === selection.material)?.detail}</p></fieldset>
            <p className={styles.assumptions}>Open sides · Ground level · {selected.attachment}{type === 'gable' ? ' · Parallel ridge, open ends' : ''}. Add blinds, screens and lighting in the full designer.</p>
          </>}
        </div>
        <div className={styles.next}>
          <LandingEstimate state={state} />
          <div className={styles.actions}>{design && !design.issue ? <><Link className={styles.primary} onClick={state.continueDesign} href={design.enquiryHref} prefetch={false}>Enquire about this design <ArrowUpRight /></Link><Link className={styles.secondary} onClick={state.continueDesign} href={design.designerHref} prefetch={false}>{resume ? 'Continue your design' : 'Customise in 3D'} <ArrowUpRight /></Link></> : <><button className={styles.primary} disabled>Enquire about this design <ArrowUpRight /></button><a className={styles.secondary} href="#project-details">Discuss your project <ArrowUpRight /></a></>}</div>
          <p className={styles.issue} role="status">{design?.issue ? `${design.issue} This roof supports a projection up to ${design.projectionMax / 1000} m in the designer. For a larger roof, discuss your project below.` : 'Your choices carry through. No contact details needed to explore.'}</p>
          <p className={styles.scope}>Selected structure, roofing and any options added in the designer, plus standard installation allowances. Site-specific foundation work, unusual access or fixings, new electrical supply, travel and any required engineering or consent are assessed separately.</p>
          {!state.storageAvailable && <p role="status">Your browser cannot save choices for a return visit. The design buttons still carry your current selections.</p>}
        </div>
      </div>
      <div className={styles.foot}><a href="#project-details">Not sure of the size? Have a different design in mind? Talk to us <ArrowUpRight /></a>{state.otherDraft && <Link href="/configurator-preview?open=1&design_scope=default" prefetch={false}>Return to your other saved design</Link>}</div>
      <noscript><p>Explore <a href="/products">our pergola styles</a> or <a href="#project-details">send your project enquiry</a>. The enquiry form works without the designer.</p></noscript>
    </Container>
  </section>;
}
