'use client';
import { useEffect } from 'react';
import { usePreviewBlinds, useLighting } from '@sp/configurator/react/controls';
import Sides from './StudioWebsiteSideControls';
import Lighting from './StudioWebsiteLightingControls';
import Shape from './StudioWebsiteShapeControls';
import Roof from './StudioWebsiteRoofControls';
import type { StudioWebsiteDesign } from '@/lib/designStudio/websiteDesign';
import css from './StudioWebsite.module.css';
export default function StudioWebsiteControls({ value, onChange, section, choose, bookmarkKey, onConnection }: { onConnection?:()=>void;bookmarkKey:string;value: StudioWebsiteDesign; onChange:(v:StudioWebsiteDesign)=>void; section:'Shape'|'Roof'|'Sides'|'Lighting';choose:(s:'Shape'|'Roof'|'Sides'|'Lighting')=>void }) {
 const blinds=usePreviewBlinds()!,light=useLighting()!;
 useEffect(()=>{blinds.setEditing(section==='Sides');},[section,blinds.setEditing]);

 return <aside className={css.rail} aria-label="Pergola design choices">
  <nav className={css.tabs}>{(['Shape','Roof','Sides','Lighting'] as const).map(s=><button key={s} aria-pressed={section===s} onClick={()=>{choose(s);if(s==='Lighting')light.open();else light.close();}}>{s}</button>)}</nav>
  <div className={css.inspectorBody}>
  {section==='Shape'&&<><Shape value={value} onChange={onChange} onConnection={onConnection}/><label className={css.field}>Frame finish<select aria-label="Frame finish" value={value.selection.roof.frameFinish??'black'} onChange={e=>onChange({...value,selection:{...value.selection,roof:{...value.selection.roof,frameFinish:e.target.value as 'black'|'white'}}})}><option value="black">Black</option><option value="white">White</option></select></label></>}
  {section==='Roof'&&<Roof value={value} onChange={onChange}/>}
  {section==='Sides'&&<Sides value={value} onChange={onChange} bookmarkKey={bookmarkKey}/>}
  {section==='Lighting'&&<Lighting/>}
 </div>
  <div className={css.inspectorFooter}><button className={css.next} onClick={()=>{if(section==='Shape')choose('Roof');else if(section==='Roof')choose('Sides');else if(section==='Sides'){choose('Lighting');light.open();}else light.setNight(!light.night);}}>{section==='Shape'?'Choose roof →':section==='Roof'?'Customise sides →':section==='Sides'?'Choose lighting →':light.night?'View in daylight':'See lights at night'}</button></div>
 </aside>;
}
