import {parseWebsiteAttachments,validateWebsiteAttachments} from './studioAttachmentContract';
import {parseWebsiteJoins} from './websiteJoinIntent';
import { parseStudioWebsiteDesign, websiteSpatialMatches } from './websiteDesignContract';
import { duplicateCollections, type StudioPergolaDuplication } from './pergolaDuplication';
import type { ObjectFirstWorkbenchDraftVNext } from '../drawings/state/objectFirstWorkbenchModel';
import { isStudioObject, parseStudioAuthored, validateStudioAssociations, type StudioAuthoredV1, type StudioJson, type StudioJsonObject } from './contracts';
import { parseStudioSpatialDraft } from './spatialValidation';

export const STUDIO_AUTHORING_VIEW_SCHEMA = 'studio_authoring_view.v1' as const;
export const STUDIO_AUTHORING_EDIT_SCHEMA = 'studio_authoring_edit.v1' as const;
type Failure = { ok: false; code: 'AUTHORING_UNSUPPORTED' | 'AUTHORING_INVALID' | 'STUDIO_STALE'; message: string };
type Result<T> = { ok: true; value: T } | Failure;
export type StudioAuthoringView = {
  schemaVersion: typeof STUDIO_AUTHORING_VIEW_SCHEMA; designId: string; revision: number;
  spatial: ObjectFirstWorkbenchDraftVNext; site: StudioJsonObject;
  objectOptions: Array<{ objectId: string; values: StudioJsonObject }>; pricing: 'unpriced';
};
export type StudioAuthoringDeletion =
  | { scope: 'site'; collection: 'blinds.items' | 'additionalAluminium.rows' | 'standaloneInfills.items'; ids: string[] }
  | { scope: 'object'; objectId: string; collection: 'flashings.rows' | 'infills.items'; ids: string[] }
  | { scope: 'object-option'; objectId: string; field: 'ceilingOption' }
  | { scope: 'object-options'; objectId: string };
/** Patch semantics: omissions preserve server fields; row removal is explicit. */
export type StudioAuthoringEdit = {
  schemaVersion: typeof STUDIO_AUTHORING_EDIT_SCHEMA | 'studio_authoring_edit.v2'; duplications?: StudioPergolaDuplication[]; designId: string; revision: number;
  spatial: ObjectFirstWorkbenchDraftVNext; site: StudioJsonObject;
  objectOptions: Array<{ objectId: string; values: StudioJsonObject }>; deletions: StudioAuthoringDeletion[];
};

type Schema = { kind: 'string' } | { kind: 'boolean' } | { kind: 'enum'; values: readonly string[] }
  | { kind: 'object'; fields: Record<string, Schema> } | { kind: 'rows'; row: Schema }
  | { kind: 'strings' } | { kind: 'shape' } | { kind: 'website-design' } | {kind:'website-joins'} | {kind:'website-attachments'};
const str: Schema = { kind: 'string' }, bool: Schema = { kind: 'boolean' };
const enumeration = (...values: string[]): Schema => ({ kind: 'enum', values });
const object = (fields: Record<string, Schema>) => ({ kind: 'object' as const, fields });
const rows = (fields: Record<string, Schema>) => ({ kind: 'rows' as const, row: object(fields) });
const finish = { extrusionColour: enumeration('Black', 'White', 'Mill'), powdercoatStandardColour: str, powdercoatIsCustom: bool, powdercoatCustomColour: str };
const rectangle = { type: enumeration('rect'), widthM: str, heightM: str, bottomOffsetM: str };
const slope = { type: enumeration('mono_slope'), widthM: str, heightLowM: str, heightHighM: str, bottomOffsetM: str, slopeMode: enumeration('heights', 'pitch'), slopeDeg: str, slopeAnchor: enumeration('left', 'right') };
const infill = {
  id: str, label: str, qty: str, location: enumeration('front', 'house', 'side', 'gable_end', 'wall', 'custom'),
  acrylicSource: enumeration('strip_620', 'sheet_panels', 'auto'), panelOrientation: enumeration('vertical', 'horizontal', 'auto'),
  support: object({ edgeConfirmations: object({ top: enumeration('yes', 'no', 'unsure'), bottom: enumeration('yes', 'no', 'unsure'), left: enumeration('yes', 'no', 'unsure'), right: enumeration('yes', 'no', 'unsure') }),
    internalSupportMode: enumeration('none', 'match_roof_rafters', 'center', 'custom'), internalSupportPositionsM: { kind: 'strings' } }),
  shape: { kind: 'shape' },
} satisfies Record<string, Schema>;

