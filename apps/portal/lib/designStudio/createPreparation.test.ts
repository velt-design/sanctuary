import { describe, expect, it } from 'vitest';
import { prepareStudioCreation } from './createPreparation';
import { STUDIO_OUTPUT_KEY, STUDIO_SPATIAL_OUTPUT_KEY, type StudioAuthoredV1 } from './contracts';
import { projectStudioAuthoringView } from './authoringView';

const projectId = '10000000-0000-4000-8000-000000000001';
const estimateId = '20000000-0000-4000-8000-000000000001';
const addOn = '30000000-0000-4000-8000-000000000001';
const blank = () => ({ mode: 'blank', projectId: `proj_${projectId}`, designId: 'fresh-design', commercialScopeId: null });
function source() {
  const prepared = prepareStudioCreation(blank());
  if (!prepared.ok) throw Error();
  const row = { ...prepared.prepared.row, id: estimateId, status: 'archived', updated_at: '2026-09-24T00:00:00Z',
    commercial_scope_id: addOn, privateUnknown: { originalCost: 47 }, total_true_cost_ex_gst: 47 };
  const authored = row.outputs[STUDIO_OUTPUT_KEY] as unknown as StudioAuthoredV1;
  authored.designId = 'source-design'; authored.revision = 8;
  authored.provenance = { sourceEstimateId: 'est_original', sourceKind: 'imported', sourcePayload: { exactOriginal: [1, false, ''], privateFinancials: { cost: 47 } } };
  authored.site.values = { access: 'hard', unknownPrivate: { cost: 47 } };
  authored.legacyCommercialAssociations = [{ authority: 'preserved_legacy_only', id: 'historic', label: 'Historic group', objectIds: ['deleted-object'], options: { validation: 'preserved_unvalidated', values: { lighting: { count: '3' } } } }];
  row.inputs = { unknownSourceInputs: ['keep'] };
  row.outputs.snapshot = { frozenPrice: { amount: 4711 } };
  row.outputs.unknownPrivateOutput = { keep: true };
  return row;
}

