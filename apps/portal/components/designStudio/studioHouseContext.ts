import type {StudioSaveScope} from '@/lib/designStudio/saveTransport';

export type StudioHouseContext = {
  selected: string;
  mode: 'options' | 'position';
  section: 'Shape' | 'Roof' | 'Sides' | 'Lighting';
  view: 'Plan' | '3D';
};
export const studioHouseContextKey = (scope: StudioSaveScope) =>
  `studio-house-context:v1:${[scope.actorId, scope.projectId, scope.estimateId, scope.designId].map(encodeURIComponent).join(':')}`;

export const studioContextLabel = ({mode, section}: {mode: string; section: string}) =>
  mode === 'position' ? 'Position' : mode === 'attachment' ? 'Change connection' : mode === 'join' ? 'Pergola joins' : section;

/** Navigation only: no product data, pending connection preview, or price authority. */
export function readStudioHouseContext(raw: string | null, ids: string[]): StudioHouseContext | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || typeof value.selected !== 'string' || !ids.includes(value.selected)
      || !['options', 'position'].includes(value.mode)
      || !['Shape', 'Roof', 'Sides', 'Lighting'].includes(value.section)
      || !['Plan', '3D'].includes(value.view)) return null;
    return {selected: value.selected, mode: value.mode, section: value.section, view: value.view};
  } catch { return null; }
}
