import { tintOptions } from './content';
import styles from './acrylic-editorial.module.css';

/** Native radios keep tint exploration usable before hydration and without JavaScript. */
export default function AcrylicTintComparison() {
  return <div className={styles.comparison}>
    <fieldset className={styles.tintChoices}>
      <legend>Compare acrylic tints</legend>
      {tintOptions.map((tint, index) => <label className={styles.tintChoice} key={tint.tone}>
        <input type="radio" name="acrylic-tint-preview" value={tint.tone} defaultChecked={index === 0} aria-controls={`tint-description-${tint.tone}`} />
        <span className={styles.swatch} data-tint-tone={tint.tone} aria-hidden="true"><span /></span>
        <span className={styles.tintLabel}>{tint.name.replace(' acrylic', '')}<span className={styles.selectedMark} aria-hidden="true">✓</span></span>
      </label>)}
    </fieldset>
    <div className={styles.tintDescriptions}>
      {tintOptions.map(tint => <div className={styles.tintDescription} key={tint.tone} data-tint-description={tint.tone} id={`tint-description-${tint.tone}`}>
        <h3>{tint.name}</h3>
        <p>{tint.visual}</p>
        <dl><div><dt>Daylight</dt><dd>{tint.daylight}</dd></div><div><dt>Consider</dt><dd>{tint.assess}</dd></div></dl>
      </div>)}
    </div>
    <p className={styles.swatchNote}>Illustrative swatches. Confirm the exact tint using current product samples at your site.</p>
  </div>;
}
