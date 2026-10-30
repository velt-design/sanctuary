import { previewBlindOpenings } from '@sp/configurator/geometry';
import { resolveStudioWebsiteDesign } from './websiteDesign';
import type { websiteComposition } from './websiteComposition';

/** Classifies a retained invalid choice for navigation only; validation stays with its owner. */
export function studioProductIssue(row: ReturnType<typeof websiteComposition>[number]) {
  if (!row.error) return null;
  if (row.design) {
    try {
      const openings = previewBlindOpenings(row.design.input, row.design.roof, row.geometryOptions);
      if ((row.design.roof.blinds ?? []).some(blind => !openings.some(opening => opening.id === blind.opening)) ||
        (row.design.roof.sidePanels ?? []).some(panel => !openings.some(opening => opening.id === panel.opening))) {
        return { label: 'Check sides', section: 'Sides' as const, focus: '[aria-label="Retained unavailable blinds"], [aria-label="Retained unavailable sides"]' };
      }
    } catch { /* A failed geometry read retains the original validation message. */ }
  }
  if (row.value) {
    const resolved = resolveStudioWebsiteDesign(row.value, row.object.id);
    if (!resolved.ok) return {label: 'Check pergola', section: 'gapKey' in resolved ? (resolved.gapKey !== 'roof' ? 'Sides' as const : 'Roof' as const) : 'Shape' as const, focus: 'input[aria-invalid="true"]'};
  }
  return null;
}
