'use client';
import { useMemo } from 'react';
import { solvePergolaPreview, type PreviewRoofChoices, type SimpleCoverInput } from '@sp/configurator/geometry';
import { STUDIO_PANEL_SIDES, studioRoofPanelOptions } from '@sp/geometry';
import css from './StudioWebsite.module.css';

export function newStudioMixedPanels(input:SimpleCoverInput,roof:PreviewRoofChoices) {
  const finish={material:'combination' as const,layout:'central' as const,acrylicBays:2,profile:'corrugated' as const,trayWidth:400 as const,...roof.finish};
  delete finish.studioPanels;
  const geometry=solvePergolaPreview(input,{...roof,finish:{...finish,material:'combination',layout:'central'}}).geometry;
  const options=geometry?studioRoofPanelOptions(geometry.assembly.roofPlanes):null;
  const side=options?.sides.find(s=>s==='left'&&options.limits[s]>0)??options?.sides.find(s=>options.limits[s]>0)??'left';
  return {version:1 as const,count:Math.min(2,options?.limits[side]||1),side};
}

export default function StudioMixedRoofControls({ input, roof, onChange }: { input: SimpleCoverInput; roof: PreviewRoofChoices; onChange: (roof: PreviewRoofChoices) => void }) {
  const finish = roof.finish!;
  const options = useMemo(() => {
    const legacy = { ...finish }; delete legacy.studioPanels;
    const geometry = solvePergolaPreview(input, { ...roof, finish: { ...legacy, ...(finish.studioPanels ? {layout:'central' as const} : {}) } }).geometry;
    return geometry ? { ...studioRoofPanelOptions(geometry.assembly.roofPlanes), currentCount: geometry.assembly.roofCladdingPanels.filter(p => p.id.startsWith('finish-acrylic-')).length } : null;
  }, [input, roof, finish]);
  const selected = finish.studioPanels;
  const count = selected?.count ?? options?.currentCount ?? 2;
  const side = selected?.side ?? 'left';
  const max = options?.limits[side] ?? 0;
  const change = (next: { count: number; side: typeof side }) => onChange({ ...roof, finish: { ...finish, studioPanels: { version: 1, ...next } } });
  return <section aria-label="Mixed roof panels">
    <label className={css.field}>Acrylic panels
      <select aria-label="Acrylic panels" value={count} disabled={!max} onChange={e => change({ count: Number(e.target.value), side })}>
        {(!options || count > max) && <option value={count}>{count}</option>}
        {Array.from({ length: max }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
    </label>
    <label className={css.field}>Panel position
      <select aria-label="Panel position" value={selected?.side ?? 'legacy'} disabled={!options} onChange={e => change({ count, side: e.target.value as typeof side })}>
        {!selected && <option value="legacy" disabled>Existing {finish.layout === 'house' ? 'house-side' : 'central'} band</option>}
        {STUDIO_PANEL_SIDES.map(value => <option key={value} value={value} disabled={!options?.sides.includes(value)}>{value[0].toUpperCase() + value.slice(1)}</option>)}
      </select>
    </label>
    <p className={css.panelHint}>{options ? `${count} panel${count===1?'':'s'} total across the roof. Full-length sheets.` : 'Check the roof dimensions to choose panels.'}
      {options && !options.sides.includes('front') && ' Front/back placement needs a gable roof.'}
      {selected && count > max && ` Choose 1–${max} panels for ${side}.`}
      {!selected && ' Existing band layout. Choose count or position to change it.'}</p>
  </section>;
}
