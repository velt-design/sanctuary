'use client';

import { useState } from 'react';
import Image from 'next/image';
import { blindStates } from './content';
import styles from './blinds.module.css';

/** Actual photographs of one opening, never an interpolated or aligned simulation. */
export default function BlindStateGallery() {
  const [selected, setSelected] = useState(1);
  return <figure className={styles.stateGallery}>
    <div className={styles.stateControls} role="group" aria-label="View the right-hand opening">
      {blindStates.map((state, index) => <button key={state.label} type="button" aria-pressed={selected === index} aria-controls="blind-state-photo" onClick={() => setSelected(index)}>{state.label}</button>)}
    </div>
    <div className={styles.statePhoto} id="blind-state-photo">
      {blindStates.map((state, index) => <Image key={state.label} src={state.image} alt={state.alt} width={1800} height={1179} sizes="(max-width: 800px) 100vw, (max-width: 1440px) 65vw, 850px" hidden={selected !== index}/>)}
    </div>
    <figcaption><span aria-live="polite">Right-hand opening: {blindStates[selected].label.toLowerCase()}.</span> Two photographs of the same installation, taken from slightly different positions.</figcaption>
  </figure>;
}
