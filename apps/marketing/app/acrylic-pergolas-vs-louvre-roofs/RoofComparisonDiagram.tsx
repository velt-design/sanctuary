'use client';

import { useId, useState } from 'react';
import styles from './comparison.module.css';

function RoofDrawing({ kind, open = false }: { kind: 'acrylic' | 'louvre'; open?: boolean }) {
  const id = useId();
  const title = kind === 'acrylic' ? 'Fixed clear acrylic roof' : `Solid tilting blades, ${open ? 'open' : 'closed'}`;
  return <svg viewBox="0 0 360 235" role="img" aria-labelledby={`${id}-title ${id}-description`}>
    <title id={`${id}-title`}>{title}</title>
    <desc id={`${id}-description`}>{kind === 'acrylic' ? 'The transparent sheets stay in place above the frame.' : open ? 'The blades tilt, leaving gaps between them. They remain above the frame.' : 'The solid blades sit across the roof opening.'} Simplified illustration, not a project design or performance model.</desc>
    <path d="M42 167 230 211 326 151 137 108Z" fill="#dfe1d8" />
    <path d="M46 86v82M230 129v81M325 69v82M140 26v82" fill="none" stroke="#6c7367" strokeWidth="5" />
    <g transform="matrix(1 .23 -.8 .5 140 26)">
      <rect width="184" height="118" fill="#bed1d5" />
      {kind === 'acrylic' ? <>
        <rect width="184" height="118" fill="#d9e9e9" fillOpacity=".6" />
        {[46, 92, 138].map(x => <path key={x} d={`M${x} 0v118`} stroke="#818b80" strokeWidth="2" />)}
        <path d="m20 15 32 25m-14-25 32 25m35 35 32 25m-14-25 32 25" stroke="white" strokeWidth="3" opacity=".7" />
      </> : Array.from({ length: 7 }, (_, index) => <g key={index} data-roof-blade>
        <rect y={index * 17} width="184" height={open ? 3 : 16} fill="#858d7e" stroke="#6c7367" strokeWidth="1" />
        {open && <path d={`M0 ${index * 17}v-4h184v4Z`} fill="#a9b09f" stroke="#6c7367" strokeWidth="1" />}
      </g>)}
      <rect width="184" height="118" fill="none" stroke="#53604b" strokeWidth="7" />
    </g>
    <path d="m46 86 184 43 95-60" fill="none" stroke="#53604b" strokeWidth="8" />
  </svg>;
}

export default function RoofComparisonDiagram() {
  const [open, setOpen] = useState(true);
  return <section className={styles.diagram} aria-label="How the two roof types work">
    <div className={styles.diagramPair}>
      <div className={styles.roofExample}>
        <p className={styles.diagramOwner}>Sanctuary</p>
        <h3>Fixed acrylic</h3>
        <RoofDrawing kind="acrylic" />
        <p>Light through a fixed sheet.</p>
        <span className={styles.fixedState}>Roof stays in place</span>
      </div>
      <div className={styles.roofExample}>
        <p className={styles.diagramOwner}>Other suppliers</p>
        <h3>Tilting louvres</h3>
        <RoofDrawing kind="louvre" open={open} />
        <p aria-live="polite">{open ? 'Gaps between tilted blades.' : 'Solid blades across the opening.'}</p>
        <div className={styles.stateControls} role="group" aria-label="Louvre illustration position">
          <button type="button" aria-pressed={open} onClick={() => setOpen(true)}>Open</button>
          <button type="button" aria-pressed={!open} onClick={() => setOpen(false)}>Closed</button>
        </div>
      </div>
    </div>
    <p className={styles.diagramNote}>Simplified roof views: clear acrylic and solid tilting blades. Other materials and retracting systems differ.</p>
  </section>;
}
