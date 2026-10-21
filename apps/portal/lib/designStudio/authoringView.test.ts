import {newStudioWebsiteDesign} from './websiteDesign';
import { describe, expect, it } from 'vitest';
import { createStudioAuthoringEdit, mergeStudioAuthoringEdit, parseStudioAuthoringEdit, projectStudioAuthoringView, studioCanonicalModuleFields, studioObjectAuthoringFields, studioSiteAuthoringFields } from './authoringView';
import { calculatorJobInputCoverage, calculatorModuleInputCoverage, calculatorInfillCoverage, calculatorBlindInputCoverage, calculatorAluminiumRowInputCoverage, calculatorFlashingInputCoverage } from './inputCoverage';
import type { ObjectFirstWorkbenchDraftVNext } from '../drawings/state/objectFirstWorkbenchModel';
import { STUDIO_AUTHORED_SCHEMA, STUDIO_SPATIAL_OUTPUT_KEY, type StudioAuthoredV1, type StudioJsonObject } from './contracts';

const secret = 'PRIVATE-SENTINEL';
function infill(id: string, shape: 'rect' | 'mono_slope'): StudioJsonObject {
  return { id, label: 'Side', qty: '1', location: 'custom', acrylicSource: 'strip_620', panelOrientation: 'horizontal', widthMode: 'target_width', targetPanelWidthM: '1.0', maxPanelWidthM: '1.2',
    support: { hasTop: false, hasBottom: true, hasLeft: false, hasRight: false, edgeConfirmations: { top: 'unsure', bottom: 'yes', left: 'no', right: 'no', privateNote: secret }, internalSupportMode: 'custom', internalSupportPositionsM: ['0.5', '1.250'], privateRates: { rate: secret } },
    shape: shape === 'rect' ? { type: 'rect', widthM: '2.500', heightM: '1.2', bottomOffsetM: '0', privateData: secret } : { type: 'mono_slope', widthM: '2.5', heightLowM: '0', heightHighM: '1', bottomOffsetM: '', slopeMode: 'pitch', slopeDeg: '15', slopeAnchor: 'right', privateData: secret },
    internalCost: secret,
  };
}
function fixture() {
  const spatial: ObjectFirstWorkbenchDraftVNext = { houseAssembly: null, decks: [], openings: [], pergolas: [{ id: 'p1', label: 'Terrace', family: 'mono', attachmentEdgeId: null, attachmentZoneId: null, side: 'rear', strategy: null }] };
  const authored: StudioAuthoredV1 = { schemaVersion: STUDIO_AUTHORED_SCHEMA, designId: 'design1', revision: 3, spatialOutputKey: STUDIO_SPATIAL_OUTPUT_KEY,
    site: { validation: 'preserved_unvalidated', values: {
      access: 'hard', height: 'two_storey', jobType: 'commercial', pricingClassification: 'bespoke', approvalRequirement: 'engineering_required', travelExGst: '123.45', extrasAllowanceExGst: '', quoteDiscountPct: '0',
      blinds: { items: [{ id: 'b1', label: 'Front', system: 'ZIPTRAK', widthMm: '3000', coverLengthMm: '2250', fabric: 'MESH', motorised: 'YES', rollCover: 'PELMET', privatePrice: secret }], privateTotals: secret },
      additionalAluminium: { extrusionColour: 'Mill', powdercoatStandardColour: 'Titania', powdercoatIsCustom: false, powdercoatCustomColour: '', rows: [{ id: 'a1', profile: 'custom historical profile', stockLengthM: '6.5', quantity: '2', privateSupplier: secret }], privateData: secret },
      standaloneInfills: { extrusionColour: 'White', powdercoatStandardColour: '', powdercoatIsCustom: true, powdercoatCustomColour: 'Custom', items: [infill('s1', 'mono_slope')] },
      internalCosts: secret, unknownFuture: { nested: secret },
    } },
    objectOptions: [{ objectId: 'p1', options: { validation: 'preserved_unvalidated', values: {
      extrusionColour: 'Black', powdercoatStandardColour: '', powdercoatIsCustom: false, powdercoatCustomColour: '', rafterSpacingMm: '550', ceilingOption: 'cedar-150', timberRoofAboveType: 'steel_tray', timberInsulatedPanelThicknessMm: '50', timberTrayWidthMm: '400',
      boxGutterHouseEdge: 'house', boxGutterFarEdge: 'none', downpipeCount: '0', downpipeJoinCount: '1', downpipeElbowCount: '2', separateGutterEnabled: false, overhangEnabled: true, overhangAmountM: '0.25', overhangSupportBeamProfile: '200x50', invertedEnabled: false, invertedHouseGutter: true,
      flashings: { rows: [{ id: 'f1', kind: 'primary', band: '301-400', lengthM: '6.250', purpose: 'HEAD', privateCost: secret }] }, infills: { items: [infill('i1', 'rect')] },
      lengthM: 'OLD PRIVATE GEOMETRY', overrides: { postProfile: secret }, privateData: secret,
    } } }], legacyCommercialAssociations: [{ authority: 'preserved_legacy_only', id: 'old-group', label: secret, objectIds: ['historic-object'], options: { validation: 'preserved_unvalidated', values: { lighting: { lightCount: '4', internal: secret } } } }],
    provenance: { sourceEstimateId: 'est-original', sourceKind: 'imported', sourcePayload: { rawSnapshot: secret, costs: { rate: 500 } } },
  };
  return { authored, spatial };
}
function editable() {
  const saved = fixture(), projected = projectStudioAuthoringView(saved);
  if (!projected.ok) throw new Error(projected.message);
  return { saved, view: projected.value, edit: createStudioAuthoringEdit(projected.value) };
}
describe('safe studio authoring projection and merge', () => {
  it('projects all supported input containers recursively without any private source or cost field', () => {
    const { saved, view } = editable();
    expect(JSON.stringify(view)).not.toContain(secret);
    expect(JSON.stringify(view)).not.toContain('OLD PRIVATE GEOMETRY');
    expect(view.site.travelExGst).toBe('123.45');
    expect(view.site.extrasAllowanceExGst).toBe('');
    expect(view.objectOptions[0].values.ceilingOption).toBe('cedar-150');
    expect(view).not.toHaveProperty('provenance');
    expect(view).not.toHaveProperty('legacyCommercialAssociations');
    expect(view.objectOptions[0].values).not.toHaveProperty('lengthM');
    expect(view.objectOptions[0].values).not.toHaveProperty('overrides');
    view.spatial.pergolas[0].label = 'Changed';
    expect(saved.spatial.pergolas[0].label).toBe('Terrace');
  });
  it('unchanged safe round trip preserves every unknown field and original immutable evidence exactly', () => {
    const { saved, edit } = editable(), before = structuredClone(saved);
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    expect(merged).toEqual({ ok: true, value: { authored: saved.authored, spatial: saved.spatial, pricing: 'unpriced' } });
    expect(saved).toEqual(before);
    if (!merged.ok) throw new Error(merged.message);
    merged.value.authored.provenance.sourcePayload = null;
    expect(saved.authored.provenance).toEqual(before.authored.provenance);
  });
  it('changes known nested values without losing opaque siblings and does not delete omitted rows', () => {
    const { saved, edit } = editable();
    edit.site = { blinds: { items: [{ id: 'b1', widthMm: '3500' }, { id: 'b2', system: 'OMNI', fabric: 'FINE_MESH', widthMm: '', coverLengthMm: '0', motorised: 'NONE', rollCover: 'FLASHING' }] } };
    edit.objectOptions = [{ objectId: 'p1', values: { infills: { items: [{ id: 'i1', shape: { type: 'rect', heightM: '2' } }] } } }];
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    expect(merged.ok).toBe(true);
    if (!merged.ok) throw new Error(merged.message);
    const blinds = merged.value.authored.site.values.blinds as { items: StudioJsonObject[] };
    expect(blinds.items[0]).toMatchObject({ id: 'b1', widthMm: '3500', privatePrice: secret });
    expect(blinds.items[1]).toMatchObject({ id: 'b2', widthMm: '' });
    expect(merged.value.authored.provenance).toEqual(saved.authored.provenance);
    edit.site = { blinds: { items: [] } };
    const retained = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    if (!retained.ok) throw new Error(retained.message);
    expect((retained.value.authored.site.values.blinds as { items: unknown[] }).items).toHaveLength(1);
  });
  it('deletes rows only explicitly while preserving container-private data', () => {
    const { saved, edit } = editable();
    edit.site = {}; edit.objectOptions = [];
    edit.deletions = [{ scope: 'site', collection: 'blinds.items', ids: ['b1'] }, { scope: 'object', objectId: 'p1', collection: 'infills.items', ids: ['i1'] }];
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    if (!merged.ok) throw new Error(merged.message);
    expect(merged.value.authored.site.values.blinds).toEqual({ items: [], privateTotals: secret });
    expect(merged.value.authored.legacyCommercialAssociations).toEqual(saved.authored.legacyCommercialAssociations);
    edit.deletions = [{ scope: 'site', collection: 'blinds.items', ids: ['missing'] }];
    const absent = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    expect(absent.ok).toBe(true);
    if (absent.ok) expect(absent.value.authored).toEqual(saved.authored);
  });
  it('retains explicit deletion after a local add/remove and browser round trip without touching private rows', () => {
    const { saved, edit } = editable();
    edit.deletions = [{ scope: 'site', collection: 'blinds.items', ids: ['local-only'] }];
    const restored = JSON.parse(JSON.stringify(edit));
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit: restored });
    expect(merged).toMatchObject({ ok: true });
    if (merged.ok) expect(merged.value.authored).toEqual(saved.authored);
    restored.site.blinds.items.push({ id: 'local-only', widthMm: '2000' });
    expect(mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit: restored }).ok).toBe(false);
  });
  it('accepts removed local rows from absent collections but rejects unknown object targets', () => {
    const { saved, edit } = editable();
    delete saved.authored.site.values.blinds;
    edit.site = {}; edit.objectOptions = [];
    edit.deletions = [{ scope: 'site', collection: 'blinds.items', ids: ['local-only'] }];
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    expect(merged.ok).toBe(true);
    if (merged.ok) expect(merged.value.authored).toEqual(saved.authored);
    edit.deletions = [{ scope: 'object', objectId: 'missing', collection: 'infills.items', ids: ['local-only'] }];
    expect(mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit }).ok).toBe(false);
  });
  it('retains existing row order for partial patches and appends genuinely new rows', () => {
    const { saved, edit } = editable();
    const originals = saved.authored.site.values.blinds as { items: StudioJsonObject[] };
    originals.items.push({ ...originals.items[0], id: 'b2' });
    edit.site = { blinds: { items: [{ id: 'b2', widthMm: '4000' }, { id: 'b3', widthMm: '5000' }] } };
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    if (!merged.ok) throw new Error(merged.message);
    const rows = (merged.value.authored.site.values.blinds as { items: StudioJsonObject[] }).items;
    expect(rows.map(row => row.id)).toEqual(['b1', 'b2', 'b3']);
    expect(rows[1].widthMm).toBe('4000');
  });
  it('allows new object options and explicit object removal without deleting history', () => {
    const { saved, edit } = editable();
    edit.spatial.pergolas.push({ ...edit.spatial.pergolas[0], id: 'p2' });
    edit.objectOptions.push({ objectId: 'p2', values: { extrusionColour: 'White' } });
    expect(mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit }).ok).toBe(true);
    edit.spatial.pergolas = []; edit.objectOptions = [];
    expect(mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit }).ok).toBe(false);
    edit.deletions = [{ scope: 'object-options', objectId: 'p1' }];
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    if (!merged.ok) throw new Error(merged.message);
    expect(merged.value.authored.objectOptions).toEqual([]);
    expect(merged.value.authored.legacyCommercialAssociations).toEqual(saved.authored.legacyCommercialAssociations);
  });
  it('resets optional ceiling explicitly and preserves unrelated private fields', () => {
    const { saved, edit } = editable(); edit.objectOptions = [];
    edit.deletions = [{ scope: 'object-option', objectId: 'p1', field: 'ceilingOption' }];
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    if (!merged.ok) throw new Error(merged.message);
    expect(merged.value.authored.objectOptions[0].options.values).not.toHaveProperty('ceilingOption');
    expect(merged.value.authored.objectOptions[0].options.values.privateData).toBe(secret);
  });
  it('resets a locally selected ceiling after reload even when never saved, with target and conflict checks', () => {
    const { saved, edit } = editable();
    delete saved.authored.objectOptions[0].options.values.ceilingOption;
    delete edit.objectOptions[0].values.ceilingOption;
    edit.deletions = [{ scope: 'object-option', objectId: 'p1', field: 'ceilingOption' }];
    const restored = JSON.parse(JSON.stringify(edit));
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit: restored });
    expect(merged.ok).toBe(true);
    if (merged.ok) expect(merged.value.authored).toEqual(saved.authored);
    restored.objectOptions[0].values.ceilingOption = 'cedar-100';
    expect(mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit: restored }).ok).toBe(false);
    restored.objectOptions = []; restored.deletions[0].objectId = 'missing';
    expect(mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit: restored }).ok).toBe(false);
  });
  it('shape changes remove obsolete known shape fields but retain unknown server-owned fields', () => {
    const { saved, edit } = editable();
    edit.objectOptions = [{ objectId: 'p1', values: { infills: { items: [{ id: 'i1', shape: { type: 'mono_slope', widthM: '2', heightLowM: '0', heightHighM: '1', slopeMode: 'heights', slopeAnchor: 'left' } }] } } }];
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    if (!merged.ok) throw new Error(merged.message);
    const shape = ((merged.value.authored.objectOptions[0].options.values.infills as { items: StudioJsonObject[] }).items[0].shape as StudioJsonObject);
    expect(shape).toMatchObject({ type: 'mono_slope', privateData: secret });
    expect(shape).not.toHaveProperty('heightM');
  });
  it.each(['rect', 'mono_slope'] as const)('partial transition from %s retains shared dimensions and private fields', initial => {
    const { saved, edit } = editable();
    const items = (saved.authored.objectOptions[0].options.values.infills as { items: StudioJsonObject[] }).items;
    items[0] = infill('i1', initial);
    const target = initial === 'rect' ? 'mono_slope' : 'rect';
    edit.objectOptions = [{ objectId: 'p1', values: { infills: { items: [{ id: 'i1', shape: { type: target } }] } } }];
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    if (!merged.ok) throw new Error(merged.message);
    const shape = ((merged.value.authored.objectOptions[0].options.values.infills as { items: StudioJsonObject[] }).items[0].shape as StudioJsonObject);
    expect(shape).toMatchObject({ type: target, widthM: (items[0].shape as StudioJsonObject).widthM, bottomOffsetM: (items[0].shape as StudioJsonObject).bottomOffsetM, privateData: secret });
    if (target === 'rect') for (const key of ['heightLowM', 'heightHighM', 'slopeMode', 'slopeDeg', 'slopeAnchor']) expect(shape).not.toHaveProperty(key);
    else expect(shape).not.toHaveProperty('heightM');
  });
  it.each([
    (edit: any) => { edit.provenance = { sourcePayload: 'forged' }; },
    (edit: any) => { edit.site.internalCost = 5; },
    (edit: any) => { edit.site.blinds.items[0].privatePrice = 5; },
    (edit: any) => { edit.objectOptions[0].values.lengthM = '10'; },
    (edit: any) => { edit.objectOptions[0].values.infills.items[0].support.privateRate = 5; },
    (edit: any) => { edit.objectOptions[0].values.infills.items[0].shape.unknown = 5; },
    (edit: any) => { edit.objectOptions[0].values.extrusionColour = {}; },
    (edit: any) => { edit.site.blinds.items.push(edit.site.blinds.items[0]); },
    (edit: any) => { edit.deletions = [{ scope: 'site', collection: 'unknown', ids: [] }]; },
  ])('rejects unknown/private submitted fields, malformed fields and identities %#', mutate => {
    const { edit } = editable(); mutate(edit);
    expect(parseStudioAuthoringEdit(edit).ok).toBe(false);
  });
  it('rejects stale input and unsupported existing data without manufacturing an empty design', () => {
    const { saved, edit } = editable(); edit.revision++;
    expect(mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit })).toMatchObject({ ok: false, code: 'STUDIO_STALE' });
    expect(projectStudioAuthoringView({ authored: undefined, spatial: saved.spatial })).toMatchObject({ ok: false });
    saved.authored.site.values.access = { private: secret };
    const failed = projectStudioAuthoringView(saved);
    expect(failed.ok).toBe(false); expect(JSON.stringify(failed)).not.toContain(secret);
  });
  it('accounts for every active module/job input without adopting the calculator runtime', () => {
    const activeModule = Object.entries(calculatorModuleInputCoverage).filter(([, field]) => field.disposition === 'editor' || field.disposition === 'container').map(([key]) => key);
    expect([...Object.keys(studioObjectAuthoringFields), ...studioCanonicalModuleFields].sort()).toEqual([...activeModule, 'websiteDesign'].sort());
    const activeJob = Object.entries(calculatorJobInputCoverage).filter(([, field]) => field.disposition === 'editor' || field.disposition === 'container').map(([key]) => key);
    expect([...Object.keys(studioSiteAuthoringFields).filter(key=>key!=='websiteJoins'&&key!=='websiteAttachments'), 'projectName', 'quoteRef', 'modules', 'pergolas'].sort()).toEqual(activeJob.sort());
    // Assert nested editable/identity allowlists, including optional container members.
    const blind = studioSiteAuthoringFields.blinds.fields.items;
    expect(blind.kind).toBe('rows');
    if (blind.kind === 'rows' && blind.row.kind === 'object') expect(Object.keys(blind.row.fields).sort()).toEqual(Object.keys(calculatorBlindInputCoverage).sort());
    const aluminium = studioSiteAuthoringFields.additionalAluminium.fields.rows;
    if (aluminium.kind === 'rows' && aluminium.row.kind === 'object') expect(Object.keys(aluminium.row.fields).sort()).toEqual(Object.keys(calculatorAluminiumRowInputCoverage).sort());
    const flashings = studioObjectAuthoringFields.flashings.fields.rows;
    if (flashings.kind === 'rows' && flashings.row.kind === 'object') expect(Object.keys(flashings.row.fields).sort()).toEqual(Object.keys(calculatorFlashingInputCoverage).sort());
    const infills = studioObjectAuthoringFields.infills.fields.items;
    if (infills.kind === 'rows' && infills.row.kind === 'object') expect(Object.keys(infills.row.fields).sort()).toEqual(Object.entries(calculatorInfillCoverage('module').item).filter(([, field]) => field.disposition !== 'preserve-only').map(([key]) => key).sort());
  });
});


