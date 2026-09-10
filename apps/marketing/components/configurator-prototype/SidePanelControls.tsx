'use client';
import { ALUMINIUM_PROFILES,TIMBER_PROFILES,faceWidth,type SidePanel } from './sidePanelCatalog';
import css from './blinds.module.css';
import styles from './prototype.module.css';
export default function SidePanelControls({panel,onChange}:{panel:SidePanel;onChange:(p:SidePanel)=>void}){
  const change=(patch:Partial<SidePanel>)=>{const next={...panel,...patch};if(!next.customGap)next.gap=faceWidth(next.profile,next.edge);onChange(next);};
  const slats=panel.kind!=='acrylic'||panel.battens;
  return <div>
    {panel.kind==='acrylic'&&<>
      <fieldset className={styles.choices}><legend>Acrylic framing</legend>{[50,100].map(frame=><label key={frame} data-selected={panel.frame===frame}><input type="radio" name="side-frame" checked={panel.frame===frame} onChange={()=>change({frame:frame as 50|100})}/>{frame} × 50 mm</label>)}</fieldset>
      <label className={css.select}><span><input type="checkbox" checked={panel.battens} onChange={e=>change({battens:e.target.checked})}/> Add horizontal timber battens</span></label>
    </>}
    {slats&&<>
      <label className={css.select}>Slat profile<select aria-label="Side slat profile" value={panel.profile} onChange={e=>change({profile:e.target.value,edge:['50x10','39x39'].includes(e.target.value)?false:panel.edge})}>{(panel.kind==='aluminium'?ALUMINIUM_PROFILES:TIMBER_PROFILES).map(p=><option key={p} value={p}>{p.replace('x',' × ')} mm</option>)}</select></label>
      {!['39x39','50x10'].includes(panel.profile)&&<fieldset className={styles.choices}><legend>Slat orientation</legend>{[false,true].map(edge=><label key={String(edge)} data-selected={panel.edge===edge}><input type="radio" name="side-slat-edge" checked={panel.edge===edge} onChange={()=>change({edge})}/>{edge?'On edge':'Flat'}</label>)}</fieldset>}
      <label className={css.select}>Clear gap · {panel.gap} mm<input aria-label="Side slat clear gap" type="range" min="5" max="200" step="1" value={panel.gap} onChange={e=>change({gap:Number(e.target.value),customGap:true})}/></label>
      <button className={css.apply} disabled={!panel.customGap} onClick={()=>change({customGap:false})}>Use profile default</button>
      <p className={styles.small}>Horizontal slats · {panel.kind==='acrylic'?'Supports follow the acrylic framing.':`Supports evenly spaced, up to ${panel.kind==='timber'?'1,200':'600'} mm apart. Perimeter angle matches your pergola.`}</p>
    </>}
  </div>;
}
