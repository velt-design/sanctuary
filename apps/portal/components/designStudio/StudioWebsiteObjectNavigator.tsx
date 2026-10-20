'use client';
import css from './StudioWebsite.module.css';
export default function StudioWebsiteObjectNavigator({objects,selected,onSelect,onAdd,onHouse,disabled}:{objects:{id:string;label:string}[];selected:string|null;onSelect:(id:string)=>void;onAdd:()=>void;onHouse:()=>void;disabled:boolean}){
 return <nav className={css.objectNavigator} aria-label="Design objects">{objects.map(o=><button key={o.id} aria-pressed={selected===o.id} onClick={()=>onSelect(o.id)}>{o.label}</button>)}<button disabled={disabled} onClick={onAdd}>+ Pergola</button><button disabled={disabled} onClick={onHouse}>+ House</button></nav>;
}
