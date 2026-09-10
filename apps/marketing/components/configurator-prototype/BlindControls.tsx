'use client';
import { useState } from 'react';
import { usePreviewBlinds } from './PreviewBlindProvider';
import { BLIND_COVERS, BLIND_FABRICS, blindColour, blindFabric, type PreviewBlind } from './blindCatalog';
import BlindPositionControl from './BlindPositionControl';
import SidePanelControls from './SidePanelControls';
import { blindUnavailable } from './blindSelection';
import styles from './prototype.module.css';
import css from './blinds.module.css';
export default function BlindControls() {
  const workspace=usePreviewBlinds();
  const [notice,setNotice]=useState('');
  if(!workspace) return null;
  const {openings,blinds,panels,selected,select,update}=workspace;
  const panel=panels.find(p=>p.opening===selected),kind=panel?.kind??(blinds.some(b=>b.opening===selected)?'blind':'open');
  const opening=openings.find(o=>o.id===selected), blind=blinds.find(b=>b.opening===selected);
  function change(patch:Partial<PreviewBlind>) {
    if(!blind || !opening) return;
    const next={...blind,...patch},error=blindUnavailable(opening,next.fabric);
    if(error){setNotice(error);return;}
    setNotice('');update(blinds.map(b=>b.opening===selected?next:b));
  }
  return <section className={css.controls} aria-label="Outdoor blinds">
    <div className={styles.sectionLabel}><h2>Sides & blinds</h2></div>
    <p className={styles.small}>Choose an opening below or tap it in the view. Then choose how to enclose it.</p>
    <div className={css.openings}>{openings.map(o=><button key={o.id} aria-pressed={selected===o.id} onClick={()=>{select(o.id);setNotice('');}}>{o.label}<small>{(o.width/1000).toFixed(2)} m · {panels.find(p=>p.opening===o.id)?.kind??(blinds.some(b=>b.opening===o.id)?'Blind':'Open')}</small></button>)}</div>
    {opening && <>
      <fieldset className={styles.choices}><legend>{opening.label}</legend>{([['open','Open'],['blind','Ziptrak blind'],['acrylic','Acrylic panels'],['timber','Timber slats'],['aluminium','Aluminium slats']] as const).map(([value,name])=><label key={value} data-selected={kind===value}>
        <input type="radio" name="blind-enabled" checked={kind===value} disabled={value==='blind'&&Boolean(blindUnavailable(opening))} onChange={()=>{setNotice('');workspace.setKind(value);}}/>{name}</label>)}</fieldset>
      {panel&&<SidePanelControls panel={panel} onChange={workspace.setPanel}/>}
      {!panel&&blindUnavailable(opening) && <p className={styles.inputNotice}>{blindUnavailable(opening)} This opening needs a separate design review.</p>}
      {blind && <>
        <fieldset className={styles.choices}><legend>Roll cover</legend>{BLIND_COVERS.map(c=><label key={c.id} data-selected={blind.cover===c.id}><input type="radio" name="blind-cover" checked={blind.cover===c.id} onChange={()=>change({cover:c.id})}/>{c.name}</label>)}</fieldset>
        <label className={css.select}>Fabric range<select aria-label="Blind fabric range" value={blind.fabric} onChange={e=>{const f=BLIND_FABRICS.find(f=>f.id===e.target.value)!;change({fabric:f.id,colour:f.colours.split('|')[0]});}}>{BLIND_FABRICS.map(f=><option key={f.id} value={f.id} disabled={Boolean(blindUnavailable(opening,f.id))}>{f.name} · {f.detail}</option>)}</select></label>
        <details className={css.fabrics}><summary>Colour · {blind.colour}</summary><div className={css.swatches}>{blindFabric(blind).colours.split('|').map(colour=><button key={colour} aria-label={'Blind colour '+colour} aria-pressed={blind.colour===colour} onClick={()=>change({colour})}><span style={{background:blindColour(colour)}}/>{colour}</button>)}</div><p className={styles.small}>Illustrative colours and transparency. Confirm your choice with a fabric sample.</p></details>
        <button className={css.apply} disabled={blinds.length<2} onClick={()=>{let count=0;update(blinds.map(b=>{const o=openings.find(o=>o.id===b.opening)!;if(blindUnavailable(o,blind.fabric))return b;count++;return {...b,fabric:blind.fabric,colour:blind.colour,cover:blind.cover};}));setNotice('Applied fabric, colour and cover to '+count+' blinds that fit.');}}>Apply finish to all blinds</button>
        <BlindPositionControl value={blind.lowered} onChange={lowered=>change({lowered})}/>
        {opening.headerDepth>0 && <><p className={styles.small}>Level {opening.headerDepth} × 50 mm header above this blind.</p><fieldset className={styles.choices}><legend>Above the header</legend>{[true,false].map(infill=><label key={String(infill)} data-selected={blind.infill===infill}><input type="radio" name="blind-triangle" checked={blind.infill===infill} onChange={()=>change({infill})}/>{infill?'Acrylic infill':'Open triangle'}</label>)}</fieldset></>}
        <p className={styles.small}>Under-beam mounting · Frame colour matches your pergola.</p>
      </>}
    </>}
    {notice && <p className={styles.inputNotice} role="status">{notice}</p>}
  </section>;
}