/** Explicit option owner; geometry fields already in ObjectFirstWorkbenchDraftVNext are excluded. */
export const studioObjectAuthoringFields = {
  websiteDesign: { kind: 'website-design' },
  ...finish, rafterSpacingMm: str,
  ceilingOption: enumeration('thermopine-100', 'thermopine-150', 'cedar-100', 'cedar-150'),
  timberRoofAboveType: enumeration('insulated_panels', 'steel_corrugated', 'steel_tray'), timberInsulatedPanelThicknessMm: str, timberTrayWidthMm: str,
  boxGutterHouseEdge: enumeration('house', 'our', 'none'), boxGutterFarEdge: enumeration('house', 'our', 'none'),
  downpipeCount: str, downpipeJoinCount: str, downpipeElbowCount: str, separateGutterEnabled: bool,
  overhangEnabled: bool, overhangAmountM: str, overhangSupportBeamProfile: enumeration('150x50', '200x50', 'RHS 150x50x3'), invertedEnabled: bool, invertedHouseGutter: bool,
  flashings: object({ rows: rows({ id: str, kind: enumeration('primary', 'extra'), band: enumeration('0-200', '201-300', '301-400'), lengthM: str, purpose: enumeration('HEAD', 'SIDE', 'APRON', 'CUSTOM') }) }),
  infills: object({ items: rows(infill) }),
} satisfies Record<string, Schema>;
export const studioSiteAuthoringFields = {
  websiteJoins: {kind:'website-joins'},
  websiteAttachments: {kind:'website-attachments'},
  access: enumeration('easy', 'normal', 'hard'), height: enumeration('single_storey', 'two_storey'), jobType: enumeration('residential', 'commercial'),
  pricingClassification: enumeration('simple', 'bespoke'), approvalRequirement: enumeration('neither', 'engineering_required', 'full_building_consent'),
  travelExGst: str, extrasAllowanceExGst: str, quoteDiscountPct: str,
  blinds: object({ items: rows({ id: str, label: str, system: enumeration('ZIPTRAK', 'OMNI'), widthMm: str, coverLengthMm: str, fabric: enumeration('MESH', 'PVC', 'FINE_MESH', 'NONE'), motorised: enumeration('NONE', 'YES'), rollCover: enumeration('NONE', 'FLASHING', 'PELMET') }) }),
  additionalAluminium: object({ ...finish, rows: rows({ id: str, profile: str, stockLengthM: str, quantity: str }) }),
  standaloneInfills: object({ ...finish, items: rows(infill) }),
} satisfies Record<string, Schema>;

/** Explicit migration disposition, checked against the complete inventory in tests. */
export const studioCanonicalModuleFields = ['pergolaStyle', 'roofMaterial', 'boxPerimeterEnabled', 'roofPitchDeg', 'gableEndFramesMode', 'gableHouseEdgeGutter', 'gableOuterEdgeGutter', 'mixedAcrylicBaysMain', 'mixedAcrylicBaysA', 'mixedAcrylicBaysB', 'postCount', 'houseConnectionType', 'postConnectionType', 'ground', 'lengthM', 'projectionM', 'hipCornerLengthBM', 'hipCornerProjectionBM', 'postCutHeightM', 'overrides'] as const;
export const studioAuthoringDependencies = [
  'Open/no-covering roof has no canonical workbench material variant; do not convert it to acrylic.',
  'Group lighting needs a snap-derived group association owner; legacy manual commercial associations are provenance only.',
  'Supplemental product options are editable but remain unvalidated and unpriced until their geometry/commercial adapters exist.',
] as const;

