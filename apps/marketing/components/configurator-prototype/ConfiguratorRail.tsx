import {useLayoutEffect,useRef} from 'react';
import type {SimpleCoverInput} from '../../lib/simpleCoverCalculator';
import type {PreviewRoofChoices} from './GableChoices';
import {useRail,type RailSection} from './RailProvider';
import {usePreviewBlinds} from './PreviewBlindProvider';
import css from './rail.module.css';
export default function ConfiguratorRail({input,roof}:{input:SimpleCoverInput;roof:PreviewRoofChoices}){
 const rail=useRail(),blinds=usePreviewBlinds(),nav=useRef<HTMLElement>(null);
 const positions=useRef<Partial<Record<RailSection,number>>>({});
 const setEditing=blinds?.setEditing;
 useLayoutEffect(()=>{setEditing?.(rail.section==='sides');},[rail.section,setEditing]);
 useLayoutEffect(()=>{
  const aside=nav.current?.closest('aside');if(!aside)return;
  aside.scrollTop=positions.current[rail.section]??0;
  const remember=()=>{positions.current[rail.section]=aside.scrollTop;};
  aside.addEventListener('scroll',remember);
  return ()=>aside.removeEventListener('scroll',remember);
 },[rail.section]);
 const titles:Record<RailSection,string>={structure:'Structure',roof:'Roof & ceiling',sides:'Sides',lighting:'Lighting'};
 const summaries:Record<RailSection,string>={structure:`${(input.widthMm/1000).toFixed(1)} × ${(input.projectionMm/1000).toFixed(1)} m · ${roof.family==='mono'?'Pitched':roof.family==='gable'?'Gable':'Box perimeter'}`,roof:`${roof.finish?.material==='solid'?'Solid + cedar':roof.finish?.material==='combination'?'Acrylic + cedar':'Acrylic'}${roof.roofBattens?' · Battens':''}`,sides:`${(roof.blinds?.length??0)+(roof.sidePanels?.length??0)} openings configured`,lighting:`${(roof.lighting?.rafterCount??0)+(roof.lighting?.cedarCount??0)} lights · ${roof.lighting?.strips.length??0} LED strips`};
 return <nav ref={nav} className={css.nav} aria-label="Design sections"><div className={css.heading}>Your design<span>Choose a section</span></div><div className={css.tabs}>{(Object.keys(titles) as RailSection[]).map((section,i)=><button key={section} aria-label={titles[section]} aria-current={rail.section===section?'step':undefined} onClick={()=>rail.choose(section)}><span className={css.title}><small>0{i+1}</small>{titles[section]}</span><span className={css.summary}>{summaries[section]}</span></button>)}</div></nav>;
}
