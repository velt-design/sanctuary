import { isUuid } from '@/lib/supabase/mappers';
import { isStudioObject, parseStudioAuthored, validateStudioAssociations, STUDIO_OUTPUT_KEY, STUDIO_SPATIAL_OUTPUT_KEY, type StudioJsonObject } from './contracts';
import { studioIdentifier } from './identifiers';
import { parseStudioSpatialDraft } from './spatialValidation';

export const STUDIO_WEBSITE_HOST_PROVENANCE_OUTPUT_KEY = 'studio_website_host_provenance' as const;
export const STUDIO_WEBSITE_HOST_PROVENANCE_SCHEMA = 'studio_website_host_provenance.v1' as const;
/** Private historical evidence only. Authored house data and a staff review are
 * not survey evidence. Never return this raw owner in a browser DTO. */
export type StudioWebsiteHostProvenance = {
  schemaVersion: typeof STUDIO_WEBSITE_HOST_PROVENANCE_SCHEMA;
  hostEstimate: StudioJsonObject;
  selection: { hostSourceEstimateId: string; sourceHouseFormId: string; sourceWallId: string };
  remap: { houseAssemblyId: string; houseFormId: string; pergolaId: string; sourceWallId: string; destinationWallId: string };
  confirmations: { sourceConnectionConfirmed: true; houseGeometryReviewed: true };
};
type Result = { ok: true; value: StudioWebsiteHostProvenance } | { ok: false; message: string };
const fail = (): Result => ({ ok: false, message: 'The saved website host provenance could not be verified.' });
const exact = (value: unknown, keys: string[]): value is StudioJsonObject => isStudioObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value;
const freshId = (value: unknown): value is string => id(value) && value === value.toLowerCase() && isUuid(value);
/** Pure frozen-source validation. No current row/rate lookup, geometry solve,
 * wall-ID grammar or survey inference. Fresh preparation must independently
 * prove actual wall membership/contact and the source→destination wall mapping. */
export function parseStudioWebsiteHostProvenance(raw: unknown, context: { projectId: string }): Result {
  try {
    if (!exact(raw, ['schemaVersion', 'hostEstimate', 'selection', 'remap', 'confirmations']) || raw.schemaVersion !== STUDIO_WEBSITE_HOST_PROVENANCE_SCHEMA
      || !exact(raw.selection, ['hostSourceEstimateId', 'sourceHouseFormId', 'sourceWallId'])
      || !exact(raw.remap, ['houseAssemblyId', 'houseFormId', 'pergolaId', 'sourceWallId', 'destinationWallId'])
      || !exact(raw.confirmations, ['sourceConnectionConfirmed', 'houseGeometryReviewed'])
      || raw.confirmations.sourceConnectionConfirmed !== true || raw.confirmations.houseGeometryReviewed !== true) return fail();
    const { selection, remap, hostEstimate: host } = raw;
    if (!Object.values(selection).every(id) || !Object.values(remap).every(id) || remap.sourceWallId !== selection.sourceWallId
      || ![remap.houseAssemblyId, remap.houseFormId, remap.pergolaId].every(freshId)
      || new Set([remap.houseAssemblyId, remap.houseFormId, remap.pergolaId]).size !== 3) return fail();
    if (!isStudioObject(host) || typeof host.id !== 'string' || typeof host.project_id !== 'string'
      || !isStudioObject(host.inputs) || !isStudioObject(host.outputs)
      || typeof host.updated_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(host.updated_at) || !Number.isFinite(Date.parse(host.updated_at))) return fail();
    const sourceId = studioIdentifier(host.id, 'est'), project = studioIdentifier(context.projectId, 'proj');
    if (sourceId.uuid !== host.id || studioIdentifier(host.project_id, 'proj').uuid !== host.project_id
      || host.project_id !== project.uuid || selection.hostSourceEstimateId !== sourceId.appId) return fail();
    const authored = parseStudioAuthored(host.outputs[STUDIO_OUTPUT_KEY]), spatial = parseStudioSpatialDraft(host.outputs[STUDIO_SPATIAL_OUTPUT_KEY]);
    if (!authored.ok || !spatial.ok || validateStudioAssociations(authored.value, spatial.value)) return fail();
    if (!spatial.value.houseAssembly?.houseForms.some(house => house.id === selection.sourceHouseFormId)) return fail();
    const originalIds = new Set([authored.value.designId, spatial.value.houseAssembly.id, ...spatial.value.houseAssembly.houseForms.map(h => h.id), ...spatial.value.pergolas.map(p => p.id), ...spatial.value.decks.map(d => d.id), ...spatial.value.openings.map(o => o.id)]);
    if ([remap.houseAssemblyId, remap.houseFormId, remap.pergolaId].some(value => originalIds.has(value as string))) return fail();
    return { ok: true, value: structuredClone(raw) as unknown as StudioWebsiteHostProvenance };
  } catch { return fail(); }
}
