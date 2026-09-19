'use client';
import Image from 'next/image';
import { usePreviewBlinds } from './PreviewBlindProvider';
import type { PreviewRoofChoices } from './GableChoices';
import type { useMobileSides } from './useMobileSides';
import { sideTreatmentAt, sideTreatments } from './sideTreatment';
import MobileOpeningPicker from './MobileOpeningPicker';
import BlindControls from './BlindControls';
import css from './mobileSides.module.css';

export default function MobileSideChoices({flow,roof}:{flow:ReturnType<typeof useMobileSides>;roof:PreviewRoofChoices}) {
  const workspace=usePreviewBlinds()!;
  const {openings,selected,select}=workspace;
  const chosen=sideTreatments.find(t=>t.id===flow.kind);
  const imageKind=flow.kind??'open';
  const applied=openings.filter(o=>sideTreatmentAt(roof,o.id)!=='open');
  return <section className={`${css.sides} ${css.singlePage}`} aria-label="Choose your sides">
    <p className={css.intro}>Tick the sides to change. Looking out from your home.</p>
    <fieldset className={css.openingChecks}><legend>Choose your openings</legend>{openings.map(o=><label key={o.id} data-selected={flow.selected.includes(o.id)}>
      <input type="checkbox" checked={flow.selected.includes(o.id)} onChange={()=>flow.toggle(o.id)}/>
      <span><strong>{o.label}</strong><small>{sideTreatments.find(t=>t.id===sideTreatmentAt(roof,o.id))?.name}</small></span>
    </label>)}</fieldset>
    <fieldset className={css.treatmentTabs} disabled={!flow.selected.length}><legend>Choose your treatment</legend>{sideTreatments.map(t=><label key={t.id} data-selected={flow.kind===t.id}>
      <input type="radio" name="mobile-side-treatment" aria-label={t.name} checked={flow.kind===t.id} onChange={()=>flow.apply(t.id)}/>{t.name}
    </label>)}</fieldset>
    <figure className={css.treatmentImage}><Image key={imageKind} src={`/images/configurator/side-${imageKind}-${imageKind==='timber'?'v2':'v1'}.webp`} alt={`${sideTreatments.find(t=>t.id===imageKind)?.name} side treatment — material reference`} fill sizes="(max-width:720px) 100vw, 680px" /></figure>
    <p className={css.selection} role="status">{flow.selected.length ? chosen ? `${chosen.name} · ${flow.selected.length} ${flow.selected.length===1?'opening':'openings'}` : 'Mixed treatments. Choose one for these sides.' : 'Choose one or more sides above.'}</p>
    {flow.issues.length>0&&<div className={css.fitNotice} role="alert">{flow.issues.map(issue=><p key={issue}>{issue}</p>)}</div>}
    <details className={css.refinements}><summary>Locate & refine sides</summary>
      <MobileOpeningPicker freestanding={roof.attachmentIntent==='freestanding'} selectedIds={flow.selected} onToggle={flow.toggle}/>
      <p className={css.previewNote}>The image illustrates the treatment. Your full design appears next.</p>
      {applied.length>0&&<><label className={css.refineSelect}>Opening<select aria-label="Opening to refine" value={applied.some(o=>o.id===selected)?selected:''} onChange={e=>select(e.target.value)}><option value="">Choose a side</option>{applied.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>{applied.some(o=>o.id===selected)&&<BlindControls guided detailsOnly/>}</>}
    </details>
  </section>;
}
