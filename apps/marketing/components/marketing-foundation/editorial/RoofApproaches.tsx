'use client';

import { useSyncExternalStore } from 'react';
import { Figure, Text } from '../Primitives';
import styles from './roof-approaches.module.css';

const references = [
  { id: 'acrylic', label: 'Acrylic', image: '/images/product-gable-01.jpg', alt: 'Acrylic roof over an outdoor courtyard', caption: 'Acrylic roofing reference', emphasis: 'Daylight through the roof' },
  { id: 'solid', label: 'Solid', image: '/images/timber-gable-ceiling.jpg', alt: 'Timber-lined gable ceiling', caption: 'Timber-lined ceiling reference', emphasis: 'An opaque shade condition' },
  { id: 'combination', label: 'Combination', image: '/images/project-warkworth-outdoor-room-04.jpg', alt: 'Clear acrylic zones beside the cedar-lined roof at Warkworth', caption: 'Mixed roof zones at Warkworth', emphasis: 'Daylight and shade in zones' },
];

const subscribe = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  window.addEventListener('sanctuary-roof-choice', notify);
  return () => { window.removeEventListener('popstate', notify); window.removeEventListener('sanctuary-roof-choice', notify); };
};
const currentRoof = () => new URLSearchParams(window.location.search).get('roof') ?? 'acrylic';
const serverRoof = () => 'acrylic';

export default function RoofApproaches({ options }: { options: string[] }) {
  const requested = useSyncExternalStore(subscribe, currentRoof, serverRoof);
  const index = Math.max(0, references.findIndex(item => item.id === requested));
  const selected = references[index];
  const change = (id: string) => { const url = new URL(window.location.href); url.searchParams.set('roof', id); window.history.replaceState(null, '', url); window.dispatchEvent(new Event('sanctuary-roof-choice')); };
  const optionCopy = options[index]?.replace(/^[^:]+:\s*/, '') ?? '';
  const selectedCopy = optionCopy.charAt(0).toUpperCase() + optionCopy.slice(1);

  return <div className={styles.roofGrid}>
    <div className={styles.roofControls}><noscript><style>{`.${styles.roofOptions}{display:none}`}</style><p>Roof approaches</p><ul className={styles.staticOptions}>{options.map(option => <li key={option}>{option}</li>)}</ul></noscript><fieldset className={styles.roofOptions}><legend>Compare roof approaches</legend>{references.map((item, itemIndex) => <label key={item.id}><input type="radio" aria-label={`0${itemIndex + 1} ${item.label}: ${item.emphasis}`} name="roof-approach" checked={selected.id === item.id} onChange={() => change(item.id)} /><span className={styles.optionNumber}>0{itemIndex + 1}</span><span>{item.label}<small>{item.emphasis}</small></span><span aria-hidden="true">{selected.id === item.id ? '✓' : '+'}</span></label>)}</fieldset></div>
      <div className={styles.roofCopy} aria-live="polite" aria-atomic="true"><p>{selected.label} roofing</p><Text>{selectedCopy}</Text></div>
      <div className={styles.roofCaveat}><Text size="small">Explore the approaches here. Roofing, structure and suitability are confirmed for your site before specification.</Text></div>
    <div key={selected.id} className={styles.roofImage}><Figure image={selected.image} alt={selected.alt} caption={selected.caption} ratio="standard" sizes="(max-width: 760px) 100vw, 50vw" /><p className={styles.imageNote}>Material reference · each project is individually specified</p></div>
  </div>;
}
