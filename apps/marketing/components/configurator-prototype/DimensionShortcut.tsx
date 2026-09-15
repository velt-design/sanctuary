import {useEffect,useRef} from 'react';
import {useRail} from './RailProvider';
import {metres} from './model';
import styles from './prototype.module.css';
export default function DimensionShortcut({axis,value}:{axis:'width'|'projection';value:number}){
 const {section,choose}=useRail(),pending=useRef(false);
 function focusSlider(){const slider=document.getElementById(axis==='width'?'range-Width':'range-Projection');slider?.scrollIntoView({block:'center'});slider?.focus({preventScroll:true});}
 useEffect(()=>{if(section==='structure'&&pending.current){pending.current=false;focusSlider();}},[section,axis]);
 return <button className={styles.dimensionShortcut} aria-label={`Edit ${axis}, ${metres(value)}`} onClick={()=>{if(section==='structure')focusSlider();else{pending.current=true;choose('structure');}}}><strong>{metres(value)}</strong><span>{axis}</span></button>;
}
