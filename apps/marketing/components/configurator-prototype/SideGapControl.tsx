'use client';
import {useState,type CSSProperties} from 'react';
import slider from '../simple-cover-calculator/SimpleCoverCalculator.module.css';
import styles from './prototype.module.css';
export default function SideGapControl({value,onChange}:{value:number;onChange:(gap:number)=>void}){
  const [draft,setDraft]=useState<string|null>(null),[notice,setNotice]=useState('');
  const min=5,max=200,marks=[5,50,100,150,200];
  function commit(){if(draft===null)return;const text=draft,number=Number(text);if(!text.trim()||!Number.isFinite(number)){setNotice('Enter a gap in millimetres.');}else{onChange(Math.min(max,Math.max(min,Math.round(number))));setNotice(number<min||number>max?'Choose 5–200 mm.':'');}setDraft(null);}
  return <div className={styles.dimension}>
    <div className={slider.dimensionHeading}><label htmlFor="side-gap-range">Clear gap</label><label className={slider.dimensionValue}><input aria-label="Clear gap in millimetres" inputMode="decimal" value={draft??String(value)} onFocus={e=>e.currentTarget.select()} onChange={e=>{setDraft(e.target.value);setNotice('');}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span>mm</span></label></div>
    <div className={slider.rangeControl} style={{'--range-progress':`${(value-min)/(max-min)*100}%`} as CSSProperties}>
      <input className={slider.range} id="side-gap-range" aria-label="Side slat clear gap" aria-valuetext={value+' mm'} type="range" min={min} max={max} step={1} value={value} onChange={e=>{setDraft(null);setNotice('');onChange(Number(e.target.value));}}/>
      <div className={slider.rangeRail} aria-hidden="true">{marks.map((m,i)=><span key={m} className={slider.rangeStop} data-terminal={i===0||i===marks.length-1?'true':undefined} style={{left:`${(m-min)/(max-min)*100}%`}}>{m}</span>)}</div>
    </div>{notice&&<p className={styles.inputNotice}>{notice}</p>}
  </div>;
}
