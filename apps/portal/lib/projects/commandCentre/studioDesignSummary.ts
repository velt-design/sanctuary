import { roofFinishDescription } from '@sp/configurator/geometry';
import type { StudioQuoteView } from '@sp/quote-format';
import { projectStudioAuthoringView } from '@/lib/designStudio/authoringView';
import { resolveStudioWebsiteDesign } from '@/lib/designStudio/websiteDesign';
import type { CommandCentreDesignSummary } from './types';

export function hasStudioDesign(outputs: unknown): boolean {
  return Boolean(outputs && typeof outputs === 'object' && Object.hasOwn(outputs, 'studio_authored'));
}

function compositionSummary(objects: Array<{label:string;details:string[]}>, houseCount:number): CommandCentreDesignSummary {
  return {
    size: `${objects.length ? `${objects.length} ${objects.length === 1 ? 'pergola' : 'pergolas'}` : 'Site scope'}${houseCount ? ` + ${houseCount === 1 ? 'house' : `${houseCount} houses`}` : ''}`,
    shape: objects.map(object => `${object.label}: ${object.details[0]}`).join(' · ') || 'Additional site selections',
    roofing: [...new Set(objects.map(object => object.details[1]).filter(Boolean))].join(' · ') || 'See saved design',
    additionalModuleCount: 0,
  };
}

/** Quote selection text is the immutable customer projection, never the live estimate. */
export function summarizeStudioQuoteDesign(view: StudioQuoteView): CommandCentreDesignSummary {
  const objects = view.selections.filter(section => /^(Pitched|Gable|Box perimeter) · \d+ × \d+ mm$/.test(section.details[0] ?? ''));
  return compositionSummary(objects, view.selections.some(section => section.label === 'Existing house') ? 1 : 0);
}

export function summarizeSavedStudioDesign(outputs: unknown): CommandCentreDesignSummary | null {
  if (!outputs || typeof outputs !== 'object') return null;
  const stored = outputs as Record<string,unknown>;
  const projected = projectStudioAuthoringView({authored:stored.studio_authored,spatial:stored.drawing_object_first});
  if (!projected.ok) return null;
  const view = projected.value;
  const objects = view.spatial.pergolas.map(object => {
    const option = view.objectOptions.find(row => row.objectId === object.id);
    const resolved = resolveStudioWebsiteDesign(option?.values.websiteDesign, object.id);
    if (!resolved.ok) return {label:object.label,details:['Selections need review',resolved.message]};
    const {input,roof} = resolved.value;
    return {label:object.label,details:[`${roof.family === 'mono' ? 'Pitched' : roof.family === 'gable' ? 'Gable' : 'Box perimeter'} · ${input.widthMm} × ${input.projectionMm} mm`,roofFinishDescription(roof)]};
  });
  return compositionSummary(objects, view.spatial.houseAssembly?.houseForms.length ?? 0);
}
