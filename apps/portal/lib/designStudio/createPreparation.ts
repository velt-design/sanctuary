import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from '../drawings/state/objectFirstWorkbenchModel';
import { isStudioObject, parseStudioAuthored, STUDIO_AUTHORED_SCHEMA, STUDIO_OUTPUT_KEY, STUDIO_SPATIAL_OUTPUT_KEY, validateStudioAssociations, type StudioAuthoredV1, type StudioJsonObject } from './contracts';
import { studioIdentifier } from './identifiers';
import { parseStudioSpatialDraft } from './spatialValidation';
import { validateCommercialInternalName } from '@/lib/commercial/internalName';

/** Trusted server preparation only. Contains private source data: NEVER serialize
 * this result to a browser. This is not an authenticated command or insert API. */
export type StudioCreationPreparation = {
  row: { project_id: string; commercial_scope_id: string | null; status: 'draft'; inputs: StudioJsonObject; outputs: StudioJsonObject; internal_name?: string | null };
  lineage: { parentEstimateId: string; parentUpdatedAt: string; parentAuthoredRevision: number } | null;
  /** Exact original row for private evidence and an atomic source-proof check. */
  sourceSnapshot: StudioJsonObject | null;
  pricing: 'unpriced';
};
type Result = { ok: true; prepared: StudioCreationPreparation } | {
  ok: false; code: 'INVALID_STUDIO_CREATION' | 'UNSUPPORTED_STUDIO_SOURCE'; message: string;
};
const invalid = (): Result => ({ ok: false, code: 'INVALID_STUDIO_CREATION', message: 'Invalid studio creation request.' });
const unsupported = (): Result => ({ ok: false, code: 'UNSUPPORTED_STUDIO_SOURCE', message: 'This source requires a supported explicit import before creating a studio revision.' });
const exact = (value: StudioJsonObject, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function uuid(value: unknown, kind: 'est' | 'proj'): string {
  if (typeof value !== 'string') throw Error();
  return studioIdentifier(value, kind).uuid;
}
function scope(value: unknown): string | null {
  if (value === null) return null;
  // Commercial scopes are UUIDs, not project/estimate application identities.
  const id = uuid(value, 'proj');
  if (value !== id) throw Error();
  return id;
}

/** Explicit blank: {mode, projectId, designId, commercialScopeId, internalName?}.
 * Clone: {mode, projectId, designId, source: trusted raw estimate row, internalName?}.
 * No defaults, calculator conversion, normalization, repricing or source writes.
 * The command owner must authorize, generate a fresh designId, compare source
 * proof under lock, allocate estimate identity/version and record exact replay. */
export function prepareStudioCreation(input: unknown): Result {
  try {
    if (!isStudioObject(input) || typeof input.designId !== 'string' || !input.designId.trim() || input.designId.length > 200) return invalid();
    const projectId = uuid(input.projectId, 'proj');
    if (input.mode === 'blank') {
      const hasName = Object.hasOwn(input, 'internalName');
      const name = validateCommercialInternalName(input.internalName);
      if (hasName && (!name.ok || name.value !== input.internalName)) return invalid();
      if (!exact(input, ['mode', 'projectId', 'designId', 'commercialScopeId', ...(hasName ? ['internalName'] : [])])) return invalid();
      const authored: StudioAuthoredV1 = {
        schemaVersion: STUDIO_AUTHORED_SCHEMA, designId: input.designId, revision: 1, spatialOutputKey: STUDIO_SPATIAL_OUTPUT_KEY,
        site: { validation: 'preserved_unvalidated', values: {} }, objectOptions: [], legacyCommercialAssociations: [],
        provenance: { sourceEstimateId: null, sourceKind: 'authored', sourcePayload: null },
      };
      return { ok: true, prepared: { row: { project_id: projectId, commercial_scope_id: scope(input.commercialScopeId), status: 'draft', inputs: {},
        ...(hasName && name.ok ? { internal_name: name.value } : {}),
        outputs: { [STUDIO_OUTPUT_KEY]: authored as unknown as StudioJsonObject, [STUDIO_SPATIAL_OUTPUT_KEY]: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT) as unknown as StudioJsonObject } },
        lineage: null, sourceSnapshot: null, pricing: 'unpriced' } };
    }
    const hasOverride = Object.hasOwn(input, 'internalName');
    const override = validateCommercialInternalName(input.internalName);
    if (hasOverride && (!override.ok || override.value !== input.internalName)) return invalid();
    if (input.mode !== 'clone' || !exact(input, ['mode', 'projectId', 'designId', 'source', ...(hasOverride ? ['internalName'] : [])])) return invalid();
    const source = input.source;
    if (!isStudioObject(source) || uuid(source.project_id, 'proj') !== projectId ||
      !['draft', 'archived'].includes(String(source.status)) || typeof source.updated_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(source.updated_at) || !Number.isFinite(Date.parse(source.updated_at)) ||
      !isStudioObject(source.inputs) || !isStudioObject(source.outputs)) return unsupported();
    const parentEstimateId = uuid(source.id, 'est'), commercialScopeId = scope(source.commercial_scope_id);
    const hasName = Object.hasOwn(source, 'internal_name');
    const name = validateCommercialInternalName(source.internal_name);
    if (hasName && (!name.ok || name.value !== source.internal_name)) return unsupported();
    const authored = parseStudioAuthored(source.outputs[STUDIO_OUTPUT_KEY]);
    const spatial = parseStudioSpatialDraft(source.outputs[STUDIO_SPATIAL_OUTPUT_KEY]);
    if (!authored.ok || !spatial.ok || validateStudioAssociations(authored.value, spatial.value)) return unsupported();
    if (authored.value.designId === input.designId) return invalid();
    const parentAuthoredRevision = authored.value.revision;
    authored.value.designId = input.designId;
    authored.value.revision = 1;
    const outputs = structuredClone(source.outputs);
    outputs[STUDIO_OUTPUT_KEY] = authored.value as unknown as StudioJsonObject;
    outputs[STUDIO_SPATIAL_OUTPUT_KEY] = spatial.value as unknown as StudioJsonObject;
    return { ok: true, prepared: { row: { project_id: projectId, commercial_scope_id: commercialScopeId, status: 'draft', inputs: structuredClone(source.inputs), outputs,
      ...(hasOverride && override.ok ? { internal_name: override.value } : hasName && name.ok ? { internal_name: name.value } : {}) },
      lineage: { parentEstimateId, parentUpdatedAt: source.updated_at, parentAuthoredRevision }, sourceSnapshot: structuredClone(source), pricing: 'unpriced' } };
  } catch { return invalid(); }
}
