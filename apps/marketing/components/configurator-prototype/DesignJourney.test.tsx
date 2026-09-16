import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import LightingProvider, { useLighting } from './LightingProvider';
import RailProvider, { useRail } from './RailProvider';
import JourneyNavigation from './JourneyNavigation';
import { INITIAL_INPUT } from './model';
import { INITIAL_ROOF } from './GableChoices';

it('keeps the view on lighting entry and resets night when advancing to review', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'), root = createRoot(host);
  function Harness() {
    const lighting = useLighting()!, rail = useRail();
    return <><output>{rail.section}:{lighting.view}:{String(lighting.night)}</output>
      <button onClick={() => rail.choose('lighting')}>Lighting</button>
      <button onClick={() => lighting.setNight(true)}>Night</button>
      <button onClick={() => lighting.setView('Plan')}>Plan</button>
      <JourneyNavigation /></>;
  }
  const click = async (label: string) => {
    const button = [...host.querySelectorAll('button')].find(b => b.textContent?.startsWith(label))!;
    expect(button).toBeTruthy(); await React.act(async () => button.click());
  };
  try {
    await React.act(async () => root.render(<LightingProvider input={INITIAL_INPUT} roof={INITIAL_ROOF} onChange={() => {}}><RailProvider><Harness /></RailProvider></LightingProvider>));
    await click('Lighting'); expect(host.querySelector('output')!.textContent).toBe('lighting:3D:false');
    await click('Night'); expect(host.querySelector('output')!.textContent).toBe('lighting:3D:true');
    await click('Back to Personalise'); expect(host.querySelector('output')!.textContent).toBe('personalise:3D:false');
    await click('Review my design →'); expect(host.querySelector('output')!.textContent).toBe('review:3D:false');
    await click('Plan'); await click('Lighting'); expect(host.querySelector('output')!.textContent).toBe('lighting:Plan:false');
  } finally { await React.act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
