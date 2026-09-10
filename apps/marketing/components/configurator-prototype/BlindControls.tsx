'use client';
import { useState } from 'react';
import { usePreviewBlinds } from './PreviewBlindProvider';
import { BLIND_COVERS, BLIND_FABRICS, blindColour, blindFabric, defaultBlind, type PreviewBlind } from './blindCatalog';
import { blindUnavailable } from './blindSelection';
import styles from './prototype.module.css';
import css from './blinds.module.css';
export default function BlindControls() {
  const workspace=usePreviewBlinds();
  const [notice,setNotice]=useState('');
  if(!workspace) return null;
  const {openings,blinds,selected,select,update}=workspace;
  const opening=openings.find(o=>o.id===selected), blind=blinds.find(b=>b.opening===selected);
  function change(patch:Partial<PreviewBlind>) {
    if(!blind || !opening) return;
    const next={...blind,...patch},error=blindUnavailable(opening,next.fabric);
    if(error){setNotice(error);return;}
    setNotice('');update(blinds.map(b=>b.opening===selected?next:b));
  }
  return <section className={css.controls} aria-label="Outdoor blinds">
    <div className={styles.sectionLabel}><span>03</span><h2>Make it your outdoor room.</h2></div>
    <p className={styles.small}>Ziptrak blinds · Choose an opening here, or tap Sides in the viewer.</p>
    <div className={css.openings}>{openings.map(o=><button key={o.id} aria-pressed={selected===o.id} onClick={()=>{select(o.id);setNotice('');}}>{o.label}<small>{(o.width/1000).toFixed(2)} m · {blinds.some(b=>b.opening===o.id)?'Blind':'Open'}</small></button>)}</div>
    {opening && <>
      <fieldset className={styles.choices}><legend>{opening.label}</legend>{['Open','Ziptrak blind'].map((name,i)=><label key={name} data-selected={Boolean(blind)===Boolean(i)}>
        <input type="radio" name="blind-enabled" checked={Boolean(blind)===Boolean(i)} disabled={Boolean(i)&&Boolean(blindUnavailable(opening))} onChange={()=>{setNotice('');update(i?[...blinds,defaultBlind(selected)]:blinds.filter(b=>b.opening!==selected));}}/>{name}</label>)}</fieldset>
      {blindUnavailable(opening) && <p className={styles.inputNotice}>{blindUnavailable(opening)} This opening needs a separate design review.</p>}
      {blind && <>
        <fieldset className={styles.choices}><legend>Roll cover</legend>{BLIND_COVERS.map(c=><label key={c.id} data-selected={blind.cover===c.id}><input type="radio" name="blind-cover" checked={blind.cover===c.id} onChange={()=>change({cover:c.id})}/>{c.name}</label>)}</fieldset>
        <label className={css.select}>Fabric range<select aria-label="Blind fabric range" value={blind.fabric} onChange={e=>{const f=BLIND_FABRICS.find(f=>f.id===e.target.value)!;change({fabric:f.id,colour:f.colours.split('|')[0]});}}>{BLIND_FABRICS.map(f=><option key={f.id} value={f.id} disabled={Boolean(blindUnavailable(opening,f.id))}>{f.name} · {f.detail}</option>)}</select></label>
        <details className={css.fabrics}><summary>Colour · {blind.colour}</summary><div className={css.swatches}>{blindFabric(blind).colours.split('|').map(colour=><button key={colour} aria-label={'Blind colour '+colour} aria-pressed={blind.colour===colour} onClick={()=>change({colour})}><span style={{background:blindColour(colour)}}/>{colour}</button>)}</div><p className={styles.small}>Illustrative colours and transparency. Confirm your choice with a fabric sample.</p></details>
        <button className={css.apply} disabled={blinds.length<2} onClick={()=>{let count=0;update(blinds.map(b=>{const o=openings.find(o=>o.id===b.opening)!;if(blindUnavailable(o,blind.fabric))return b;count++;return {...b,fabric:blind.fabric,colour:blind.colour,cover:blind.cover};}));setNotice('Applied fabric, colour and cover to '+count+' blinds that fit.');}}>Apply finish to all blinds</button>
        <label className={css.select}>Blind position · {blind.lowered===0?'Raised':blind.lowered===100?'Lowered':blind.lowered+'% lowered'}<input aria-label="Blind lowered percentage" type="range" min="0" max="100" step="5" value={blind.lowered} onChange={e=>change({lowered:Number(e.target.value)})}/></label>
        {opening.headerDepth>0 && <><p className={styles.small}>Level {opening.headerDepth} × 50 mm header above this blind.</p><fieldset className={styles.choices}><legend>Above the header</legend>{[true,false].map(infill=><label key={String(infill)} data-selected={blind.infill===infill}><input type="radio" name="blind-triangle" checked={blind.infill===infill} onChange={()=>change({infill})}/>{infill?'Acrylic infill':'Open triangle'}</label>)}</fieldset></>}
        <p className={styles.small}>Under-beam mounting · Frame colour matches your pergola.</p>
      </>}
    </>}
    {notice && <p className={styles.inputNotice} role="status">{notice}</p>}
  </section>;
}