const failure = (message: string, code: Failure['code'] = 'AUTHORING_INVALID'): Failure => ({ ok: false, code, message });
const stableId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value;
function exact(value: unknown, keys: string[]): value is StudioJsonObject {
  return isStudioObject(value) && keys.length === Object.keys(value).length && keys.every(key => Object.hasOwn(value, key));
}
function schemaForShape(value: unknown): Schema | null {
  if (!isStudioObject(value)) return null;
  return value.type === 'rect' ? object(rectangle) : value.type === 'mono_slope' ? object(slope) : null;
}
/** Projection ignores private unknown fields; submitted edits instead reject them recursively. */
function project(schema: Schema, source: unknown, strict: boolean, path: string): Result<StudioJson> {
  if(schema.kind==='website-attachments'){try{return {ok:true,value:parseWebsiteAttachments(source) as unknown as StudioJson};}catch(error){return failure(error instanceof Error?error.message:'Invalid connections.');}}
  if(schema.kind==='website-joins'){try{return {ok:true,value:parseWebsiteJoins(source) as unknown as StudioJson};}catch(error){return failure(error instanceof Error?error.message:'Invalid joins.');}}
  if (schema.kind === 'website-design') {
    const parsed = parseStudioWebsiteDesign(source);
    return parsed.ok ? { ok: true, value: parsed.value as unknown as StudioJson } : failure(parsed.message, strict ? 'AUTHORING_INVALID' : 'AUTHORING_UNSUPPORTED');
  }
  if (schema.kind === 'string' || schema.kind === 'boolean' || schema.kind === 'enum') {
    const valid = schema.kind === 'enum' ? typeof source === 'string' && schema.values.includes(source) : typeof source === schema.kind;
    return valid ? { ok: true, value: source as StudioJson } : failure(`Unsupported value at ${path}.`, strict ? 'AUTHORING_INVALID' : 'AUTHORING_UNSUPPORTED');
  }
  if (schema.kind === 'strings') return Array.isArray(source) && source.every(value => typeof value === 'string') ? { ok: true, value: structuredClone(source) } : failure(`Unsupported values at ${path}.`);
  if (schema.kind === 'shape') {
    const selected = schemaForShape(source);
    return selected ? project(selected, source, strict, path) : failure(`Unsupported infill shape at ${path}.`);
  }
  if (schema.kind === 'rows') {
    if (!Array.isArray(source)) return failure(`Expected rows at ${path}.`);
    const result: StudioJson[] = [], ids = new Set<string>();
    for (const row of source) {
      if (!isStudioObject(row) || !stableId(row.id) || ids.has(row.id)) return failure(`Invalid row identity at ${path}.`);
      ids.add(row.id);
      const parsed = project(schema.row, row, strict, path); if (!parsed.ok) return parsed;
      result.push(parsed.value);
    }
    return { ok: true, value: result };
  }
  if (!isStudioObject(source)) return failure(`Expected options at ${path}.`);
  if (strict && Object.keys(source).some(key => !Object.hasOwn(schema.fields, key))) return failure(`Unknown submitted option at ${path}.`);
  const result: StudioJsonObject = {};
  for (const [key, child] of Object.entries(schema.fields)) {
    if (!Object.hasOwn(source, key)) continue;
    const parsed = project(child, source[key], strict, `${path}.${key}`); if (!parsed.ok) return parsed;
    result[key] = parsed.value;
  }
  return { ok: true, value: result };
}

