import type { ObjectFirstWorkbenchDraftVNext } from '../drawings/state/objectFirstWorkbenchModel';

export const STUDIO_AUTHORED_SCHEMA = 'studio_authored.v1' as const;
export const STUDIO_OUTPUT_KEY = 'studio_authored' as const;
export const STUDIO_SPATIAL_OUTPUT_KEY = 'drawing_object_first' as const;
export type StudioJson = null | boolean | number | string | StudioJson[] | { [key: string]: StudioJson };
export type StudioJsonObject = { [key: string]: StudioJson };

/** Lossless authored option storage, NOT a validated physical or commercial input. */
export type StudioPreservedOptions = {
  validation: 'preserved_unvalidated';
  values: StudioJsonObject;
};
export type StudioAuthoredV1 = {
  schemaVersion: typeof STUDIO_AUTHORED_SCHEMA;
  designId: string;
  revision: number;
  spatialOutputKey: typeof STUDIO_SPATIAL_OUTPUT_KEY;
  site: StudioPreservedOptions;
  /** Spatial object IDs, never array indexes or calculator module indexes. */
  objectOptions: Array<{ objectId: string; options: StudioPreservedOptions }>;
  /** Import evidence only. Runtime groups/joins derive from the canonical snap graph.
   * Never use these memberships to derive geometry, lighting eligibility or pricing. */
  legacyCommercialAssociations: Array<{ authority: 'preserved_legacy_only'; id: string; label: string; objectIds: string[]; options: StudioPreservedOptions }>;
  provenance: { sourceEstimateId: string | null; sourceKind: 'authored' | 'imported'; sourcePayload: StudioJson | null };
};

export type StudioParseResult =
  | { ok: true; value: StudioAuthoredV1 }
  | { ok: false; code: 'INVALID_STUDIO_AUTHORED' | 'UNSUPPORTED_STUDIO_SCHEMA'; message: string };

export function isStudioJson(value: unknown, depth = 0, ancestors = new Set<object>()): value is StudioJson {
  if (depth > 64) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  if (Object.getOwnPropertySymbols(value).length) return false;
  if (Array.isArray(value) && (Object.keys(value).length !== value.length || Object.keys(value).some((key, index) => key !== String(index)))) return false;
  ancestors.add(value);
  const valid = Object.entries(value).every(([key, item]) =>
    !['__proto__', 'constructor', 'prototype'].includes(key) && isStudioJson(item, depth + 1, ancestors));
  ancestors.delete(value);
  return valid;
}
export function isStudioObject(value: unknown): value is StudioJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && isStudioJson(value);
}
function exact(value: unknown, keys: string[]): value is StudioJsonObject {
  return isStudioObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
const identifier = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
function options(value: unknown): value is StudioPreservedOptions {
  return exact(value, ['validation', 'values']) && value.validation === 'preserved_unvalidated' && isStudioObject(value.values);
}

/** Unknown envelope fields/versions block editing. Opaque option/source JSON is retained exactly. */
export function parseStudioAuthored(value: unknown): StudioParseResult {
  const fail = (message: string): StudioParseResult => ({ ok: false, code: 'INVALID_STUDIO_AUTHORED', message });
  if (!isStudioObject(value)) return fail('Studio authored state must be a JSON object.');
  if (value.schemaVersion !== STUDIO_AUTHORED_SCHEMA) return { ok: false, code: 'UNSUPPORTED_STUDIO_SCHEMA', message: 'This studio version cannot be edited by this client.' };
  if (!exact(value, ['schemaVersion', 'designId', 'revision', 'spatialOutputKey', 'site', 'objectOptions', 'legacyCommercialAssociations', 'provenance'])) return fail('Unknown or missing studio fields.');
  if (!identifier(value.designId) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || value.spatialOutputKey !== STUDIO_SPATIAL_OUTPUT_KEY || !options(value.site)) return fail('Invalid studio identity, revision or options.');
  if (!Array.isArray(value.objectOptions) || !Array.isArray(value.legacyCommercialAssociations)) return fail('Studio associations must be arrays.');
  const objects = new Set<string>();
  for (const row of value.objectOptions) {
    if (!exact(row, ['objectId', 'options']) || !identifier(row.objectId) || objects.has(row.objectId) || !options(row.options)) return fail('Invalid or duplicate object options.');
    objects.add(row.objectId);
  }
  const groups = new Set<string>(), members = new Set<string>();
  for (const row of value.legacyCommercialAssociations) {
    if (!exact(row, ['authority', 'id', 'label', 'objectIds', 'options']) || row.authority !== 'preserved_legacy_only' || !identifier(row.id) || groups.has(row.id) || typeof row.label !== 'string' || !Array.isArray(row.objectIds) || !options(row.options)) return fail('Invalid preserved commercial association.');
    groups.add(row.id);
    for (const id of row.objectIds) {
      if (!identifier(id) || members.has(id)) return fail('Duplicate source commercial membership.');
      members.add(id);
    }
  }
  const source = value.provenance;
  if (!exact(source, ['sourceEstimateId', 'sourceKind', 'sourcePayload']) || (source.sourceEstimateId !== null && !identifier(source.sourceEstimateId)) || !['authored', 'imported'].includes(String(source.sourceKind))) return fail('Invalid source provenance.');
  return { ok: true, value: structuredClone(value) as unknown as StudioAuthoredV1 };
}

/** Canonical spatial shape is validated by its owner before calling this association check. */
export function validateStudioAssociations(studio: StudioAuthoredV1, spatial: ObjectFirstWorkbenchDraftVNext): string | null {
  const allIds = [...(spatial.houseAssembly?.houseForms ?? []), ...spatial.decks, ...spatial.openings, ...spatial.pergolas].map(object => object.id);
  if (allIds.some(id => !identifier(id)) || new Set(allIds).size !== allIds.length) return 'Spatial object IDs must be nonempty and unique.';
  const all = new Set(allIds);
  if (studio.objectOptions.some(row => !all.has(row.objectId))) return 'Options refer to a missing spatial object.';
  // Historical memberships remain intact when authored objects are later deleted.
  // They are provenance, not live foreign keys or current geometry relationships.
  return null;
}