describe('website intent through the existing authoring boundary', () => {
  const website = () => ({ schemaVersion: 'studio_website_design.v1', objectId: 'p1', selection: { version: 1, input: { widthMm: 4825, projectionMm: 3125, level: 'ground', connection: 'facade' }, roof: { family: 'mono', orientation: 'parallel', infills: false } }, rawDimensions: { widthMm: '4825', projectionMm: 'bad' } });
  it('projects only strict website fields, merges and reopens without exposing retained private values', () => {
    const saved = fixture(); saved.authored.objectOptions[0].options.values.websiteDesign = website();
    const result = projectStudioAuthoringView(saved); if (!result.ok) throw Error(result.message);
    expect(JSON.stringify(result.value)).not.toContain(secret);
    const edit = createStudioAuthoringEdit(result.value);
    const next = website(); next.rawDimensions.projectionMm = '3125'; edit.objectOptions[0].values.websiteDesign = next;
    const merged = mergeStudioAuthoringEdit({ storedAuthored: saved.authored, storedSpatial: saved.spatial, edit });
    if (!merged.ok) throw Error(merged.message);
    const reopened = projectStudioAuthoringView(merged.value); if (!reopened.ok) throw Error(reopened.message);
    expect(reopened.value.objectOptions[0].values.websiteDesign).toEqual(next);
    expect(merged.value.authored.objectOptions[0].options.values.privateData).toBe(secret);
  });
  it('rejects cross-row website identity and nested private fields', () => {
    const saved = fixture(); const value = website(); value.objectId = 'wrong'; saved.authored.objectOptions[0].options.values.websiteDesign = value;
    expect(projectStudioAuthoringView(saved).ok).toBe(false);
    const valid = fixture(); valid.authored.objectOptions[0].options.values.websiteDesign = website();
    const view = projectStudioAuthoringView(valid); if (!view.ok) throw Error(view.message);
    const edit = createStudioAuthoringEdit(view.value);
    (edit.objectOptions[0].values.websiteDesign as StudioJsonObject).objectId = 'wrong'; expect(parseStudioAuthoringEdit(edit).ok).toBe(false);
    const unsafe = website(); Object.assign(unsafe.selection.roof, { privateRate: secret }); valid.authored.objectOptions[0].options.values.websiteDesign = unsafe;
    expect(projectStudioAuthoringView(valid).ok).toBe(false);
  });
});