export function projectStudioAuthoringView(args: { authored: unknown; spatial: unknown }): Result<StudioAuthoringView> {
  const authored = parseStudioAuthored(args.authored), spatial = parseStudioSpatialDraft(args.spatial);
  if (!authored.ok || !spatial.ok) return failure('The saved design cannot be edited by this client.', 'AUTHORING_UNSUPPORTED');
  if (validateStudioAssociations(authored.value, spatial.value)) return failure('The saved design has unresolved object options.', 'AUTHORING_UNSUPPORTED');
  const site = project(object(studioSiteAuthoringFields), authored.value.site.values, false, 'site'); if (!site.ok) return site;
  const objectOptions: StudioAuthoringView['objectOptions'] = [];
  for (const row of authored.value.objectOptions) {
    const selected = project(object(studioObjectAuthoringFields), row.options.values, false, 'objectOptions'); if (!selected.ok) return selected;
    if (Object.keys(selected.value as StudioJsonObject).length && !spatial.value.pergolas.some(item => item.id === row.objectId)) return failure('Pergola options are associated with a different object family.', 'AUTHORING_UNSUPPORTED');
    const website = (selected.value as StudioJsonObject).websiteDesign;
    if (website !== undefined) {
      const parsedWebsite = parseStudioWebsiteDesign(website, row.objectId), object = spatial.value.pergolas.find(p => p.id === row.objectId);
      if (!parsedWebsite.ok || !object || !websiteSpatialMatches(parsedWebsite.value, object)) return failure('Website choices do not match their spatial object.', 'AUTHORING_UNSUPPORTED');
    }
    objectOptions.push({ objectId: row.objectId, values: selected.value as StudioJsonObject });
  }
  if((site.value as StudioJsonObject).websiteJoins!==undefined){try{parseWebsiteJoins((site.value as StudioJsonObject).websiteJoins,new Set(objectOptions.filter(r=>r.values.websiteDesign!==undefined).map(r=>r.objectId)));}catch(error){return failure(error instanceof Error?error.message:'Invalid joins.','AUTHORING_UNSUPPORTED');}}
  return { ok: true, value: { schemaVersion: STUDIO_AUTHORING_VIEW_SCHEMA, designId: authored.value.designId, revision: authored.value.revision, spatial: spatial.value,
    site: site.value as StudioJsonObject, objectOptions, pricing: 'unpriced' } };
}

export function createStudioAuthoringEdit(view: StudioAuthoringView): StudioAuthoringEdit {
  return { schemaVersion: STUDIO_AUTHORING_EDIT_SCHEMA, designId: view.designId, revision: view.revision, spatial: structuredClone(view.spatial), site: structuredClone(view.site), objectOptions: structuredClone(view.objectOptions), deletions: [] };
}

/** Safe immutable option rows can outlive the geometry revision they describe.
 * Association with a historical snapshot is checked against its own IDs, never
 * against the current editable geometry. Current commands still check coherence. */
export function parseStudioObjectOptions(input: unknown): Result<StudioAuthoringEdit['objectOptions']> {
  if (!Array.isArray(input)) return failure('Invalid object options.');
  const ids = new Set<string>();
  for (const row of input) {
    if (!exact(row, ['objectId', 'values']) || !stableId(row.objectId) || ids.has(row.objectId)) return failure('Invalid object option identity.');
    ids.add(row.objectId);
    const selected = project(object(studioObjectAuthoringFields), row.values, true, 'objectOptions');
    if (!selected.ok) return selected;
    const website = (selected.value as StudioJsonObject).websiteDesign;
    if (website !== undefined && !parseStudioWebsiteDesign(website, row.objectId).ok) return failure('Website choices do not match their object identity.');
  }
  return { ok: true, value: structuredClone(input) as StudioAuthoringEdit['objectOptions'] };
}