describe('trusted studio creation preparation', () => {
  it('preserves detached sibling host evidence when creating a new revision and excludes it from the safe view', () => {
    const original=source();
    const evidence={schemaVersion:'retention_probe.v1',hostEstimate:{privateCost:731,sourceGeometry:['8000','5000']}};
    original.outputs.studio_website_host_provenance=evidence;
    const before=structuredClone(original);
    const result=prepareStudioCreation({mode:'clone',projectId,designId:'next-design',source:original});
    if(!result.ok) throw Error(result.message);
    expect(result.prepared.row.outputs.studio_website_host_provenance).toEqual(evidence);
    expect(result.prepared.sourceSnapshot).toEqual(before);
    const view=projectStudioAuthoringView({authored:result.prepared.row.outputs[STUDIO_OUTPUT_KEY],spatial:result.prepared.row.outputs[STUDIO_SPATIAL_OUTPUT_KEY]});
    expect(view.ok).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/hostEstimate|privateCost|retention_probe/);
    (result.prepared.row.outputs.studio_website_host_provenance as Record<string,unknown>).hostEstimate=null;
    expect(original).toEqual(before);
  });
  it.each([null, 'Copy of Courtyard', 'x'.repeat(120)])('overrides only clone name with %j while retaining source proof and lineage', internalName => {
    const original = { ...source(), internal_name: 'Original courtyard' }, before = structuredClone(original);
    const input = { mode: 'clone', projectId, designId: 'new-design', source: original };
    const baseline = prepareStudioCreation(input), result = prepareStudioCreation({ ...input, internalName });
    if (!baseline.ok || !result.ok) throw Error();
    expect(result.prepared).toEqual({ ...baseline.prepared, row: { ...baseline.prepared.row, internal_name: internalName } });
    expect(result.prepared.sourceSnapshot).toEqual(before);
    expect(original).toEqual(before);
  });
  it('can explicitly name or clear a clone of an old source without a name field', () => {
    const input = { mode: 'clone', projectId, designId: 'new-design', source: source() };
    const old = prepareStudioCreation(input);
    if (!old.ok) throw Error();
    expect(Object.keys(old.prepared.row)).toHaveLength(5);
    for (const internalName of [null, 'New option']) {
      const result = prepareStudioCreation({ ...input, internalName });
      if (!result.ok) throw Error();
      expect(result.prepared.row).toEqual({ ...old.prepared.row, internal_name: internalName });
    }
    expect(prepareStudioCreation({ ...input, name: 'Unknown key' })).toMatchObject({ ok: false, code: 'INVALID_STUDIO_CREATION' });
  });
  it.each([undefined, '', ' ', ' Copy', 'Two  spaces', 'Two\nlines', 'x'.repeat(121), 42, false, {}, []])('rejects malformed clone override %j', internalName => {
    expect(prepareStudioCreation({ mode: 'clone', projectId, designId: 'new-design', source: source(), internalName })).toMatchObject({ ok: false, code: 'INVALID_STUDIO_CREATION' });
  });
  it.each([null, 'Courtyard option', 'x'.repeat(120)])('retains explicit blank name %j without changing the old unnamed shape', internalName => {
    const result = prepareStudioCreation({ ...blank(), internalName });
    if (!result.ok) throw Error();
    expect(result.prepared.row.internal_name).toBe(internalName);
    expect(Object.keys(result.prepared.row)).toHaveLength(6);
  });
  it.each([undefined, '', ' ', ' Courtyard', 'Two  spaces', 'Two\nlines', 'x'.repeat(121), 42, false, {}, []])('rejects noncanonical blank and source name %j', internalName => {
    expect(prepareStudioCreation({ ...blank(), internalName })).toMatchObject({ ok: false, code: 'INVALID_STUDIO_CREATION' });
    expect(prepareStudioCreation({ mode: 'clone', projectId, designId: 'new-design', source: { ...source(), internal_name: internalName } })).toMatchObject({ ok: false,
      code: internalName === undefined ? 'INVALID_STUDIO_CREATION' : 'UNSUPPORTED_STUDIO_SOURCE' });
  });
  it.each([null, 'Courtyard option', 'x'.repeat(120)])('preserves canonical clone name %j and exact source evidence', internal_name => {
    const original = { ...source(), internal_name }, before = structuredClone(original);
    const result = prepareStudioCreation({ mode: 'clone', projectId, designId: 'new-design', source: original });
    if (!result.ok) throw Error();
    expect(result.prepared.row.internal_name).toBe(internal_name);
    expect(result.prepared.sourceSnapshot).toEqual(before);
    expect(original).toEqual(before);
    expect(result.prepared.pricing).toBe('unpriced');
  });
  it('creates an explicit empty unpriced base without physical defaults or financial zeroes', () => {
    const result = prepareStudioCreation(blank()); expect(result.ok).toBe(true);
    if (!result.ok) throw Error();
    expect(result.prepared).toMatchObject({ pricing: 'unpriced', lineage: null, sourceSnapshot: null,
      row: { project_id: projectId, commercial_scope_id: null, status: 'draft', inputs: {}, outputs: {
        [STUDIO_SPATIAL_OUTPUT_KEY]: { houseAssembly: null, decks: [], openings: [], pergolas: [] },
        [STUDIO_OUTPUT_KEY]: { revision: 1, site: { values: {} }, objectOptions: [], provenance: { sourceKind: 'authored', sourceEstimateId: null, sourcePayload: null } },
      } } });
    expect(Object.keys(result.prepared.row).sort()).toEqual(['commercial_scope_id', 'inputs', 'outputs', 'project_id', 'status']);
    expect(Object.keys(result.prepared.row.outputs).sort()).toEqual([STUDIO_SPATIAL_OUTPUT_KEY, STUDIO_OUTPUT_KEY].sort());
  });
  it('retains explicit add-on scope and allocates separate empty drafts without shared references', () => {
    const a = prepareStudioCreation({ ...blank(), commercialScopeId: addOn }), b = prepareStudioCreation(blank());
    if (!a.ok || !b.ok) throw Error();
    expect(a.prepared.row.commercial_scope_id).toBe(addOn);
    (a.prepared.row.outputs[STUDIO_SPATIAL_OUTPUT_KEY] as Record<string, unknown>).decks = ['mutation'];
    expect(b.prepared.row.outputs[STUDIO_SPATIAL_OUTPUT_KEY]).toMatchObject({ decks: [] });
  });
  it('copies even archived source without mutation and keeps original provenance separate from parent lineage', () => {
    const original = source(), before = structuredClone(original);
    const result = prepareStudioCreation({ mode: 'clone', projectId, designId: 'new-design', source: original });
    if (!result.ok) throw Error();
    expect(result.prepared.lineage).toEqual({ parentEstimateId: estimateId, parentUpdatedAt: original.updated_at, parentAuthoredRevision: 8 });
    expect(result.prepared.row).toMatchObject({ status: 'draft', commercial_scope_id: addOn, inputs: original.inputs });
    expect(result.prepared.row).not.toHaveProperty('internal_name');
    const authored = result.prepared.row.outputs[STUDIO_OUTPUT_KEY] as unknown as StudioAuthoredV1;
    expect(authored).toEqual({ ...(original.outputs[STUDIO_OUTPUT_KEY] as object), designId: 'new-design', revision: 1 });
    expect(result.prepared.sourceSnapshot).toEqual(original);
    expect(result.prepared.row.outputs.snapshot).toEqual(original.outputs.snapshot);
    expect(result.prepared.row.outputs.unknownPrivateOutput).toEqual(original.outputs.unknownPrivateOutput);
    authored.site.values.unknownPrivate = 'changed';
    result.prepared.sourceSnapshot!.privateUnknown = 'changed';
    expect(original).toEqual(before);
    expect(result.prepared.row).not.toHaveProperty('total_true_cost_ex_gst');
  });
  it('projects only safe authoring data while preparation preserves private nested data', () => {
    const result = prepareStudioCreation({ mode: 'clone', projectId, designId: 'new-design', source: source() });
    if (!result.ok) throw Error();
    const view = projectStudioAuthoringView({ authored: result.prepared.row.outputs[STUDIO_OUTPUT_KEY], spatial: result.prepared.row.outputs[STUDIO_SPATIAL_OUTPUT_KEY] });
    expect(view.ok).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/privateFinancials|unknownPrivate|exactOriginal|originalCost/);
  });
  it('retains canonical object identities, raw dimension strings and all associated options', () => {
    const row = source();
    row.outputs[STUDIO_SPATIAL_OUTPUT_KEY] = { houseAssembly: null, decks: [], openings: [], pergolas: [{
      id: 'pergola-stable', label: 'Pergola', family: 'mono', attachmentEdgeId: null, attachmentZoneId: null, side: 'rear', strategy: null,
      geometry: { dimensions: { lengthM: '06.250', projectionM: 'not yet measured' } },
    }] };
    (row.outputs[STUDIO_OUTPUT_KEY] as unknown as StudioAuthoredV1).objectOptions = [{ objectId: 'pergola-stable', options: { validation: 'preserved_unvalidated', values: { finish: 'custom', privateUnknown: [false, 0, ''] } } }];
    const result = prepareStudioCreation({ mode: 'clone', projectId, designId: 'new-design', source: row });
    if (!result.ok) throw Error();
    expect(result.prepared.row.outputs[STUDIO_SPATIAL_OUTPUT_KEY]).toEqual(row.outputs[STUDIO_SPATIAL_OUTPUT_KEY]);
    expect((result.prepared.row.outputs[STUDIO_OUTPUT_KEY] as unknown as StudioAuthoredV1).objectOptions).toEqual((row.outputs[STUDIO_OUTPUT_KEY] as unknown as StudioAuthoredV1).objectOptions);
    expect(result.prepared.pricing).toBe('unpriced');
  });
  it.each(['missing-companion', 'future', 'unknown-envelope', 'malformed-spatial', 'future-spatial', 'missing-object', 'nonobject-inputs', 'nonobject-outputs'])('fails closed for unsupported source %s and preserves original', fault => {
    const row = source();
    const authored = row.outputs[STUDIO_OUTPUT_KEY] as unknown as StudioAuthoredV1;
    if (fault === 'missing-companion') delete row.outputs[STUDIO_OUTPUT_KEY];
    if (fault === 'future') Object.assign(authored, { schemaVersion: 'future' });
    if (fault === 'unknown-envelope') Object.assign(authored, { futurePrivate: true });
    if (fault === 'malformed-spatial') row.outputs[STUDIO_SPATIAL_OUTPUT_KEY] = [];
    if (fault === 'future-spatial') Object.assign(row.outputs[STUDIO_SPATIAL_OUTPUT_KEY] as object, { future: true });
    if (fault === 'missing-object') authored.objectOptions.push({ objectId: 'missing', options: { validation: 'preserved_unvalidated', values: {} } });
    if (fault === 'nonobject-inputs') Object.assign(row, { inputs: [] });
    if (fault === 'nonobject-outputs') Object.assign(row, { outputs: null });
    const before = structuredClone(row);
    expect(prepareStudioCreation({ mode: 'clone', projectId, designId: 'new-design', source: row })).toMatchObject({ ok: false });
    expect(row).toEqual(before);
  });
  it.each(['source-design', ' ', 'x'.repeat(201)])('requires a fresh usable design identity %s', designId => {
    expect(prepareStudioCreation({ mode: 'clone', projectId, designId, source: source() }).ok).toBe(false);
  });
  it('rejects missing scope, foreign project, malformed source timestamp and extra client properties', () => {
    const row = source();
    expect(prepareStudioCreation({ ...blank(), commercialScopeId: undefined }).ok).toBe(false);
    expect(prepareStudioCreation({ ...blank(), commercialScopeId: `proj_${addOn}` }).ok).toBe(false);
    expect(prepareStudioCreation({ ...blank(), privatePayload: {} }).ok).toBe(false);
    expect(prepareStudioCreation({ mode: 'clone', projectId: addOn, designId: 'new', source: row }).ok).toBe(false);
    row.updated_at = 'yesterday';
    expect(prepareStudioCreation({ mode: 'clone', projectId, designId: 'new', source: row }).ok).toBe(false);
    expect(prepareStudioCreation({ ...blank(), mode: 'import' }).ok).toBe(false);
  });
});