it('round-trips strict join intent and explicitly clears it without changing private site fields',()=>{
 const saved=fixture();saved.spatial.pergolas.push({...saved.spatial.pergolas[0],id:'p2'});
 saved.authored.objectOptions[0].options.values.websiteDesign=newStudioWebsiteDesign('p1') as unknown as StudioJsonObject;
 saved.authored.objectOptions.push({objectId:'p2',options:{validation:'preserved_unvalidated',values:{websiteDesign:newStudioWebsiteDesign('p2') as unknown as StudioJsonObject}}});
 const view=projectStudioAuthoringView(saved);if(!view.ok)throw Error(view.message);const edit=createStudioAuthoringEdit(view.value);
 edit.site.websiteJoins={schemaVersion:'studio_website_joins.v1',joins:[{id:'join1',a:{objectId:'p1',edge:'right'},b:{objectId:'p2',edge:'left'},alignment:'centre'}]};
 for(const bad of [['centre'],{value:'centre'},null,1,'unknown']){
  const malformed=structuredClone(edit);(malformed.site.websiteJoins as any).joins[0].alignment=bad;
  expect(mergeStudioAuthoringEdit({storedAuthored:saved.authored,storedSpatial:saved.spatial,edit:malformed}).ok).toBe(false);
 }
 for(const bad of [['left'],{value:'left'},null,1,'unknown']){
  const malformed=structuredClone(edit);(malformed.site.websiteJoins as any).joins[0].a.edge=bad;
  expect(mergeStudioAuthoringEdit({storedAuthored:saved.authored,storedSpatial:saved.spatial,edit:malformed}).ok).toBe(false);
 }
 const merged=mergeStudioAuthoringEdit({storedAuthored:saved.authored,storedSpatial:saved.spatial,edit});if(!merged.ok)throw Error(merged.message);
 expect(merged.value.authored.site.values.internalCosts).toBe(secret);const reopened=projectStudioAuthoringView(merged.value);if(!reopened.ok)throw Error(reopened.message);expect(reopened.value.site.websiteJoins).toEqual(edit.site.websiteJoins);
 const cleared=createStudioAuthoringEdit(reopened.value);cleared.site.websiteJoins={schemaVersion:'studio_website_joins.v1',joins:[]};
 const removed=mergeStudioAuthoringEdit({storedAuthored:merged.value.authored,storedSpatial:merged.value.spatial,edit:cleared});expect(removed.ok&&removed.value.authored.site.values.websiteJoins).toEqual(cleared.site.websiteJoins);
});
