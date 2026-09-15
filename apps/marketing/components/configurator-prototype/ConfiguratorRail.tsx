import {useLayoutEffect,useRef} from 'react';
import type {SimpleCoverInput} from '../../lib/simpleCoverCalculator';
import type {PreviewRoofChoices} from './GableChoices';
import {useRail,type RailSection} from './RailProvider';
import {usePreviewBlinds} from './PreviewBlindProvider';
import css from './rail.module.css';
export default function ConfiguratorRail(){
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
 const stages=[['structure','Your pergola'],['personalise','Personalise'],['review','Review']] as const;
 const active=rail.section==='structure'?'structure':rail.section==='review'?'review':'personalise';
 return <nav ref={nav} className={css.nav} aria-label="Design stages"><div className={css.tabs}>{stages.map(([section,title],i)=><button key={section} aria-current={active===section?'step':undefined} onClick={()=>rail.choose(section)}><small>{i+1}</small>{title}</button>)}</div></nav>;
}
