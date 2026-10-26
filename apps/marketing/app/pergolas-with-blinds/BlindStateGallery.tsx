'use client';

import { useState } from 'react';
import DecodedFigure from '../../components/marketing-foundation/DecodedFigure';
import { blindStates } from './content';
import styles from './blinds.module.css';

/** Actual photographs of one opening, never an interpolated or aligned simulation. */
export default function BlindStateGallery() {
  const [selected, setSelected] = useState(1);
  const state = blindStates[selected];
  return <div className={styles.stateGallery}>
    <div className={styles.stateControls} role="group" aria-label="View the right-hand opening">
      {blindStates.map((state, index) => <button key={state.label} type="button" aria-pressed={selected === index} aria-controls="blind-state-photo" onClick={() => setSelected(index)}>{state.label}</button>)}
    </div>
    <DecodedFigure className={styles.statePhoto} id="blind-state-photo" photo={{ image: state.image, alt: state.alt,
      caption: `Right-hand opening: ${state.label.toLowerCase()}. Two photographs of the same installation, taken from slightly different positions.` }}
      sizes="(max-width: 800px) 100vw, (max-width: 1440px) 65vw, 850px" />
  </div>;
}
