'use client';
import { layoutRafterLights } from '@sp/geometry';
import type { ReactNode } from 'react';
import { useLighting } from './LightingProvider';
import { sharedCedarOptions, selectedCedarLights } from './cedarSelection';
import { DEFAULT_LIGHTING, hasLighting } from './lightingSelection';
import LightingControls from './LightingControls';
import css from './mobileJourney.module.css';
import extras from './mobileExtras.module.css';

export default function MobileLightingChoices({ onPreview, notice, preview, estimate }: { onPreview: () => void; notice?: string; preview: ReactNode; estimate: ReactNode }) {
  const w = useLighting()!;
  const ceilingOptions = sharedCedarOptions(w.sites.cedar);
  const choices = [
    { id: 'off', label: 'No lights', amount: 'off' },
    { id: 'low', label: 'Gentle', amount: 'low' },
    { id: 'medium', label: 'Brighter', amount: 'medium' },
  ] as const;
  const setting = (amount: 'off' | 'low' | 'medium') => {
    const ceiling = amount === 'off' ? undefined : ceilingOptions.find(o => o.count === (amount === 'low' ? 2 : 4)) ?? ceilingOptions[0];
    return { ...DEFAULT_LIGHTING, rafterAmount: amount,
      cedarPerSection: ceiling?.count ?? 0, cedarPattern: ceiling?.pattern ?? 'rows2' as const };
  };
  return <section aria-label="Choose lighting" className={css.simpleEditor}>
    <div className={extras.lightingChoices} role="group" aria-label="Lighting starting layouts">
      {choices.map(choice => {
        const preset = setting(choice.amount);
        const count = layoutRafterLights(w.sites.allRafters, choice.amount).length + selectedCedarLights(w.sites.cedar, preset).length;
        const possible = choice.amount === 'off' || count > 0;
        const selected = choice.amount === 'off' ? !hasLighting(w.value) : !w.value.strips.length && !w.value.cedarIndividual && w.value.rafterAmount === choice.amount && (w.value.cedarPerSection ?? 0) === preset.cedarPerSection;
        return <button key={choice.id} disabled={!possible} aria-pressed={selected} onClick={() => { w.change(preset); w.setView('3D'); w.setNight(true); }}>
          {choice.label}<small>{!possible ? 'Unavailable' : count ? `${count} lights` : 'Off'}</small>
        </button>;
      })}
    </div>
    {preview}
    <p className={extras.lightingSummary} role="status"><strong>{hasLighting(w.value) ? 'Warm-white lighting' : 'No lighting selected'}</strong>
      <span>{[w.value.rafterCount && `${w.value.rafterCount} rafter spots`, w.value.cedarCount && `${w.value.cedarCount} ceiling downlights`, w.value.strips.length && `${w.value.strips.length} LED strips`].filter(Boolean).join(' · ') || 'Evening preview'}</span>
    </p>
    {estimate}
    <details className={css.details}><summary>Fine-tune lighting & LED strips</summary><LightingControls guided onPreview={onPreview} /></details>
    {notice?.includes('lights') && <p className={css.notice} role="status">{notice}</p>}
    {(w.value.strips.length > 0 || w.value.cedarIndividual) && <p className={css.caption}>Choosing a layout replaces your current lights and strips.</p>}
  </section>;
}

