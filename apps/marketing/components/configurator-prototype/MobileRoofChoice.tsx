'use client';
import MobileRoofImage from './MobileRoofImage';
import type { PreviewRoofChoices } from './GableChoices';
import { getRoofFinish } from './roofFinish';
import css from './mobileJourney.module.css';

const shapes = [{id:'mono',name:'Pitched',file:'pitched'}, {id:'gable',name:'Gable',file:'gable'}, {id:'box',name:'Box',file:'box'}] as const;
const materials = [
  {id:'acrylic',name:'Acrylic',benefit:'Daylight and an open feeling overhead.'},
  {id:'combination',name:'Combination',benefit:'Timber-lined shade with an acrylic skylight band.'},
  {id:'solid',name:'Solid',benefit:'Full shade, with a timber ceiling underneath.'},
] as const;

export default function MobileRoofChoice({ roof, onChange }: {roof: PreviewRoofChoices; onChange:(roof:PreviewRoofChoices)=>void}) {
  const finish=getRoofFinish(roof);
  const shape=shapes.find(s=>s.id===roof.family)!;
  const material=materials.find(m=>m.id===finish.material)!;
  const image=material.id==='acrylic' ? `/images/configurator/shape-${shape.file}-v1.webp` : `/images/configurator/roof-${shape.file}-${material.id}-v1.webp`;
  return <section className={css.roofChoice} aria-label="Choose your roof">
    <fieldset className={css.choiceTabs}><legend>Roof shape</legend>{shapes.map(s=><label key={s.id} data-selected={s.id===shape.id}>
      <input type="radio" name="mobile-shape" checked={s.id===shape.id} onChange={()=>onChange({...roof,family:s.id})}/>{s.name}
    </label>)}</fieldset>
    <fieldset className={css.choiceTabs}><legend>Roof material</legend>{materials.map(m=><label key={m.id} data-selected={m.id===material.id}>
      <input type="radio" name="mobile-roof" checked={m.id===material.id} onChange={()=>onChange({...roof,finish:{...finish,material:m.id,...(m.id!=='acrylic'&&!finish.ceiling?{ceiling:'thermopine-150' as const}:{})}})}/>{m.name}
    </label>)}</fieldset>
    <figure className={css.combinationImage} data-roof-combination={`${shape.id}-${material.id}`}>
      <MobileRoofImage src={image} alt={`${shape.name} pergola with ${material.name.toLowerCase()} roofing — architectural illustration`} />
    </figure>
    <p className={css.roofBenefit} aria-live="polite">{material.benefit}</p>
  </section>;
}
