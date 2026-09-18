import Image from 'next/image';
import type { PreviewRoofChoices } from './GableChoices';
import { getRoofFinish } from './roofFinish';
import css from './mobileJourney.module.css';

const shapes = [
  { id: 'mono', label: 'Pitched', image: '/images/configurator/shape-pitched-v1.webp', description: 'One clean slope. A simple, understated profile.', alt: 'Illustrated pitched pergola with one shallow roof slope' },
  { id: 'gable', label: 'Gable', image: '/images/configurator/shape-gable-v1.webp', description: 'A raised ridge. More height and openness overhead.', alt: 'Illustrated gable pergola with two slopes meeting at a raised ridge' },
  { id: 'box', label: 'Box perimeter', image: '/images/configurator/shape-box-v1.webp', description: 'A level outer frame. The roof slope sits inside.', alt: 'Illustrated box-perimeter pergola with a deep level outer frame' },
] as const;
const materials = [
  { id: 'acrylic', label: 'Acrylic', image: '/images/product-pitched-04.jpg', description: 'Keep the daylight. A light, open feeling overhead.', alt: 'Close detail of daylight through an acrylic pergola roof' },
  { id: 'solid', label: 'Solid', image: '/images/project-riverhead-gable-05.jpg', description: 'A solid roof with a timber ceiling underneath.', alt: 'Warm timber ceiling beneath a solid pergola roof, viewed from below' },
  { id: 'combination', label: 'Combination', image: '/images/project-warkworth-outdoor-room-03.jpg', description: 'Combine timber-lined shade with an acrylic skylight band.', alt: 'Acrylic roof zones beside a timber-lined ceiling' },
] as const;

export default function MobileRoofChoice({ kind, roof, onChange }: {
  kind: 'shape' | 'roof'; roof: PreviewRoofChoices; onChange: (roof: PreviewRoofChoices) => void;
}) {
  const options = kind === 'shape' ? shapes : materials;
  const finish = getRoofFinish(roof);
  const selected = options.find(option => option.id === (kind === 'shape' ? roof.family : finish.material))!;
  return <div className={css.choice}>
    <fieldset className={css.choiceTabs}><legend>{kind === 'shape' ? 'Roof shape' : 'Roof build-up'}</legend>
      {options.map(option => <label key={option.id} data-selected={option.id === selected.id}>
        <input type="radio" name={`mobile-${kind}`} checked={option.id === selected.id} onChange={() => {
          if (kind === 'shape') onChange({ ...roof, family: option.id as PreviewRoofChoices['family'] });
          else onChange({ ...roof, finish: { ...finish, material: option.id as typeof finish.material,
            ...(option.id !== 'acrylic' && !finish.ceiling ? { ceiling: 'thermopine-150' as const } : {}) } });
        }} />{option.label}<span aria-hidden="true">{option.id === selected.id ? '✓' : '+'}</span>
      </label>)}
    </fieldset>
    {kind === 'shape' && <div className={css.ridgeSlot}>
      {roof.family === 'gable' ? <>
        <fieldset className={css.segmented}><legend>Gable ridge direction</legend>
          <div>{(['parallel', 'away'] as const).map(orientation => <label key={orientation} data-selected={roof.orientation === orientation}>
            <input type="radio" name="mobile-ridge" checked={roof.orientation === orientation} onChange={() => onChange({ ...roof, orientation })} />
            {orientation === 'parallel' ? 'Parallel' : 'Extending'}
          </label>)}</div>
        </fieldset>
        <p className={css.caption}>{roof.attachmentIntent === 'freestanding' ? 'Parallel runs across the width; Extending runs along the projection.' : 'Parallel runs along the house; Extending runs out from it.'}</p>
      </> : <p className={css.caption}>Choose your shape above. Your own design appears after you set the size.</p>}
    </div>}
    <figure className={css.choiceImage} data-choice-kind={kind} data-material={selected.id} key={selected.id}>
      <Image src={selected.image} alt={selected.alt} fill sizes={kind === 'roof' ? '(max-width: 720px) 200vw, 1440px' : '(max-width: 720px) 100vw, 720px'} priority fetchPriority="high" />
    </figure>
    <div className={css.choiceDescription} aria-live="polite"><strong>{selected.label}</strong><p>{selected.description}</p></div>
    <p className={css.caption}>{kind === 'shape' ? 'Illustrated roof shapes. Your own design comes next.' : 'Material close-up. Your chosen roof shape stays the same.'}</p>
  </div>;
}

