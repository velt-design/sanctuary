import styles from './gable.module.css';

/** A qualitative section, not dimensions or an engineering detail. */
export default function GableSection() {
  return <figure className={styles.sectionDiagram}>
    <svg viewBox="0 0 620 350" role="img" aria-labelledby="gable-section-title gable-section-description">
      <title id="gable-section-title">The height and proportions of a gable</title>
      <desc id="gable-section-description">Two roof planes rise from the eaves to a central ridge. Width, roof pitch, eave height and ridge height work together. This illustration is not to scale.</desc>
      <path d="M75 290H545" className={styles.ground}/>
      <path d="M110 290V167L310 65L510 167V290M110 167H510" className={styles.structure}/>
      <path d="M75 185L310 65L545 185" className={styles.roof}/>
      <path d="M310 65V290M510 167H567M310 65H405M110 312H510" className={styles.guideLine}/>
      <circle cx="310" cy="65" r="5"/><circle cx="510" cy="167" r="5"/>
      <text x="415" y="70">Ridge</text><text x="525" y="150">Eaves</text>
      <text x="310" y="337" textAnchor="middle">Width</text>
    </svg>
    <figcaption>A gable in section. Illustration only, not a structural detail or a standard pitch.</figcaption>
  </figure>;
}
