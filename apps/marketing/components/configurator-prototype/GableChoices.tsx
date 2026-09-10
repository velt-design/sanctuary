import type { PergolaLighting, RepresentativeRoofBattens, RepresentativeRoofFinish } from "@sp/geometry";
import type { PreviewBlind } from './blindCatalog';
import type { SidePanel } from './sidePanelCatalog';
import styles from './prototype.module.css';
import guide from './roofGuide.module.css';

export type PreviewRoofChoices = { family: 'mono' | 'gable' | 'box'; orientation: 'parallel' | 'away'; infills: boolean; finish?: RepresentativeRoofFinish; roofBattens?:RepresentativeRoofBattens; lighting?:PergolaLighting; blinds?: PreviewBlind[]; sidePanels?:SidePanel[] };
export const INITIAL_ROOF: PreviewRoofChoices = { family: 'mono', orientation: 'parallel', infills: false };

export function RoofTypeChoice({ value, onChange }: { value: PreviewRoofChoices; onChange: (next: PreviewRoofChoices) => void }) {
  return <fieldset className={guide.choices}><legend>Roof style</legend>
    <div className={guide.cards}>{(['mono', 'gable', 'box'] as const).map(family => <label className={guide.card} key={family} data-selected={value.family === family}>
      <span><input type="radio" name="roof-style" aria-describedby={value.family === family ? 'roof-style-description' : undefined} checked={value.family === family} onChange={() => onChange({ ...value, family })} />
      {family === 'mono' ? 'Pitched' : family === 'gable' ? 'Gable' : 'Box perimeter'}</span>
    </label>)}</div>
    <p className={guide.description} id="roof-style-description">{value.family === 'mono' ? 'A single slope away from your home.' : value.family === 'gable' ? 'Two slopes meet at a raised ridge.' : 'A level frame conceals the roof slope.'}</p>
  </fieldset>;
}

export default function GableChoices({ value, onChange }: { value: PreviewRoofChoices; onChange: (next: PreviewRoofChoices) => void }) {
  if (value.family !== 'gable') return null;
  return <div className={styles.gableChoices}>
    <fieldset className={styles.choices}><legend>Ridge direction</legend>
      {(['parallel', 'away'] as const).map(orientation => <label key={orientation} data-selected={value.orientation === orientation}>
        <input type="radio" name="ridge-direction" checked={value.orientation === orientation} onChange={() => onChange({ ...value, orientation })} />
        {orientation === 'parallel' ? 'Parallel to house' : 'Away from house'}
      </label>)}
    </fieldset>
    <p className={styles.small}>{value.orientation === 'parallel' ? 'Along the house, with a gutter on each side.' : 'Connects into the Dutch-gable roof fascia.'}</p>
    <label className={styles.infillChoice}><input type="checkbox" checked={value.infills} onChange={event => onChange({ ...value, infills: event.target.checked })} />Gable infills</label>
    <p className={styles.small}>Clear acrylic {value.orientation === 'parallel' ? 'at both ends' : 'at the front end'}, with slim support members.</p>
  </div>;
}