export function parseStudioAuthoringEdit(input: unknown): Result<StudioAuthoringEdit> {
  if (!exact(input, ['schemaVersion', 'designId', 'revision', 'spatial', 'site', 'objectOptions', 'deletions', ...(isStudioObject(input) && input.schemaVersion === 'studio_authoring_edit.v2' ? ['duplications'] : [])]) || ![STUDIO_AUTHORING_EDIT_SCHEMA, 'studio_authoring_edit.v2'].includes(String(input.schemaVersion)) || !stableId(input.designId)
    || !Number.isSafeInteger(input.revision) || Number(input.revision) < 1 || !Array.isArray(input.objectOptions) || !Array.isArray(input.deletions)) return failure('Invalid authoring command.');
  const spatial = parseStudioSpatialDraft(input.spatial); if (!spatial.ok) return failure('Invalid canonical spatial draft.');
  const site = project(object(studioSiteAuthoringFields), input.site, true, 'site'); if (!site.ok) return site;
  const options = parseStudioObjectOptions(input.objectOptions); if (!options.ok) return options;
  const objectIds = new Set(options.value.map(row => row.objectId));
  for (const row of options.value) {
    const website = row.values.websiteDesign;
    if (website !== undefined) {
      const parsedWebsite = parseStudioWebsiteDesign(website, row.objectId), object = spatial.value.pergolas.find(p => p.id === row.objectId);
      if (!parsedWebsite.ok || !object || !websiteSpatialMatches(parsedWebsite.value, object)) return failure('Website choices do not match their spatial object.');
    }
  }
  if((site.value as StudioJsonObject).websiteJoins!==undefined){try{parseWebsiteJoins((site.value as StudioJsonObject).websiteJoins,new Set(options.value.filter(r=>r.values.websiteDesign!==undefined).map(r=>r.objectId)));}catch(error){return failure(error instanceof Error?error.message:'Invalid joins.');}}
  const deletes = new Set<string>();
  for (const row of input.deletions) {
    if (!isStudioObject(row)) return failure('Invalid deletion command.');
    if (row.scope === 'object-option') {
      if (!exact(row, ['scope', 'objectId', 'field']) || !stableId(row.objectId) || row.field !== 'ceilingOption') return failure('Invalid option reset.');
    } else if (row.scope === 'object-options') {
      if (!exact(row, ['scope', 'objectId']) || !stableId(row.objectId) || objectIds.has(row.objectId)) return failure('Conflicting object deletion.');
    } else {
      const siteScope = row.scope === 'site', objectScope = row.scope === 'object';
      if ((!siteScope && !objectScope) || !exact(row, siteScope ? ['scope', 'collection', 'ids'] : ['scope', 'objectId', 'collection', 'ids']) || (objectScope && !stableId(row.objectId))) return failure('Invalid collection deletion.');
      const permitted = siteScope ? ['blinds.items', 'additionalAluminium.rows', 'standaloneInfills.items'] : ['flashings.rows', 'infills.items'];
      if (typeof row.collection !== 'string' || !permitted.includes(row.collection) || !Array.isArray(row.ids) || !row.ids.every(stableId) || new Set(row.ids).size !== row.ids.length) return failure('Invalid deleted row identities.');
    }
    const key = `${row.scope}:${row.objectId ?? ''}:${row.collection ?? row.field ?? ''}`;
    if (deletes.has(key)) return failure('Duplicate deletion command.'); deletes.add(key);
  }
  if (input.schemaVersion === 'studio_authoring_edit.v2') {
    if (!Array.isArray(input.duplications)) return failure('Missing duplicate operations.');
    const targets = new Set<string>();
    for (const op of input.duplications) {
      if (!exact(op, ['targetId', 'sourceId', 'values', 'rowOrigins']) || !stableId(op.targetId) || targets.has(op.targetId)
        || (op.sourceId !== null && !stableId(op.sourceId)) || op.sourceId === op.targetId
        || !spatial.value.pergolas.some(p => p.id === op.targetId) || !objectIds.has(op.targetId)
        || !exact(op.rowOrigins, ['flashings', 'infills'])) return failure('Invalid duplicate identity.');
      targets.add(op.targetId);
      const safe = project(object(studioObjectAuthoringFields), op.values, true, 'duplication');
      if (!safe.ok) return safe;
      for (const [section, collection] of duplicateCollections) {
        const origins = op.rowOrigins[section];
        if (!isStudioObject(origins)) return failure('Invalid duplicate row map.');
        const values = safe.value as StudioJsonObject, container = values[section];
        const rows = isStudioObject(container) && Array.isArray(container[collection]) ? container[collection] as StudioJsonObject[] : [];
        if (Object.keys(origins).length !== rows.length || rows.some(row => !Object.hasOwn(origins, String(row.id)))) return failure('Incomplete duplicate row map.');
        const ids = new Set<string>();
        for (const [target, source] of Object.entries(origins)) {
          if (!stableId(target) || (source !== null && (!stableId(source) || ids.has(source))) || (op.sourceId === null && source !== null)) return failure('Invalid duplicate row origin.');
          if (typeof source === 'string') ids.add(source);
        }
      }
    }
    if (input.duplications.some(op => isStudioObject(op) && targets.has(String(op.sourceId)))) return failure('Duplicate lineage must reference the saved baseline.');
  }
  try {if(isStudioObject(site.value) && Object.hasOwn(site.value,'websiteAttachments')) validateWebsiteAttachments(site.value as StudioJsonObject,spatial.value);} catch(e){return failure((e as Error).message);}
  return { ok: true, value: structuredClone(input) as unknown as StudioAuthoringEdit };
}

