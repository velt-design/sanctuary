'use client';
import { useState } from 'react';
import { usePreviewBlinds } from './PreviewBlindProvider';
import { BLIND_COVERS, BLIND_FABRICS, blindColour, blindFabric, type PreviewBlind } from './blindCatalog';
import BlindPositionControl from './BlindPositionControl';
import SidePanelControls from './SidePanelControls';
import { blindUnavailable } from './blindSelection';
import styles from './prototype.module.css';
import css from './blinds.module.css';
export default function BlindControls({ guided = false, detailsOnly = false }: { guided?: boolean; detailsOnly?: boolean }) {
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
  return <section className={css.controls} aria-label="Sides & privacy">
    {!detailsOnly && <><div className={styles.sectionLabel}><h2>Sides & privacy</h2></div>
    <p className={styles.small}>{guided ? 'First, choose where you would like privacy or shelter. Then choose what goes there.' : 'Choose a space between the posts, then choose a blind or screen. Select a space to see it highlighted in the view.'}</p>
    <p className={styles.small}>Side names look out from the house or rear of the pergola. The plan faces the house, like the default 3D view.</p>
    <div className={css.openingGroups}>{(['front','left','right'] as const).map(side=><fieldset key={side} className={css.openingGroup}><legend>{side==='front'?'Front · garden-facing':side==='left'?'Left side':'Right side'}</legend><div className={css.openings}>{openings.filter(o=>o.side===side).map(o=><button key={o.id} aria-pressed={selected===o.id} onClick={()=>{select(o.id);setNotice('');}}><strong>{o.label}</strong><span>{(o.width/1000).toFixed(2)} m wide</span><small>{({acrylic:'Acrylic panels',timber:'Timber slats',aluminium:'Aluminium slats'} as const)[panels.find(p=>p.opening===o.id)?.kind as 'acrylic'|'timber'|'aluminium']??(blinds.some(b=>b.opening===o.id)?'Ziptrak blind':'Open')}</small></button>)}</div></fieldset>)}</div>
    {!opening && <p className={styles.small} role="status">Select a space above. It will be outlined in the view.</p>}</>}
    {opening && <>
      {!detailsOnly && <><div className={css.editingHeading}><h3>Editing {opening.label}</h3><p>{(opening.width/1000).toFixed(2)} m wide · outlined in the view</p></div>
      <fieldset className={`${styles.choices} ${css.sideKinds}`}><legend>Choose a finish for this space</legend>{([['open','Open'],['blind','Ziptrak blind'],['acrylic','Acrylic panels'],['timber','Timber slats'],['aluminium','Aluminium slats']] as const).map(([value,name])=><label key={value} data-selected={kind===value}>
        <input type="radio" name="blind-enabled" checked={kind===value} disabled={value==='blind'&&Boolean(blindUnavailable(opening))} onChange={()=>{setNotice('');workspace.setKind(value);}}/>{name}</label>)}</fieldset>
      {guided && <p className={styles.small}>{kind === 'open' ? 'An open connection to your garden.' : kind === 'blind' ? 'Lower it for shelter, or raise it to open the space.' : kind === 'timber' ? 'Warm timber texture with gaps between the slats.' : kind === 'aluminium' ? 'A clean slatted screen that matches the frame.' : 'A clear panel for shelter while keeping the view.'}</p>}</>}
      {panel&&(guided ? <details className={css.fabrics}><summary>Refine your screen finish</summary><SidePanelControls panel={panel} onChange={workspace.setPanel}/></details> : <SidePanelControls panel={panel} onChange={workspace.setPanel}/>)}
      {!panel&&blindUnavailable(opening) && <p className={styles.inputNotice}>{blindUnavailable(opening)} This opening needs a separate design review.</p>}
      {blind && <details className={css.fabrics} open={guided ? undefined : true}><summary hidden={!guided}>Refine your blind finish & position</summary>
        <fieldset className={styles.choices}><legend>Roll cover</legend>{BLIND_COVERS.map(c=><label key={c.id} data-selected={blind.cover===c.id}><input type="radio" name="blind-cover" checked={blind.cover===c.id} onChange={()=>change({cover:c.id})}/>{c.name}</label>)}</fieldset>
        <label className={css.select}>Fabric range<select aria-label="Blind fabric range" value={blind.fabric} onChange={e=>{const f=BLIND_FABRICS.find(f=>f.id===e.target.value)!;change({fabric:f.id,colour:f.colours.split('|')[0]});}}>{BLIND_FABRICS.map(f=><option key={f.id} value={f.id} disabled={Boolean(blindUnavailable(opening,f.id))}>{f.name} · {f.detail}</option>)}</select></label>
        <details className={css.fabrics}><summary>Colour · {blind.colour}</summary><div className={css.swatches}>{blindFabric(blind).colours.split('|').map(colour=><button key={colour} aria-label={'Blind colour '+colour} aria-pressed={blind.colour===colour} onClick={()=>change({colour})}><span style={{background:blindColour(colour)}}/>{colour}</button>)}</div><p className={styles.small}>Illustrative colours and transparency. Confirm your choice with a fabric sample.</p></details>
        <button className={css.apply} disabled={blinds.length<2} onClick={()=>{let count=0;update(blinds.map(b=>{const o=openings.find(o=>o.id===b.opening)!;if(blindUnavailable(o,blind.fabric))return b;count++;return {...b,fabric:blind.fabric,colour:blind.colour,cover:blind.cover};}));setNotice('Applied fabric, colour and cover to '+count+' blinds that fit.');}}>Apply finish to all blinds</button>
        <BlindPositionControl value={blind.lowered} onChange={lowered=>change({lowered})}/>
        {opening.headerDepth>0 && <><p className={styles.small}>Level {opening.headerDepth} × 50 mm header above this blind.</p><fieldset className={styles.choices}><legend>Above the header</legend>{[true,false].map(infill=><label key={String(infill)} data-selected={blind.infill===infill}><input type="radio" name="blind-triangle" checked={blind.infill===infill} onChange={()=>change({infill})}/>{infill?'Acrylic infill':'Open triangle'}</label>)}</fieldset></>}
        <p className={styles.small}>Under-beam mounting · Frame colour matches your pergola.</p>
      </details>}
    </>}
    {notice && <p className={styles.inputNotice} role="status">{notice}</p>}
  </section>;
}
