'use client';
import {useLayoutEffect,useRef} from 'react';
import {layoutRafterLights,layoutCedarLights} from '@sp/geometry';
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
 {w.view==='3D'?<p>Rotate to see how the lighting affects your space. Return to Lighting plan to make changes.</p>:<>
 <h3>1. Choose what to edit</h3>
 <div className={css.tools} role="group" aria-label="Lighting type">
 <button aria-pressed={w.tool==='rafter'} onClick={()=>w.setTool('rafter')}>Rafter lights<span>Automatic placement · {w.value.rafterCount} lights</span></button>
 {w.sites.cedar.length>0&&<button aria-pressed={w.tool==='cedar'} onClick={()=>w.setTool('cedar')}>Cedar downlights<span>{w.value.cedarCount} lights</span></button>}
 <button aria-pressed={w.tool==='strip'} onClick={()=>w.setTool('strip')}>LED strips<span>Choose beams and rafters · {w.value.strips.length} selected</span></button>
 </div>
 {!w.tool&&<p>Choose a lighting type above. You can combine rafter lights and LED strips.</p>}
 {w.tool==='rafter'&&<div><h3>2. Choose the amount of light</h3>
 <div className={css.tools} role="group" aria-label="Rafter light amount">{(['off','low','medium','high'] as const).map(amount=><button key={amount} aria-pressed={(w.value.rafterAmount??'off')===amount} onClick={()=>w.change({...w.value,rafterAmount:amount})}>{amount[0].toUpperCase()+amount.slice(1)}<span>{amount==='off'?'No rafter lights':amount==='low'?'1 centred light · alternate rafters':amount==='medium'?'2 lights · alternate rafters':'2 lights · every eligible rafter'}</span></button>)}</div>
 <p>{w.value.rafterCount} lights across {new Set(layoutRafterLights(w.sites.rafters,w.value.rafterAmount??'off').map(s=>s.id.slice(0,s.id.lastIndexOf('-')))).size} rafters.</p>
 <p>One light sits in the middle. Two sit a quarter of the way in from each end. Placement is automatic; obstructed or strip-lit rafters are skipped.</p></div>}
 {w.tool==='cedar'&&<div><h3>2. Choose a downlight grid</h3>
 <div className={css.tools} role="group" aria-label="Cedar downlight grid">
 <button aria-pressed={w.value.cedarCount===0} onClick={()=>w.change({...w.value,cedarCount:0})}>Off</button>
 {[2,4,6,9].flatMap(count=>(['rows2','rows3'] as const).filter(pattern=>layoutCedarLights(w.sites.cedar,count,pattern).length===count).map(pattern=><button key={count+pattern} aria-pressed={w.value.cedarCount===count&&w.value.cedarPattern===pattern} onClick={()=>w.change({...w.value,cedarCount:count,cedarPattern:pattern})}>{count} lights<span>{count===2?'Centred pair':count===4?'2 × 2 grid':count===9?'3 × 3 grid':pattern==='rows2'?'Rows of 2':'Rows of 3'}</span></button>))}
 </div><p>Centred between rafters, in matching rows. Only grids that fit the cedar areas are shown; acrylic stays clear. Gable grids mirror across the ridge.</p></div>}
 {w.tool==='strip'&&<><h3>2. Select LED strips in the plan</h3><p>Tap a rafter or beam in the plan to switch its full-length strip on or off. Gold lines show your selected strips.</p>
 <div className={css.presets}>{['Outer perimeter','Alternate rafters','All rafters','Clear strips'].map((label,i)=><button key={label} onClick={()=>w.change({...w.value,strips:i===0?w.sites.strips.filter(s=>s.perimeter).map(s=>s.id):i===1?w.sites.strips.filter(s=>s.rafter).filter((_,i)=>i%2===0).map(s=>s.id):i===2?w.sites.strips.filter(s=>s.rafter).map(s=>s.id):[]})}>{label}</button>)}</div>
 <p>{w.value.strips.length} members lit · Perimeter excludes the house connection.</p>
 <details><summary>Choose members from a list</summary><div className={css.members}>{w.sites.strips.map(s=><label key={s.id}><input type="checkbox" checked={w.value.strips.includes(s.id)} onChange={()=>w.toggle(s.id)}/>{s.label}</label>)}</div></details></>}
 </>}
 <button className={css.preview} onClick={()=>w.setView(w.view==='Plan'?'3D':'Plan')}>{w.view==='Plan'?'See your lights at night':'Edit lighting in plan'}</button>
 <p className={styles.small}>Only exposed mounting surfaces are selectable. Strip-lit rafters use strips instead of spots. Preview lighting is illustrative; final fitting positions are confirmed with your design.</p>
 </section>;
}