function merge(schema: Schema, current: StudioJson | undefined, patch: StudioJson): StudioJson {
  if (schema.kind === 'shape') {
    const selected = schemaForShape(patch)!;
    const original = isStudioObject(current) ? structuredClone(current) : {};
    // Changing the explicit shape removes only inactive known variant fields.
    if (isStudioObject(patch) && original.type !== patch.type && selected.kind === 'object') {
      for (const key of [...Object.keys(rectangle), ...Object.keys(slope)]) if (!Object.hasOwn(selected.fields, key)) delete original[key];
    }
    return merge(selected, original, patch);
  }
  if (schema.kind === 'rows') {
    const existing = Array.isArray(current) ? current as StudioJsonObject[] : [], next = patch as StudioJsonObject[];
    const existingIds = new Set(existing.map(row => row.id)), patches = new Map(next.map(row => [row.id, row]));
    return [...existing.map(row => patches.has(row.id) ? merge(schema.row, row, patches.get(row.id)!) : structuredClone(row)),
      ...next.filter(row => !existingIds.has(row.id)).map(row => merge(schema.row, undefined, row))];
  }
  if (schema.kind !== 'object') return structuredClone(patch);
  const result = isStudioObject(current) ? structuredClone(current) : {};
  for (const [key, value] of Object.entries(patch as StudioJsonObject)) result[key] = merge(schema.fields[key], result[key], value);
  return result;
}

/** Captured clone selections are a full safe snapshot, not a patch of later source edits. */
function replaceKnown(schema: Schema, current: StudioJson | undefined, snapshot: StudioJson): StudioJson {
  if (schema.kind === 'object') {
    const result = isStudioObject(current) ? structuredClone(current) : {};
    for (const [key, child] of Object.entries(schema.fields)) {
      if (isStudioObject(snapshot) && Object.hasOwn(snapshot, key)) result[key] = replaceKnown(child, result[key], snapshot[key]);
      else delete result[key];
    }
    return result;
  }
  if (schema.kind === 'rows') {
    const existing = Array.isArray(current) ? current as StudioJsonObject[] : [];
    return (snapshot as StudioJsonObject[]).map(row => replaceKnown(schema.row, existing.find(item => item.id === row.id), row));
  }
  if (schema.kind === 'shape') return replaceKnown(schemaForShape(snapshot)!, current, snapshot);
  return structuredClone(snapshot);
}

/** Server-only usage: full result contains private provenance and MUST NOT be serialized to the browser.
 * Root command owns lock/CAS and receipt identity based on the ORIGINAL client edit, not this merge. */
