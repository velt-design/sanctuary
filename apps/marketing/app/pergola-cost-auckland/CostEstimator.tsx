'use client';
import ArrowIcon from '../../components/marketing-foundation/ArrowIcon';

import Image from 'next/image';
import Link from 'next/link';
import ArrowUpRight from '@/components/marketing-foundation/ArrowUpRight';
import DimensionControl from '@/components/marketing-foundation/DimensionControl';
import { PRODUCT_DESIGNS, PRODUCT_FORM_CHOICES } from '@/components/products/productDesigns';
import { PRODUCT_MATERIALS } from '@/components/products/productSelectionValues';
import { LANDING_COST_PATH } from '@/components/configurator-prototype/draftScope';
import { useLandingSelection } from '../pergolas-auckland/useLandingSelection';
import LandingEstimate from '../pergolas-auckland/LandingEstimate';
import styles from './estimator.module.css';

export default function CostEstimator() {
  const state = useLandingSelection(LANDING_COST_PATH);
  const { type, selection, design, update, resume } = state;
  const saved = resume && design?.restored ? design.draft : null;
  const family = saved ? saved.roof.family === 'mono' ? 'pitched' : saved.roof.family : PRODUCT_DESIGNS[type].imageFamily;
  const material = saved ? saved.roof.finish?.material ?? 'acrylic' : selection.material;
  const image = `/images/configurator/${material === 'acrylic' ? `shape-${family}` : `roof-${family}-${material}`}-v1.webp`;
  const title = family === 'pitched' ? 'Pitched' : family === 'box' ? 'Box' : 'Gable';
  const width = saved?.input.widthMm ?? selection.widthMm;
  const projection = saved?.input.projectionMm ?? selection.projectionMm;

  return <section id="explore-options" className={styles.section} aria-label="Pergola cost estimator">
    {state.recovery && <p role="status">{state.recovery}</p>}
    <div className={styles.calculator} data-cost-calculator>
      <div className={styles.result}>
        <p className={styles.priceContext}>{title} · {(width / 1000).toFixed(1)} × {(projection / 1000).toFixed(1)} m · {material === 'acrylic' ? 'Acrylic' : material === 'solid' ? 'Solid + timber' : 'Mixed + timber'}{resume ? ' + saved choices' : ''}</p>
        <LandingEstimate className={styles.estimate} state={state} />
        <div className={styles.actions}>{design && !design.issue ? <><Link className={styles.primary} href={design.enquiryHref} onClick={state.continueDesign} prefetch={false}>Enquire about this design <ArrowUpRight /></Link><Link className={styles.secondary} href={design.designerHref} onClick={state.continueDesign} prefetch={false}>{resume ? 'Continue your design' : 'Customise in 3D'} <ArrowUpRight /></Link></> : <><a className={styles.primary} href="#project-details">Discuss your project <ArrowUpRight /></a><span className={styles.actionHint}>{design?.issue ? 'For this size, start with a conversation.' : state.failed ? 'Retry options to restore your design links.' : 'Your design links will appear when ready.'}</span></>}</div>
        <p className={styles.issue} role="status">{design?.issue ? `${design.issue} This roof supports a projection up to ${design.projectionMax / 1000} m in the designer. Talk to us about a larger roof.` : 'Your choices carry through. No contact details needed to explore.'}</p>
      </div>
      <div className={styles.choices}>
        {resume ? <div className={styles.saved}><div className={styles.savedHeading}><h2>Your saved exploration</h2><button type="button" onClick={state.explore}>Start another idea <ArrowUpRight /></button></div>{saved ? <><p className={styles.savedSize}>{title} / {(width / 1000).toFixed(1)} × {(projection / 1000).toFixed(1)} m</p><dl>{design!.summary.filter(row => !['Size', 'Roofline'].includes(row.label)).map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><p>These complete choices are included in your estimate. Continue in the designer to change them.</p></> : <p>Restoring your design…</p>}</div> : <>
          <fieldset className={styles.rooflines} disabled={!state.ready}><legend><span>01</span> Choose a roofline</legend><div>{PRODUCT_FORM_CHOICES.map(option => <label key={option.type} data-selected={type === option.type}><input type="radio" name="cost-roofline" checked={type === option.type} onChange={() => update(option.type)} /><span>{option.title}</span><span aria-hidden="true"><ArrowUpRight /></span></label>)}</div></fieldset>
          <fieldset className={styles.dimensions} disabled={!state.ready}><legend><span>02</span> Add a rough size</legend><div><DimensionControl axis="width" label="Width" value={selection.widthMm} min={1500} max={10000} onChange={widthMm => update(type, { widthMm })} /><DimensionControl axis="projection" label="Projection" value={selection.projectionMm} min={1500} max={6000} onChange={projectionMm => update(type, { projectionMm })} /></div></fieldset>
          <fieldset className={styles.materials} disabled={!state.ready}><legend><span>03</span> Find your balance of light and shade</legend><div>{PRODUCT_MATERIALS.map(option => <label key={option.value} data-selected={selection.material === option.value}><input type="radio" name="cost-material" checked={selection.material === option.value} onChange={() => update(type, { material: option.value })} /><span>{option.label}</span></label>)}</div><p className={styles.materialDetail}>{PRODUCT_MATERIALS.map(option => <span key={option.value} aria-hidden={selection.material !== option.value} data-active={selection.material === option.value}>{option.detail}</span>)}</p></fieldset>
          <p className={styles.assumptions}>Open sides · Ground level · {PRODUCT_DESIGNS[type].attachment}{type === 'gable' ? ' · Parallel ridge, open ends' : ''}</p>
        </>}
        <p className={styles.inclusions}>Selected structure and roof, priced designer options, standard installation allowances and GST. <a href="#what-is-included">Understand the scope <ArrowIcon direction="down" /></a></p>
        {!state.storageAvailable && <p className={styles.notice} role="status">Your browser cannot save choices for a return visit. The design buttons still carry your current selections.</p>}
      </div>
      <figure className={styles.illustration}>
        <Image src={image} alt={`${title} roofline with ${material === 'acrylic' ? 'acrylic roofing' : material === 'solid' ? 'solid roofing' : 'solid roofing and a central skylight'}. Style illustration.`} width={1200} height={900} sizes="(max-width: 760px) 100vw, 42vw" />
        <figcaption><strong>{title} <span>{(width / 1000).toFixed(1)} × {(projection / 1000).toFixed(1)} m</span></strong><span>Roofline illustration. Dimensions, connection and added options are not shown.</span></figcaption>
      </figure>
    </div>
    <div className={styles.help}><p>Still working out the brief? <a href="#project-details">Send photos and rough dimensions <ArrowUpRight /></a></p>{state.otherDraft && <Link href="/configurator-preview?open=1&design_scope=default" prefetch={false}>Return to your other saved design</Link>}</div>
    <noscript><style>{'[data-cost-calculator] { display: none; }'}</style><p>Use <a href="#project-details">the project enquiry form</a> for help with your budget. On-page estimates need JavaScript; you can send your brief without it.</p></noscript>
  </section>;
}
