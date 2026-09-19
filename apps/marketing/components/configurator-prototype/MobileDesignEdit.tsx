import type { PreviewSelection } from './ConfiguratorPrototype';
import type { RailSection } from './RailProvider';
import { getRoofFinish } from './roofFinish';
import css from './mobileEdit.module.css';

export default function MobileDesignEdit({ selection: { input, roof }, onEdit, onDetails }: {
  selection: PreviewSelection; onEdit: (section: RailSection) => void; onDetails: () => void;
}) {
  const material = getRoofFinish(roof).material;
  const blinds = roof.blinds?.length ?? 0;
  const panels = roof.sidePanels?.length ?? 0;
  const lights = (roof.lighting?.rafterCount ?? 0) + (roof.lighting?.cedarCount ?? 0);
  const strips = roof.lighting?.strips.length ?? 0;
  const rows = [
    { section: 'roof', title: 'Roof', label: 'Roof & ceiling', detail: `${roof.family === 'mono' ? 'Pitched' : roof.family === 'gable' ? 'Gable' : 'Box'} · ${material === 'acrylic' ? 'Acrylic' : material === 'solid' ? 'Solid' : 'Combination'}`, path: 'M3 12 12 5l9 7M5 11v9m14-9v9M5 15h14' },
    { section: 'structure', title: 'Size & position', label: 'Size & structure', detail: `${(input.widthMm / 1000).toFixed(1)} × ${(input.projectionMm / 1000).toFixed(1)} m · ${roof.attachmentIntent === 'freestanding' ? 'Freestanding' : roof.attachmentIntent === 'unsure' ? 'Position to confirm' : 'Attached'}`, path: 'M5 5h14v14H5zM2 4v16m20-16v16M4 22h16' },
    { section: 'sides', title: 'Sides', label: 'Sides & privacy', detail: [blinds ? `${blinds} blind${blinds === 1 ? '' : 's'}` : '', panels ? `${panels} screen${panels === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'Open on all sides', path: 'M4 4h16v16H4zM8 4v16m4-16v16m4-16v16' },
    { section: 'lighting', title: 'Lighting', label: 'Lighting', detail: [lights ? `${lights} light${lights === 1 ? '' : 's'}` : '', strips ? `${strips} LED strip${strips === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'No lighting selected', path: 'M8 16c0-3-3-3-3-7a7 7 0 0 1 14 0c0 4-3 4-3 7ZM9 20h6m-5 3h4' },
  ] as const;
  return <section className={css.menu} aria-label="Choose what to edit">
    <div className={css.choices}>{rows.map(row => <button key={row.section} onClick={() => onEdit(row.section)} aria-label={`Edit ${row.label}`}>
      <svg className={css.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d={row.path}/></svg>
      <span><strong>{row.title}</strong><small>{row.detail}</small></span>
      <svg className={css.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
    </button>)}</div>
    <button className={css.details} onClick={onDetails}>Connection & design options <span aria-hidden="true">+</span></button>
  </section>;
}
