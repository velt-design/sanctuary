import type { BlindOpening } from '@sp/geometry';
import type { PreviewRoofChoices } from './GableChoices';
import { defaultBlind } from './blindCatalog';
import { blindUnavailable } from './blindSelection';
import { defaultSidePanel } from './sidePanelCatalog';

export type SideTreatment = 'open' | 'timber' | 'aluminium' | 'blind' | 'acrylic';
export const sideTreatments: { id: SideTreatment; name: string; benefit: string }[] = [
  { id: 'open', name: 'Open', benefit: 'An open connection to your garden.' },
  { id: 'timber', name: 'Timber', benefit: 'Warm natural texture, with light and air between the slats.' },
  { id: 'aluminium', name: 'Aluminium', benefit: 'Clean, open slats in the colour of your frame.' },
  { id: 'blind', name: 'Blind', benefit: 'Lower for shelter. Roll up to open your space again.' },
  { id: 'acrylic', name: 'Acrylic', benefit: 'A fixed transparent screen that keeps the light and view.' },
];
export function sideTreatmentAt(roof: PreviewRoofChoices, id: string): SideTreatment {
  return roof.sidePanels?.find(p => p.opening === id)?.kind ?? (roof.blinds?.some(b => b.opening === id) ? 'blind' : 'open');
}
/** Validate the whole group before writing; retain existing same-kind customisation. */
export function applySideTreatment(roof: PreviewRoofChoices, openings: BlindOpening[], ids: string[], kind: SideTreatment) {
  const selected = [...new Set(ids)];
  const issues = selected.flatMap(id => {
    const opening = openings.find(o => o.id === id);
    if (!opening) return [`${id}: this opening is no longer available.`];
    const reason = kind === 'blind' ? blindUnavailable(opening, roof.blinds?.find(b => b.opening === id)?.fabric) : '';
    return reason ? [`${opening.label}: ${reason}`] : [];
  });
  if (!selected.length) issues.push('Choose at least one opening.');
  if (issues.length) return { roof, issues };
  const blinds = (roof.blinds ?? []).filter(b => !selected.includes(b.opening));
  const sidePanels = (roof.sidePanels ?? []).filter(p => !selected.includes(p.opening));
  for (const id of selected) {
    if (kind === 'blind') blinds.push(roof.blinds?.find(b => b.opening === id) ?? defaultBlind(id));
    else if (kind !== 'open') sidePanels.push(roof.sidePanels?.find(p => p.opening === id && p.kind === kind) ?? defaultSidePanel(id, kind));
  }
  return { roof: { ...roof, blinds, sidePanels }, issues };
}
