'use client';
import { useEffect, useState } from 'react';
import type { BlindOpening } from '@sp/geometry';
import type { PreviewRoofChoices } from './GableChoices';
import { mobileSidePresets, sideConfigurationKey } from './mobileSidePresets';

type Snapshot = Pick<PreviewRoofChoices, 'blinds' | 'sidePanels'>;
/** A comparison bookmark, separate from the design. Never restore stale geometry or roof choices. */
export function useSideLookComparison(roof: PreviewRoofChoices, openings: BlindOpening[], onChange: (roof: PreviewRoofChoices) => void) {
  const scope = JSON.stringify([roof.family, roof.orientation, roof.attachmentIntent, openings]);
  const [saved, setSaved] = useState<{ scope: string; sides: Snapshot } | null>(null);
  const [privacySide, setPrivacySide] = useState<'left' | 'right'>(() => roof.sidePanels?.length && roof.sidePanels.every(panel => panel.opening.startsWith('right-')) ? 'right' : 'left');
  const looks = mobileSidePresets(roof, openings, privacySide);
  const key = sideConfigurationKey(roof);
  const index = looks.findIndex(look => sideConfigurationKey(look.roof) === key);
  const custom = saved?.scope === scope ? saved.sides : null;
  useEffect(() => {
    if (index < 0) setSaved({ scope, sides: { blinds: roof.blinds, sidePanels: roof.sidePanels } });
  }, [scope, key, index]);
  function move(direction: number) {
    if (index < 0) setSaved({ scope, sides: { blinds: roof.blinds, sidePanels: roof.sidePanels } });
    const count = looks.length + (custom || index < 0 ? 1 : 0);
    const current = index < 0 ? looks.length : index;
    const next = (current + direction + count) % count;
    if (next === looks.length && custom) onChange({ ...roof, ...custom });
    else if (looks[next]) onChange(looks[next].roof);
  }
  return {
    looks, index, move, privacySide,
    hasCustom: Boolean(custom), isCustom: index < 0,
    restore: () => { if (custom) onChange({ ...roof, ...custom }); },
    clear: () => setSaved(null),
    flipPrivacy: () => {
      const side = privacySide === 'left' ? 'right' : 'left';
      setPrivacySide(side);
      const look = mobileSidePresets(roof, openings, side).find(item => item.id === 'privacy');
      if (look) onChange(look.roof);
    },
  };
}
