'use client';
import {perimeterLedPreset} from './perimeterLedPreset';
import CedarLightControls from './CedarLightControls';
import {layoutRafterLights} from '@sp/geometry';
import {useLighting} from './LightingProvider';
import styles from './prototype.module.css';
import css from './lighting.module.css';
import ui from './sectionControls.module.css';
export default function LightingControls({onPreview,guided=false}:{onPreview?:()=>void;guided?:boolean}){
 const w=useLighting()!;
 const counts={off:0,low:layoutRafterLights(w.sites.rafters,'low').length,medium:layoutRafterLights(w.sites.rafters,'medium').length,high:layoutRafterLights(w.sites.rafters,'high').length};
 const unavailable=!counts.low&&!counts.medium&&!counts.high;
 return <section className={css.editor} aria-label="Lighting editor">
 <h2>Lighting</h2>
 <p>Warm-white lighting for your evenings outside.</p>
 <>
 <h3>Choose a lighting type</h3>
 <div className={`${css.tools} ${css.lightTypes}`} role="group" aria-label="Lighting type">
 <button aria-pressed={w.tool==='rafter'} onClick={()=>w.setTool('rafter')}>Rafter lights<span>{unavailable?'No clear mounting positions':'Automatic placement · '+w.value.rafterCount+' lights'}</span></button>
 {w.sites.cedar.length>0&&<button aria-pressed={w.tool==='cedar'} onClick={()=>w.setTool('cedar')}>Ceiling downlights<span>{w.value.cedarCount} lights</span></button>}
 <button aria-pressed={w.tool==='strip'} onClick={()=>w.setTool('strip')}>LED strips<span>Choose beams and rafters · {w.value.strips.length} selected</span></button>
 </div>
 {!w.tool&&<p>Choose a lighting type above. You can combine rafter lights and LED strips.</p>}
 {w.tool==='rafter'&&<div className={ui.group}><h3>Choose your light level</h3>
 {unavailable&&<p role="status">{w.rafterUnavailableReason}</p>}
 <div className={css.tools} role="group" aria-label="Rafter light amount">{(['off','low','medium','high'] as const).map(amount=><button key={amount} disabled={amount!=='off'&&!counts[amount]} aria-pressed={(w.value.rafterAmount??'off')===amount} onClick={()=>w.change({...w.value,rafterAmount:amount})}>{amount[0].toUpperCase()+amount.slice(1)}<span>{amount==='off'?'No rafter lights':!counts[amount]?'Unavailable · no clear positions':`${counts[amount]} ${counts[amount]===1?'light':'lights'} · `+(amount==='high'?'Every suitable rafter':'Alternate suitable rafters')}</span></button>)}</div>
 <p>{w.value.rafterCount} lights across {new Set(layoutRafterLights(w.sites.rafters,w.value.rafterAmount??'off').map(s=>s.id.slice(0,s.id.lastIndexOf('-')))).size} rafters.</p>
 <details className={ui.details}><summary>How the lights are arranged</summary><p>One light starts in the middle; two start a quarter of the way in from each end. With timber battens, lights move to the nearest clear gap. Gable layouts stay mirrored; strip-lit rafters are skipped.</p></details></div>}
 {w.tool==='cedar'&&<CedarLightControls/>}
 {w.tool==='strip'&&<div className={ui.group}><h3>Choose your LED layout</h3><p>Start with a layout below. You can refine individual strips under More LED options.</p>
 <div className={css.presets}>{['Outer perimeter','Alternate rafters','All rafters','Clear strips'].map((label,i)=><button key={label} onClick={()=>w.change({...w.value,strips:i===0?perimeterLedPreset(w.sites.strips):i===1?w.sites.strips.filter(s=>s.rafter).filter((_,i)=>i%2===0).map(s=>s.id):i===2?w.sites.strips.filter(s=>s.rafter).map(s=>s.id):[]})}>{label}</button>)}</div>
 <p>{w.value.strips.length} members lit · One strip per outer edge. Attached designs exclude the house edge.</p>
 <details><summary>More LED options · individual strips</summary><div className={css.members}>{w.sites.strips.map(s=><label key={s.id}><input type="checkbox" checked={w.value.strips.includes(s.id)} onChange={()=>w.toggle(s.id)}/>{s.label}</label>)}</div></details></div>}
 </>
 {!guided && <button className={css.preview} onClick={()=>{w.setView('3D');w.setNight(!w.night);onPreview?.();}}>{w.night?'See your lights in daytime':'See your lights at night'}</button>}
 <p className={styles.small}>Illustrative lighting. Final fitting positions are confirmed with your design.</p>
 </section>;
}
