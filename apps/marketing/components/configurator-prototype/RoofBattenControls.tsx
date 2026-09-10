'use client';
import type {RepresentativeRoofBattens} from '@sp/geometry';
import type {PreviewRoofChoices} from './GableChoices';
import {getRoofFinish} from './roofFinish';
import {DEFAULT_ROOF_BATTENS,parseRoofBattens} from './roofBattenSelection';
import {TIMBER_PROFILES} from './sidePanelCatalog';
import SideGapControl from './SideGapControl';
import styles from './prototype.module.css';
import css from './blinds.module.css';
export default function RoofBattenControls({roof,onChange}:{roof:PreviewRoofChoices;onChange:(roof:PreviewRoofChoices)=>void}){
  if(getRoofFinish(roof).material==='solid')return null;
  const p=roof.roofBattens;
  const change=(patch:Partial<RepresentativeRoofBattens>)=>onChange({...roof,roofBattens:parseRoofBattens({...p,...patch})!});
  return <section aria-label="Roof timber battens">
    <label className={styles.infillChoice}><input type="checkbox" checked={!!p} onChange={e=>onChange({...roof,roofBattens:e.target.checked?{...DEFAULT_ROOF_BATTENS}:undefined})}/>Timber battens under rafters</label>
    {p&&<>
      <label className={css.select}>Batten profile<select aria-label="Roof batten profile" value={p.profile} onChange={e=>change({profile:e.target.value as RepresentativeRoofBattens['profile']})}>{TIMBER_PROFILES.map(profile=><option key={profile} value={profile}>{profile.replace('x',' × ')} mm</option>)}</select></label>
      {p.profile!=='39x39'&&<fieldset className={styles.choices}><legend>Batten orientation</legend>{[false,true].map(edge=><label key={String(edge)} data-selected={p.edge===edge}><input type="radio" name="roof-batten-edge" checked={p.edge===edge} onChange={()=>change({edge})}/>{edge?'On edge':'Flat'}</label>)}</fieldset>}
      <SideGapControl roof value={p.gap} onChange={gap=>change({gap,customGap:true})}/>
      <button className={css.apply} disabled={!p.customGap} onClick={()=>change({customGap:false})}>Use batten profile default</button>
      <p className={styles.small}>Timber runs across the rafters beneath the acrylic sections, following the roof slope.</p>
    </>}
  </section>;
}
