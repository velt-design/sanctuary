'use client';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import css from './mobileJourney.module.css';
import styles from './prototype.module.css';
import { useLighting } from './LightingProvider';
const PreviewViews = dynamic(() => import('./PreviewViews'), { ssr: false });

/** Remounted by design key so an edit or resumed visit can never show a stale portrait. */
export default function MobileDesignPortrait({ input, roof, onExplore }: {
  input: SimpleCoverInput; roof: PreviewRoofChoices; onExplore: () => void;
}) {
  const [image, setImage] = useState('');
  const night = useLighting()?.night ?? false;
  return <figure className={css.portrait}>
    <div className={`${css.portraitImage} ${styles.viewport}`} style={{ '--night-amount': Number(night) } as CSSProperties} data-portrait-night={night} data-design-portrait={image ? 'captured' : 'preview'}>
      {image ? <Image unoptimized src={image} alt="Your configured pergola, with your selected roof and sides" fill sizes="100vw" />
        : <PreviewViews input={input} roof={roof} activeDimension={null} expanded={false} onToggleExpanded={() => {}} guided simple presentation onCapture={setImage} />}
    </div>
    <figcaption><span>Your design</span><button onClick={onExplore}>Explore your design <ArrowUpRight /></button></figcaption>
  </figure>;
}
