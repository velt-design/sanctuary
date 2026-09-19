import type { BlindOpening } from '@sp/geometry';
import type { PreviewRoofChoices } from './GableChoices';
import { applySideTreatment, type SideTreatment } from './sideTreatment';

const looks: { id: string; name: string; front: SideTreatment; sides: SideTreatment }[] = [
  { id: 'open', name: 'Open sides', front: 'open', sides: 'open' },
  { id: 'front', name: 'Front blinds', front: 'blind', sides: 'open' },
  { id: 'blinds', name: 'Front & side blinds', front: 'blind', sides: 'blind' },
  { id: 'mixed', name: 'Front blinds + timber sides', front: 'blind', sides: 'timber' },
  { id: 'timber', name: 'Timber sides · open front', front: 'open', sides: 'timber' },
];

/** Only offer complete, valid configurations for the actual available openings. */
export function mobileSidePresets(roof: PreviewRoofChoices, openings: BlindOpening[]) {
  return looks.flatMap(look => {
    let candidate: PreviewRoofChoices = { ...roof, blinds: [], sidePanels: [] };
    for (const group of ['front', 'sides'] as const) {
      const ids = openings.filter(o => group === 'front' ? o.side === 'front' : o.side !== 'front').map(o => o.id);
      if (!ids.length) { if (look[group] !== 'open') return []; else continue; }
      const result = applySideTreatment(candidate, openings, ids, look[group]);
      if (result.issues.length) return [];
      candidate = result.roof;
    }
    return [{ ...look, roof: candidate }];
  });
}

/** Compare actual settings, not just materials, so refinements stay visibly custom. */
export function sideConfigurationKey(roof: PreviewRoofChoices) {
  const sorted = <T extends { opening: string }>(items: T[] = []) => [...items].sort((a, b) => a.opening.localeCompare(b.opening));
  return JSON.stringify({ blinds: sorted(roof.blinds), panels: sorted(roof.sidePanels) }, (_key, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
}
