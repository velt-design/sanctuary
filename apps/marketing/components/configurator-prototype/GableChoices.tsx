import styles from './prototype.module.css';
import guide from './roofGuide.module.css';

export type PreviewRoofChoices = { family: 'mono' | 'gable' | 'box'; orientation: 'parallel' | 'away'; infills: boolean };
export const INITIAL_ROOF: PreviewRoofChoices = { family: 'mono', orientation: 'parallel', infills: false };

export function RoofTypeChoice({ value, onChange }: { value: PreviewRoofChoices; onChange: (next: PreviewRoofChoices) => void }) {
  return <fieldset className={guide.choices}><legend>Roof style</legend>
    <div className={guide.cards}>{(['mono', 'gable', 'box'] as const).map(family => <label className={guide.card} key={family} data-selected={value.family === family}>
      <svg viewBox="0 0 64 36" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d={family === 'mono' ? 'M8 7V33M56 18V33M5 6L59 18' : family === 'gable' ? 'M8 21V33M56 21V33M5 21L32 5L59 21' : 'M8 15V33M56 15V33M5 7H59V15H5Z'} />
      </svg>
      <span><input type="radio" name="roof-style" aria-describedby={value.family === family ? 'roof-style-description' : undefined} checked={value.family === family} onChange={() => onChange({ ...value, family })} />
      {family === 'mono' ? 'Pitched' : family === 'gable' ? 'Gable' : 'Box perimeter'}</span>
    </label>)}</div>
    <p className={guide.description} id="roof-style-description">{value.family === 'mono' ? 'A simple slope for a light, open connection to your home.' : value.family === 'gable' ? 'A raised centre brings extra height and an airy feel.' : 'A deep, level frame conceals the roof slope for a clean outline.'}</p>
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
