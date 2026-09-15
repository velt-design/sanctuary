import { roofFinishBayLimit, type RepresentativeRoofFinish } from '@sp/geometry';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import { allowsHouseBand, getRoofFinish } from './roofFinish';
import styles from './prototype.module.css';
import finishStyles from './roofFinish.module.css';
import ui from './sectionControls.module.css';
import {RoofMaterialDiagram} from './DesignIllustrations';

export default function RoofFinishChoices({ roof, input, onChange }: { roof: PreviewRoofChoices; input: SimpleCoverInput; onChange: (roof: PreviewRoofChoices) => void }) {
  const finish = getRoofFinish(roof);
  const change = (patch: Partial<RepresentativeRoofFinish>) => onChange({ ...roof, finish: { ...finish, ...patch } });
  const max = roofFinishBayLimit(input.widthMm, input.projectionMm, roof.family, roof.orientation);
  return <div className={finishStyles.controls}>
    <fieldset className={`${styles.choices} ${ui.material}`}><legend>Roof material</legend>
      {(['acrylic', 'solid', 'combination'] as const).map(material => <label key={material} data-selected={finish.material === material}>
        <input type="radio" name="roof-material" checked={finish.material === material} onChange={() => change({ material, ...(material !== 'acrylic' && !finish.ceiling ? {ceiling: 'thermopine-150'} : {}) })} />
        <span><RoofMaterialDiagram material={material}/><strong>{material === 'acrylic' ? 'Acrylic' : material === 'solid' ? 'Solid + timber ceiling' : 'Combination'}</strong><small>{material === 'acrylic' ? 'Let natural light through your roof.' : material === 'solid' ? 'A solid roof with timber underneath.' : 'Combine a solid roof with an acrylic skylight band.'}</small></span></label>)}
    </fieldset>
    {finish.material !== 'acrylic' && <div className={ui.group}><h3>Roof & timber finish</h3>
      <fieldset className={`${styles.choices} ${ui.options}`}><legend>Colorsteel profile</legend>
        {(['corrugated', 'trapezoidal', 'tray'] as const).map(profile => <label key={profile} data-selected={finish.profile === profile}>
          <input type="radio" name="roof-profile" checked={finish.profile === profile} onChange={() => change({ profile })} />
          {profile === 'corrugated' ? 'Corrugated' : profile === 'trapezoidal' ? 'Trapezoidal' : 'Tray'}</label>)}
      </fieldset>
      {finish.profile === 'tray' && <fieldset className={`${styles.choices} ${ui.options}`}><legend>Tray width</legend>
        {([300, 400, 500] as const).map(trayWidth => <label key={trayWidth} data-selected={finish.trayWidth === trayWidth}>
          <input type="radio" name="tray-width" checked={finish.trayWidth === trayWidth} onChange={() => change({ trayWidth })} />{trayWidth} mm</label>)}
      </fieldset>}
      <fieldset className={`${styles.choices} ${ui.options}`}><legend>Ceiling timber</legend>
        {(['thermopine', 'cedar'] as const).map(species => <label key={species} data-selected={!!finish.ceiling?.startsWith(species)}>
          <input type="radio" name="ceiling-timber" checked={!!finish.ceiling?.startsWith(species)} onChange={() => change({ceiling: `${species}-${finish.ceiling?.endsWith('150') ? 150 : 100}`})} />{species === 'cedar' ? 'Cedar' : 'ThermoPine'}</label>)}
      </fieldset>
      <fieldset className={`${styles.choices} ${ui.options}`}><legend>Ceiling board width</legend>
        {([150,100] as const).map(width => <label key={width} data-selected={!!finish.ceiling?.endsWith(String(width))}>
          <input type="radio" name="ceiling-width" checked={!!finish.ceiling?.endsWith(String(width))} onChange={() => change({ceiling: `${finish.ceiling?.startsWith('thermopine') ? 'thermopine' : 'cedar'}-${width}`})} />{width === 100 ? 'Narrow' : 'Wide'} · {width} mm</label>)}
      </fieldset>
      <p className={styles.small}>Factory-coated timber {roof.family === 'box' ? 'level ' : ''}ceiling beneath every solid section.</p>
    </div>}
    {finish.material === 'combination' && <div className={ui.group}><h3>Your skylight</h3>
      <fieldset className={`${styles.choices} ${ui.options}`}><legend>Skylight arrangement</legend>
        {(['central', ...(allowsHouseBand(roof) ? ['house'] : [])] as ('central' | 'house')[]).map(layout => <label key={layout} data-selected={finish.layout === layout}>
          <input type="radio" name="skylight-layout" checked={finish.layout === layout} onChange={() => change({ layout })} />{layout === 'central' ? 'Central band' : 'House-side band'}</label>)}
      </fieldset>
      <div className={finishStyles.bays}><span>Skylight width · roof bays</span><div role="group" aria-label="Skylight bays">
        <button type="button" aria-label="Remove acrylic bay" disabled={finish.acrylicBays <= 1} onClick={() => change({ acrylicBays: finish.acrylicBays - 1 })}>−</button>
        <output aria-live="polite">{finish.acrylicBays}</output>
        <button type="button" aria-label="Add acrylic bay" disabled={finish.acrylicBays >= max} onClick={() => change({ acrylicBays: finish.acrylicBays + 1 })}>+</button>
      </div></div>
      <p className={styles.small}>{finish.layout === 'central' ? 'The band stays centred as you add bays.' : 'The band grows outward from the house.'} {roof.family === 'gable' ? 'Each bay continues across both roof slopes.' : ''}</p>
    </div>}
  </div>;
}