export function mergeStudioAuthoringEdit(args: { storedAuthored: unknown; storedSpatial: unknown; edit: unknown }): Result<{ authored: StudioAuthoredV1; spatial: ObjectFirstWorkbenchDraftVNext; pricing: 'unpriced' }> {
  const currentView = projectStudioAuthoringView({ authored: args.storedAuthored, spatial: args.storedSpatial }); if (!currentView.ok) return currentView;
  const parsed = parseStudioAuthoringEdit(args.edit); if (!parsed.ok) return parsed;
  const edit = parsed.value;
  if (edit.designId !== currentView.value.designId || edit.revision !== currentView.value.revision) return failure('The saved revision changed. Reload before saving.', 'STUDIO_STALE');
  const current = parseStudioAuthored(args.storedAuthored); if (!current.ok) return failure('Unsupported saved authoring state.', 'AUTHORING_UNSUPPORTED');
  const authored = current.value;
  authored.site.values = merge(object(studioSiteAuthoringFields), authored.site.values, edit.site) as StudioJsonObject;
  // Clone only private state from this revision-locked estimate; never trust browser private values.
  const baseline = structuredClone(authored.objectOptions);
  for (const op of edit.duplications ?? []) {
    if (currentView.value.spatial.pergolas.some(p => p.id === op.targetId)) return failure('Duplicate target already exists.');
    if (op.sourceId !== null && !currentView.value.spatial.pergolas.some(p => p.id === op.sourceId)) return failure('Duplicate source is not in the saved design.');
    const source = baseline.find(row => row.objectId === op.sourceId)?.options.values ?? {};
    const privateCopy = structuredClone(source);
    for (const [section, collection] of duplicateCollections) {
      const container = privateCopy[section], original = isStudioObject(container) && Array.isArray(container[collection]) ? container[collection] as StudioJsonObject[] : [];
      if (Object.values(op.rowOrigins[section]).some(origin => origin !== null && !original.some(item => item.id === origin))) return failure('A copied source row is no longer available.');
      if (isStudioObject(container)) container[collection] = Object.entries(op.rowOrigins[section]).flatMap(([target, origin]) => {
        const row = original.find(item => item.id === origin);
        return row ? [{ ...structuredClone(row), id: target }] : [];
      });
    }
    const values = replaceKnown(object(studioObjectAuthoringFields), privateCopy, op.values) as StudioJsonObject;
    authored.objectOptions.push({ objectId: op.targetId, options: { validation: 'preserved_unvalidated', values } });
  }
  for (const row of edit.objectOptions) {
    if (Object.keys(row.values).length && !edit.spatial.pergolas.some(item => item.id === row.objectId)) return failure('Editable options require a current spatial pergola.');
    const existing = authored.objectOptions.find(item => item.objectId === row.objectId);
    if (existing) existing.options.values = merge(object(studioObjectAuthoringFields), existing.options.values, row.values) as StudioJsonObject;
    else authored.objectOptions.push({ objectId: row.objectId, options: { validation: 'preserved_unvalidated', values: structuredClone(row.values) } });
  }
  for (const deletion of edit.deletions) {
    if (deletion.scope === 'object-option') {
      const row = authored.objectOptions.find(item => item.objectId === deletion.objectId);
      if (!edit.spatial.pergolas.some(item => item.id === deletion.objectId) || edit.objectOptions.some(item => item.objectId === deletion.objectId && Object.hasOwn(item.values, deletion.field))) return failure('Missing target or conflicting option reset.');
      // Selecting then resetting an optional field before saving is already
      // fulfilled when absent. Revision CAS still protects the saved source.
      if (row) delete row.options.values[deletion.field]; continue;
    }
    if (deletion.scope === 'object-options') {
      authored.objectOptions = authored.objectOptions.filter(row => row.objectId !== deletion.objectId); continue;
    }
    const container = deletion.scope === 'site' ? authored.site.values : authored.objectOptions.find(row => row.objectId === deletion.objectId)?.options.values;
    if (deletion.scope === 'object' && !edit.spatial.pergolas.some(row => row.id === deletion.objectId)) return failure('The deleted row target does not exist.');
    const [section, collection] = deletion.collection.split('.');
    const rowsOwner = container && isStudioObject(container[section]) ? container[section] as StudioJsonObject : null;
    const entries = rowsOwner?.[collection];
    const patchContainer = deletion.scope === 'site' ? edit.site : edit.objectOptions.find(row => row.objectId === deletion.objectId)?.values;
    const patchRows = patchContainer && isStudioObject(patchContainer[section]) ? (patchContainer[section] as StudioJsonObject)[collection] : undefined;
    if (Array.isArray(patchRows) && patchRows.some(row => isStudioObject(row) && deletion.ids.includes(String(row.id)))) return failure('A row cannot be edited and deleted in the same command.');
    // An item may be added and removed locally before any save (including after
    // reload). Explicit removal of an already absent row is fulfilled; never
    // invent a browser-side inventory of which IDs reached the server.
    if (entries === undefined) continue;
    if (!Array.isArray(entries)) return failure('The saved row collection is unsupported.');
    rowsOwner![collection] = entries.filter(row => !isStudioObject(row) || !deletion.ids.includes(String(row.id)));
  }
  if (validateStudioAssociations(authored, edit.spatial)) return failure('Current object options must reference current spatial objects.');
  return { ok: true, value: { authored, spatial: edit.spatial, pricing: 'unpriced' } };
}
