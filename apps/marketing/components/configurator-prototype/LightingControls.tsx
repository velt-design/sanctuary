'use client';
import {useLayoutEffect,useRef} from 'react';
import {layoutLights,type LightLayout} from '@sp/geometry';
import {useLighting} from './LightingProvider';
import styles from './prototype.module.css';
import css from './lighting.module.css';
export default function LightingControls(){
 const w=useLighting()!;
 const section=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{const aside=section.current?.closest('aside');if(aside)aside.scrollTop=0;},[]);
 return <section ref={section} className={css.editor} aria-label="Lighting editor">
 <button onClick={w.close}>← Done with lighting</button><h2>Set the mood.</h2>
 <p>Warm-white lighting for your evenings outside.</p>
 <div className={css.row} role="group" aria-label="Lighting preview">{[false,true].map(n=><button key={String(n)} aria-pressed={w.night===n} onClick={()=>w.setNight(n)}>{n?'Night':'Day'}</button>)}</div>
 {(['rafter','cedar'] as const).map(kind=>{
  const pool=kind==='rafter'?w.sites.rafters:w.sites.cedar,countKey=kind==='rafter'?'rafterCount':'cedarCount',layoutKey=kind==='rafter'?'rafterLayout':'cedarLayout',count=w.value[countKey];
  if(!pool.length)return null;
  const seen=new Set<string>();const layouts=(['even','perimeter','central'] as LightLayout[]).filter(l=>{const key=layoutLights(pool,count,l).map(p=>p.id).sort().join();if(seen.has(key))return false;seen.add(key);return true;});
  return <div key={kind}><h3>{kind==='rafter'?'Rafter spots · 40 mm':'Cedar downlights · 110 mm'}</h3><div className={css.row}>
  <button aria-label={'Remove '+kind+' light'} disabled={!count} onClick={()=>w.change({...w.value,[countKey]:count-1})}>−</button>
  <label>Quantity <input aria-label={kind+' light quantity'} type="number" min={0} max={Math.min(24,pool.length)} value={count} onFocus={e=>e.currentTarget.select()} onChange={e=>w.change({...w.value,[countKey]:Math.min(24,pool.length,Math.max(0,Math.round(Number(e.target.value))))})}/></label>
  <button aria-label={'Add '+kind+' light'} disabled={count>=Math.min(24,pool.length)} onClick={()=>w.change({...w.value,[countKey]:count+1})}>+</button></div>
  {count>0&&<fieldset className={styles.choices}><legend>{kind==='rafter'?'Spot':'Downlight'} layout</legend>{layouts.map(l=><label key={l} data-selected={w.value[layoutKey]===l}><input type="radio" name={kind+'-light-layout'} checked={w.value[layoutKey]===l} onChange={()=>w.change({...w.value,[layoutKey]:l})}/>{l==='even'?'Even coverage':l==='perimeter'?'Perimeter':'Central'}</label>)}</fieldset>}</div>;
 })}
 <h3>LED strips · 16 × 16 mm channel</h3><p>Tap a highlighted rafter or beam to switch its full-length strip on or off. Rotate below the roof to see the fittings.</p>
 <div className={css.presets}>{['Outer perimeter','Alternate rafters','All rafters','Clear strips'].map((label,i)=><button key={label} onClick={()=>w.change({...w.value,strips:i===0?w.sites.strips.filter(s=>s.perimeter).map(s=>s.id):i===1?w.sites.strips.filter(s=>s.rafter).filter((_,i)=>i%2===0).map(s=>s.id):i===2?w.sites.strips.filter(s=>s.rafter).map(s=>s.id):[]})}>{label}</button>)}</div>
 <p>{w.value.strips.length} members lit · Perimeter excludes the house connection.</p>
 <details><summary>Choose members from a list</summary><div className={css.members}>{w.sites.strips.map(s=><label key={s.id}><input type="checkbox" checked={w.value.strips.includes(s.id)} onChange={()=>w.toggle(s.id)}/>{s.label}</label>)}</div></details>
 <p className={styles.small}>Only exposed mounting surfaces are selectable. Strip-lit rafters use strips instead of spots. Preview lighting is illustrative; final fitting positions are confirmed with your design.</p>
 </section>;
}
