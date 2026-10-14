import { tintOptions } from './content';
import styles from './acrylic-editorial.module.css';

function TintScene({ tone, detail = false }: { tone: string; detail?: boolean }) {
  return <svg className={styles.tintScene} data-tint-tone={tone} viewBox="0 0 400 260" aria-hidden="true">
    <defs><linearGradient id={`sky-${tone}-${detail}`} x2="0" y2="1"><stop stopColor="#97b5c3"/><stop offset="1" stopColor="#d7e0df"/></linearGradient><radialGradient id={`cloud-${tone}-${detail}`}><stop stopColor="#fff" stopOpacity=".9"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient></defs>
    <rect width="400" height="260" fill={`url(#sky-${tone}-${detail})`} />
    <g className={styles.skyDetails}>
      <ellipse cx="115" cy="62" rx="110" ry="32" fill={`url(#cloud-${tone}-${detail})`}/><ellipse cx="214" cy="91" rx="95" ry="25" fill={`url(#cloud-${tone}-${detail})`}/>
      <path d="M0 240 105 200 248 252 400 200v60H0Z" fill="#667970" opacity=".2"/>
      <g stroke="#536458" fill="none" strokeWidth="2"><path d="M340 260Q304 158 372 48M333 224Q278 197 260 150M332 172Q375 144 400 104M347 112Q311 88 314 54"/></g>
      <g fill="#647766">{[[351,78,-32],[361,60,32],[344,98,-50],[332,127,-35],[329,151,25],[333,188,-30],[323,209,24],[310,210,-62],[289,191,-47],[277,177,22],[269,161,-28],[351,162,-48],[370,146,25],[388,123,-34],[329,102,-62],[315,85,25],[313,67,-35]].map(([x,y,angle],i)=><ellipse key={i} cx={x} cy={y} rx="6" ry="17" transform={`rotate(${angle} ${x} ${y})`}/>)}</g>
    </g>
    <rect className={styles.tintPane} width="400" height="260"/>
    <g stroke="#313a35" strokeWidth="5" fill="none"><path d="M0 4h400M0 256h400M5 0v260M395 0v260M135 0v260M268 0v260"/></g>
  </svg>;
}

/** Native radios keep tint exploration usable before hydration and without JavaScript. */
export default function AcrylicTintComparison() {
  return <div className={styles.comparison}>
    <fieldset className={styles.tintChoices}>
      <legend>Compare acrylic tints</legend>
      {tintOptions.map((tint, index) => <label className={styles.tintChoice} key={tint.tone}>
        <input type="radio" name="acrylic-tint-preview" value={tint.tone} defaultChecked={index === 0} aria-controls={`tint-description-${tint.tone}`} />
        <span className={styles.swatch}><TintScene tone={tint.tone} /></span>
        <span className={styles.tintLabel}>{tint.name.replace(' acrylic', '')}<span className={styles.selectedMark} aria-hidden="true">✓</span></span>
      </label>)}
    </fieldset>
    <div className={styles.tintDescriptions}>
      {tintOptions.map(tint => <div className={styles.tintDescription} key={tint.tone} data-tint-description={tint.tone} id={`tint-description-${tint.tone}`}>
        <div className={styles.largeScene}><TintScene detail tone={tint.tone} /><span>{tint.tone === 'opal' ? 'Diffused light. No clear view through.' : tint.tone === 'clear' ? 'Transparent. See the sky above.' : tint.tone === 'light-grey' ? 'A light tint. The sky remains visible.' : 'A darker tint. Less daylight through.'}</span></div><h3>{tint.name}</h3>
        <p>{tint.visual}</p>
        <dl><div><dt>Daylight</dt><dd>{tint.daylight}</dd></div><div><dt>Consider</dt><dd>{tint.assess}</dd></div></dl>
      </div>)}
    </div>
    <p className={styles.swatchNote}>Same-scene illustrations, not project photos or measured light transmission. They show the difference between transparent tints and translucent opal. Confirm colour and daylight with current product samples at your site.</p>
  </div>;
}
