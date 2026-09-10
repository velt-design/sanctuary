import type {CSSProperties} from 'react';
import slider from '../simple-cover-calculator/SimpleCoverCalculator.module.css';
import styles from './prototype.module.css';
export default function BlindPositionControl({value,onChange}:{value:number;onChange:(value:number)=>void}){
 return <div className={styles.dimension}>
  <div className={slider.dimensionHeading}><label htmlFor="blind-position">Blind position</label><span>{value===0?'Raised':value===100?'Lowered':`${value}% lowered`}</span></div>
  <div className={slider.rangeControl} style={{'--range-progress':`${value}%`} as CSSProperties}>
   <input id="blind-position" className={slider.range} aria-label="Blind lowered percentage" type="range" min={0} max={100} step={5} value={value} onChange={e=>onChange(Number(e.target.value))}/>
   <div className={slider.rangeRail} aria-hidden="true">{[0,50,100].map(m=><span key={m} className={slider.rangeStop} data-terminal={m!==50?'true':undefined} style={{left:`${m}%`}}>{m}%</span>)}</div>
  </div>
 </div>;
}
