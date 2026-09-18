'use client';
import { layoutRafterLights } from '@sp/geometry';
import { useLighting } from './LightingProvider';
import { sharedCedarOptions } from './cedarSelection';
import { DEFAULT_LIGHTING, hasLighting } from './lightingSelection';
import LightingControls from './LightingControls';
import css from './mobileJourney.module.css';

export default function MobileLightingChoices({ onPreview, notice }: { onPreview: () => void; notice?: string }) {
  const w = useLighting()!;
  const ceilingOptions = sharedCedarOptions(w.sites.cedar);
  const choices = [
    { id: 'off', label: 'No lighting', detail: 'Keep it simple. You can add lighting later.', amount: 'off' },
    { id: 'low', label: 'A gentle glow', detail: 'A lighter arrangement for relaxed evenings.', amount: 'low' },
    { id: 'medium', label: 'More light', detail: 'More fittings across your outdoor space.', amount: 'medium' },
  ] as const;
  const setting = (amount: 'off' | 'low' | 'medium') => {
    const ceiling = amount === 'off' ? undefined : ceilingOptions.find(o => o.count === (amount === 'low' ? 2 : 4)) ?? ceilingOptions[0];
    return { ...DEFAULT_LIGHTING, rafterAmount: amount,
      cedarPerSection: ceiling?.count ?? 0, cedarPattern: ceiling?.pattern ?? 'rows2' as const };
  };
  return <section aria-label="Choose lighting" className={css.simpleEditor}>
    <p>Choose the glow for your evenings.</p>
    <div className={css.intentChoices} role="group" aria-label="Lighting starting layouts">
      {choices.map(choice => {
        const preset = setting(choice.amount);
        const possible = choice.amount === 'off' || layoutRafterLights(w.sites.allRafters, choice.amount).length > 0 || preset.cedarPerSection > 0;
        const selected = choice.amount === 'off' ? !hasLighting(w.value) : !w.value.strips.length && !w.value.cedarIndividual && w.value.rafterAmount === choice.amount && (w.value.cedarPerSection ?? 0) === preset.cedarPerSection;
        return <button key={choice.id} disabled={!possible} aria-pressed={selected} onClick={() => { w.change(preset); w.setView('3D'); w.setNight(true); }}>
          <span><strong>{choice.label}</strong><small>{possible ? choice.detail : 'Use the detailed options for this roof.'}</small></span><span aria-hidden="true">{selected ? '✓' : '+'}</span>
        </button>;
      })}
    </div>
    <p className={css.selectionSummary} role="status">{w.value.rafterCount + w.value.cedarCount} lights · {w.value.strips.length} LED strips</p>
    <details className={css.details}><summary>Fine-tune lighting & LED strips</summary><LightingControls guided onPreview={onPreview} /></details>
    {notice?.includes('lights') && <p className={css.notice} role="status">{notice}</p>}
    <p className={css.caption}>The preview shows your selected fittings. Choosing a layout replaces your current lights and strips. Final positions are confirmed with your design.</p>
  </section>;
}

