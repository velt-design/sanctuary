'use client';
import { usePreviewBlinds } from './PreviewBlindProvider';
import type { PreviewRoofChoices } from './GableChoices';
import type { useMobileSides } from './useMobileSides';
import { sideTreatmentAt, sideTreatments } from './sideTreatment';
import BlindControls from './BlindControls';
import css from './mobileSides.module.css';

export default function MobileSideChoices({flow,roof}:{flow:ReturnType<typeof useMobileSides>;roof:PreviewRoofChoices}) {
  const workspace=usePreviewBlinds()!;
  const {openings,selected,select}=workspace;
  const applied=openings.filter(o=>sideTreatmentAt(roof,o.id)!=='open');
  return <section className={`${css.sides} ${css.compactEditor}`} aria-label="Choose your sides">
    <p className={css.previewNote}>Left and right are viewed from your home{roof.attachmentIntent==='freestanding'?' or the back of your pergola':''}.</p>
    <fieldset className={css.faceChoices}><legend>Sides to change</legend>
      {(['left','front','right'] as const).map(side=>{
        const ids=openings.filter(o=>o.side===side).map(o=>o.id);
        const all=ids.length>0&&ids.every(id=>flow.selected.includes(id));
        const some=ids.some(id=>flow.selected.includes(id));
        return <button key={side} type="button" disabled={!ids.length} aria-pressed={all ? true : some ? 'mixed' : false} onClick={()=>flow.toggleGroup(ids)}>{side[0].toUpperCase()+side.slice(1)}</button>;
      })}
    </fieldset>
    <fieldset className={css.treatmentTabs} disabled={!flow.selected.length}><legend>Choose your treatment</legend>{sideTreatments.map(t=><label key={t.id} data-selected={flow.kind===t.id}>
      <input type="radio" name="mobile-side-treatment" aria-label={t.name} checked={flow.kind===t.id} onChange={()=>flow.apply(t.id)}/>{t.name}
    </label>)}</fieldset>
    <p className={css.selection} role="status">{flow.selected.length ? `${flow.selected.length} ${flow.selected.length===1?'opening':'openings'} selected${flow.kind ? '' : ' · mixed treatments'}` : 'Choose a side above.'}</p>
    {flow.issues.length>0&&<div className={css.fitNotice} role="alert">{flow.issues.map(issue=><p key={issue}>{issue}</p>)}</div>}
    <details className={css.refinements} onToggle={event=>{if(!event.currentTarget.open)workspace.setEditing(false);}}><summary>Individual openings & finishes</summary>
      <p className={css.previewNote}>Left and right are viewed from your home{roof.attachmentIntent==='freestanding'?' or the back of your pergola':''}.</p>
      <fieldset className={css.openingChecks}><legend>Choose your openings</legend>{openings.map(o=><label key={o.id} data-selected={flow.selected.includes(o.id)}>
        <input type="checkbox" checked={flow.selected.includes(o.id)} onChange={()=>flow.toggle(o.id)}/>
        <span><strong>{o.label}</strong><small>{sideTreatments.find(t=>t.id===sideTreatmentAt(roof,o.id))?.name}</small></span>
      </label>)}</fieldset>
      {applied.length>0&&<><label className={css.refineSelect}>Finish<select aria-label="Opening to refine" value={applied.some(o=>o.id===selected)?selected:''} onChange={e=>{flow.start(e.target.value?[e.target.value]:[]);if(e.target.value)select(e.target.value);}}><option value="">Choose an opening</option>{applied.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>{applied.some(o=>o.id===selected)&&<BlindControls guided detailsOnly/>}</>}
    </details>
  </section>;
}
