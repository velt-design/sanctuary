import {useLighting} from './LightingProvider';
import {cedarSections,cedarOptions,sharedCedarOptions} from './cedarSelection';
import css from './lighting.module.css';
export default function CedarLightControls(){
 const w=useLighting()!,sections=cedarSections(w.sites.cedar),slopes=w.sites.cedar[0]?.cedarSlopes??1;
 const settings=(section?:string)=>{
  const value=section?w.value.cedarOverrides?.[section]:{count:w.value.cedarPerSection??0,pattern:w.value.cedarPattern??'rows2'};
  const options=section?cedarOptions(w.sites.cedar,section):sharedCedarOptions(w.sites.cedar);
  const choose=(count:number,pattern:'rows2'|'rows3')=>w.change(section?{...w.value,cedarOverrides:{...w.value.cedarOverrides,[section]:{count,pattern}}}:{...w.value,cedarPerSection:count,cedarPattern:pattern});
  return <div className={css.tools} role="group" aria-label={section?section.replace('section-','Section ')+' lighting':'All cedar sections'}>
   <button aria-pressed={!value?.count} onClick={()=>choose(0,'rows2')}>Off</button>
   {!options.length&&<p>No complete grid fits. {section?'This section stays unlit.':'Adjust sections individually to light the sections with room.'}</p>}
   {options.map(o=><button key={o.count+o.pattern} aria-pressed={value?.count===o.count&&value.pattern===o.pattern} onClick={()=>choose(o.count,o.pattern)}>{o.count} lights<span>{o.count===2?'Centred pair':o.count===4?'2 × 2 grid':o.count===9?'3 × 3 grid':o.pattern==='rows2'?'Rows of 2':'Rows of 3'}</span></button>)}
  </div>;
 };
 return <div><h3>2. Lights per cedar section, per slope</h3>
 <p>Each section gets its own centred grid.{slopes===2?' The opposite gable slope mirrors it.':''}</p>
 {sections.length>1&&<label className={css.individual}><input type="checkbox" checked={!!w.value.cedarIndividual} onChange={e=>w.change({...w.value,cedarIndividual:e.target.checked})}/> Adjust sections individually</label>}
 {w.value.cedarIndividual?sections.map(section=><div key={section}><h3>{section.replace('section-','Section ')}</h3>{settings(section)}</div>):settings()}
 <p><strong>{w.value.cedarCount} cedar downlights total</strong>{slopes===2?' · Includes both slopes':''}</p>
 <p>Centred between rafters within each cedar section. Acrylic stays clear. Only grids that fit {w.value.cedarIndividual?'this section':'every section'} are offered.</p>
 </div>;
}
