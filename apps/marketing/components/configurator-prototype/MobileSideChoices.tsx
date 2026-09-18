'use client';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { usePreviewBlinds } from './PreviewBlindProvider';
import type { PreviewRoofChoices } from './GableChoices';
import type { useMobileSides } from './useMobileSides';
import { sideTreatmentAt, sideTreatments } from './sideTreatment';
import MobileOpeningPicker from './MobileOpeningPicker';
import BlindControls from './BlindControls';
import css from './mobileSides.module.css';

export default function MobileSideChoices({ children, flow, roof }: {
  children: ReactNode; flow: ReturnType<typeof useMobileSides>; roof: PreviewRoofChoices;
}) {
  const workspace = usePreviewBlinds()!;
  const { openings, selected, select } = workspace;
  const group = openings.filter(o => flow.selected.includes(o.id));
  const chosen = sideTreatments.find(t => t.id === flow.kind);
  const imageKind = flow.kind ?? 'open';
  const count = group.length;
  return <section className={css.sides} aria-label="Choose your sides" data-side-phase={flow.phase}>
    {flow.phase === 'opening' ? <>
      <p className={css.intro}>Select one or several openings for the same treatment.</p>
      <MobileOpeningPicker freestanding={roof.attachmentIntent === 'freestanding'} selectedIds={flow.selected} onToggle={flow.toggle} />
      <fieldset className={css.openingChecks}><legend>Choose your openings</legend>
        {openings.map(o => <label key={o.id} data-selected={flow.selected.includes(o.id)}>
          <input type="checkbox" checked={flow.selected.includes(o.id)} onChange={() => flow.toggle(o.id)} />
          <span><strong>{o.label}</strong><small>{(o.width / 1000).toFixed(2)} m · {sideTreatments.find(t => t.id === sideTreatmentAt(roof, o.id))?.name}</small></span>
        </label>)}
      </fieldset>
      <p className={css.selection} role="status">{count ? `${count} ${count === 1 ? 'opening' : 'openings'} selected` : 'Choose an opening to continue.'}</p>
      <p className={css.previewNote}>Front faces the garden. Left and right are shown looking out from the house.</p>
    </> : flow.phase === 'finish' ? <>
      <p className={css.intro}>One treatment for {count === 1 ? group[0]?.label : `all ${count} selected openings`}. Apply it when you’re ready.</p>
      <fieldset className={css.treatmentTabs}><legend>Choose your treatment</legend>
        {sideTreatments.map(t => <label key={t.id} data-selected={flow.kind === t.id}>
          <input type="radio" name="mobile-side-treatment" aria-label={t.name} checked={flow.kind === t.id} onChange={() => flow.setKind(t.id)} />{t.name}
        </label>)}
      </fieldset>
      <figure className={css.treatmentImage}><Image src={`/images/configurator/side-${imageKind}-${imageKind === 'timber' ? 'v2' : 'v1'}.webp`} alt={`${sideTreatments.find(t => t.id === imageKind)?.name} treatment on a charcoal pergola frame — material reference`} fill sizes="(max-width: 720px) 100vw, 680px" /></figure>
      <div className={css.treatmentDescription} aria-live="polite"><h2>{chosen?.name ?? 'Different finishes selected'}</h2><p>{chosen?.benefit ?? 'Choose a treatment to apply across this group. Your existing finishes stay unchanged until you apply.'}</p></div>
      <p className={css.previewNote}>Material reference. You’ll see your own pergola after applying. Individual finish settings remain available.</p>
      {flow.issues.length > 0 && <div className={css.fitNotice} role="status"><strong>This treatment won’t fit every selected opening.</strong>{flow.issues.map(issue => <p key={issue}>{issue}</p>)}<p>Choose another treatment, or go back and change your selection.</p></div>}
      <p className={css.previewNote}>{group.map(o => o.label).join(' · ')}</p>
    </> : <>
      <p className={css.intro}>{chosen?.name} applied to {count} {count === 1 ? 'opening' : 'openings'}. This is your actual design.</p>
      {children}
      {openings.some(o => sideTreatmentAt(roof, o.id) !== 'open') && <details className={css.refinements} onToggle={e => { if (e.currentTarget.open && !selected) { const first = group.find(o => sideTreatmentAt(roof, o.id) !== 'open') ?? openings.find(o => sideTreatmentAt(roof, o.id) !== 'open'); if (first) select(first.id); } }}>
        <summary>Refine individual sides</summary>
        <p>Choose one opening to adjust its finish. Other openings stay as they are.</p>
        <label className={css.refineSelect}>Opening<select aria-label="Opening to refine" value={selected || group[0]?.id || ''} onChange={e => select(e.target.value)}>{openings.filter(o => sideTreatmentAt(roof, o.id) !== 'open').map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
        <BlindControls guided detailsOnly />
      </details>}
    </>}
  </section>;
}
