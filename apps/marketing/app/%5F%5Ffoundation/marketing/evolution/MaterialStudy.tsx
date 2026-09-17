'use client';

import { useState } from 'react';
import { Container, Disclosure, Eyebrow, Figure, Heading, Text } from '@/components/marketing-foundation';
import styles from './evolution.module.css';

const materials = [
  { name: 'Acrylic roofing', number: '01', image: '/images/product-gable-01.jpg', alt: 'Acrylic roof over an outdoor courtyard', heading: 'Keep daylight in the picture.', copy: 'Explore the appearance of acrylic roofing in a completed setting.' },
  { name: 'Timber sarking', number: '02', image: '/images/timber-gable-ceiling.jpg', alt: 'Warm timber sarking beneath a gable roof', heading: 'Bring warmth overhead.', copy: 'Explore the texture and rhythm of a timber-lined ceiling.' },
];

export default function MaterialStudy() {
  const [selected, setSelected] = useState(0);
  const material = materials[selected];
  return <section className={`${styles.section} ${styles.warmSection}`} id="material-study"><Container width="wide">
    <div className={styles.sectionHeading}><Eyebrow>02 / Choose</Eyebrow><Heading>Make the choice feel clear.</Heading><Text>A visible selection, a supporting image, and detail when you need it. This is a material presentation study, not a specification or quote.</Text></div>
    <div className={styles.materialGrid}>
      <div className={styles.materialControls}>
        <fieldset className={styles.options}><legend>Explore a material</legend>{materials.map((item, index) => <label className={styles.option} key={item.name}><input type="radio" name="material" value={item.name} checked={selected === index} onChange={() => setSelected(index)} /><span className={styles.optionNumber}>{item.number}</span><span>{item.name}</span><span className={styles.selectionMark} aria-hidden="true">{selected === index ? '✓' : '+'}</span></label>)}</fieldset>
        <div className={styles.materialDescription} aria-live="polite" aria-atomic="true"><div key={selected} className={styles.transition}><span className={styles.micro}>Selected / {material.name}</span><Heading as="h3" variant="card">{material.heading}</Heading><Text>{material.copy}</Text></div></div>
        <Disclosure summary="What would we resolve together?" bodyClassName={styles.reveal}><Text>Roof form, connection to the house, material suitability and finishes would be confirmed for the individual project. This preview makes no availability or pricing commitment.</Text></Disclosure>
        <p className={styles.annotation}>Selection stays in place when you switch motion treatments. Reloading resets this study.</p>
      </div>
      <div className={styles.materialImage}><div key={selected} className={styles.transition}><Figure image={material.image} alt={material.alt} ratio="standard" caption={material.name} detail="Material reference" /></div><span className={styles.imageTag} aria-hidden="true">{material.number} / 02</span></div>
    </div>
  </Container></section>;
}
