import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import css from './mobileJourney.module.css';

export default function MobileSiteChoices({ input, roof, setInput, setRoof }: {
  input: SimpleCoverInput; roof: PreviewRoofChoices;
  setInput: (value: SimpleCoverInput) => void; setRoof: (value: PreviewRoofChoices) => void;
}) {
  return <div className={css.siteChoices}>
    <fieldset className={css.segmented}><legend>How will it stand?</legend>
        <div>{(['attached', 'freestanding'] as const).map(position => <label key={position} data-selected={position === 'attached' ? !roof.attachmentIntent : roof.attachmentIntent === position}>
          <input type="radio" name="mobile-position" checked={position === 'attached' ? !roof.attachmentIntent : roof.attachmentIntent === position} onChange={() => setRoof({ ...roof, attachmentIntent: position === 'attached' ? undefined : 'freestanding' })} />
          {position === 'attached' ? 'Attached' : 'Freestanding'}
        </label>)}</div>
    </fieldset>
    {roof.attachmentIntent === 'unsure' && <p className={css.caption}>Connection is marked “Not sure” in More design options.</p>}
    <fieldset className={css.segmented}><legend>Where will it sit?</legend>
      <div>{(['ground', 'elevated'] as const).map(level => <label key={level} data-selected={input.level === level} data-disabled={level === 'elevated' && roof.attachmentIntent === 'freestanding'}>
        <input type="radio" name="mobile-level" disabled={level === 'elevated' && roof.attachmentIntent === 'freestanding'} checked={input.level === level} onChange={() => setInput({ ...input, level })} />
        {level === 'ground' ? 'Ground' : 'Elevated'}
      </label>)}</div>
    </fieldset>
    
  </div>;
}
