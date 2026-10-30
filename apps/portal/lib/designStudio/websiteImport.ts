import { parseWebsiteSubmittedDesign, type WebsiteSubmittedDesignV1 } from '@sp/configurator/website';
import { validateCommercialInternalName } from '@/lib/commercial/internalName';
import { isStudioObject, STUDIO_AUTHORED_SCHEMA, STUDIO_OUTPUT_KEY, STUDIO_SPATIAL_OUTPUT_KEY, type StudioAuthoredV1, type StudioJsonObject } from './contracts';
import type { StudioCreationPreparation } from './createPreparation';
import { studioIdentifier } from './identifiers';
import { parseStudioSpatialDraft } from './spatialValidation';
import { parseStudioWebsiteEnrichment } from './websiteEnrichment';
import { parseStudioWebsiteGableEnrichment } from './websiteGableEnrichment';
import { mapWebsiteGableImportGeometry } from '@sp/configurator/geometry';

type Result = { ok: true; prepared: StudioCreationPreparation } | { ok: false; code: 'INVALID_STUDIO_CREATION' | 'UNSUPPORTED_STUDIO_SOURCE'; message: string };
const failure = (invalid = false): Result => ({ ok: false, code: invalid ? 'INVALID_STUDIO_CREATION' : 'UNSUPPORTED_STUDIO_SOURCE', message: invalid ? 'Check the explicit Studio creation details.' : 'This website design requires further staff reconciliation. The original is unchanged.' });
export function checkStudioWebsiteImportDesign(raw: unknown): { ok: true; design: WebsiteSubmittedDesignV1 } | { ok: false; message: string } {
  return checkWebsiteFamily(raw, 'mono');
}
export function checkStudioWebsiteGableImportDesign(raw: unknown): { ok: true; design: WebsiteSubmittedDesignV1 } | { ok: false; message: string } {
  return checkWebsiteFamily(raw, 'gable');
}
function checkWebsiteFamily(raw: unknown, family: 'mono' | 'gable'): { ok: true; design: WebsiteSubmittedDesignV1 } | { ok: false; message: string } {
  const parsed = parseWebsiteSubmittedDesign(raw);
  if (!parsed.ok) return { ok: false, message: 'The saved website design format is unsupported.' };
  const { roof } = parsed.value;
  // Website v1 getRoofFinish explicitly defines omitted finish as acrylic.
  if (roof.family !== family || (roof.finish && roof.finish.material !== 'acrylic')) return { ok: false, message: `Only plain ${family} acrylic website designs can currently be imported.` };
  if (roof.attachmentIntent !== 'freestanding') return { ok: false, message: 'A confirmed freestanding website design is required; house connections need further reconciliation.' };
  if (roof.infills || roof.blinds?.length || roof.sidePanels?.length || roof.roofBattens || roof.lighting) return { ok: false, message: 'Infills, blinds, side panels, roof battens or lighting need further reconciliation before import.' };
  return { ok: true, design: parsed.value };
}
/** Private trusted-source preparation. Never serialize source evidence to a browser. */
export function prepareStudioWebsiteImport(input: unknown): Result {
  return prepareWebsiteFamily(input, 'mono');
}
export function prepareStudioWebsiteGableImport(input: unknown): Result {
  return prepareWebsiteFamily(input, 'gable');
}
function prepareWebsiteFamily(input: unknown, family: 'mono' | 'gable'): Result {
  try {
    if (!isStudioObject(input) || Object.keys(input).some(k => !['projectId', 'designId', 'pergolaId', 'source', 'enrichment', 'internalName'].includes(k))
      || ['projectId', 'designId', 'pergolaId', 'source', 'enrichment'].some(k => !Object.hasOwn(input, k))) return failure(true);
    for (const key of ['designId', 'pergolaId']) if (typeof input[key] !== 'string' || !input[key].trim() || input[key] !== input[key].trim() || input[key].length > 200) return failure(true);
    if (typeof input.projectId !== 'string') return failure(true);
    const gable = family === 'gable' ? parseStudioWebsiteGableEnrichment(input.enrichment) : null;
    const project = studioIdentifier(input.projectId, 'proj'), source = input.source, enrichment = family === 'gable' ? gable : parseStudioWebsiteEnrichment(input.enrichment);
    if (!enrichment) return failure(true);
    const override = validateCommercialInternalName(input.internalName), hasOverride = Object.hasOwn(input, 'internalName');
    if (hasOverride && (!override.ok || override.value !== input.internalName)) return failure(true);
    if (!isStudioObject(source) || typeof source.id !== 'string' || typeof source.project_id !== 'string'
      || studioIdentifier(source.project_id, 'proj').uuid !== project.uuid || typeof source.status !== 'string' || !['draft', 'archived'].includes(source.status)
      || typeof source.updated_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(source.updated_at) || !Number.isFinite(Date.parse(source.updated_at))
      || !isStudioObject(source.inputs) || !isStudioObject(source.outputs) || Object.hasOwn(source.outputs, STUDIO_OUTPUT_KEY) || Object.hasOwn(source.outputs, STUDIO_SPATIAL_OUTPUT_KEY)) return failure();
    const parent = studioIdentifier(source.id, 'est'), commercialScope = source.commercial_scope_id;
    if (commercialScope !== null && (typeof commercialScope !== 'string' || studioIdentifier(commercialScope, 'proj').uuid !== commercialScope)) return failure();
    const snapshot = source.outputs.snapshot, brief = isStudioObject(snapshot) ? snapshot.customerBrief : null;
    if (!isStudioObject(brief) || brief.version !== 1 || typeof brief.audience !== 'string' || typeof brief.designStatus !== 'string' || !['residential', 'commercial', 'professional'].includes(String(brief.audience)) || !['configured', 'bespoke', 'help'].includes(String(brief.designStatus))) return failure();
    const eligible = checkWebsiteFamily(isStudioObject(brief) ? brief.design : null, family);
    if (!eligible.ok) return failure();
    const name = validateCommercialInternalName(source.internal_name), hasName = Object.hasOwn(source, 'internal_name');
    if (hasName && (!name.ok || name.value !== source.internal_name)) return failure();
    const { widthMm, projectionMm } = eligible.design.input;
    const lengthM = String(widthMm / 1000), projectionM = String(projectionMm / 1000);
    if (!gable && (Number(lengthM) * 1000 !== widthMm || Number(projectionM) * 1000 !== projectionMm)) return failure();
    const mapping = gable ? mapWebsiteGableImportGeometry({ widthMm, projectionMm, orientation: eligible.design.roof.orientation, rafterWidthMm: Number(gable.rafterProfile.split('x')[1]) }) : null;
    const spatial = parseStudioSpatialDraft({ houseAssembly: null, decks: [], openings: [], pergolas: [{
      id: input.pergolaId, label: 'Website pergola', family, connectionKind: 'freestanding', attachmentEdgeId: null, attachmentZoneId: null, side: 'rear', strategy: gable ? null : 'none',
      // New workspace origin, not a surveyed position or a relationship to a house.
      position: mapping?.position ?? { originXMm: '0', originYMm: '0', rotationDeg: '0' }, attachment: { spatialKind: 'freestanding', method: 'none', host: null },
      geometry: { dimensions: mapping?.dimensions ?? { lengthM, projectionM }, roof: { material: 'acrylic', pitchDeg: enrichment.pitchDeg },
        supports: { postConnectionType: enrichment.postConnectionType, ground: enrichment.ground, postCount: enrichment.postCount, postCutHeightM: enrichment.heightM },
        ...(gable ? { gable: { endFramesMode: gable.endFramesMode, houseEaveGutterMode: gable.houseEaveGutterMode, outerEaveGutterMode: gable.outerEaveGutterMode } } : {}),
        overrides: { ledgerProfile: '', frontBeamProfile: enrichment.frontBeamProfile, rafterProfile: enrichment.rafterProfile, postProfile: enrichment.postProfile,
          ...(gable ? { ridgeBeamProfile: gable.ridgeBeamProfile, tieBeamProfile: gable.tieBeamProfile, strutProfile: gable.strutProfile } : {}) } },
    }] });
    if (!spatial.ok) return failure(true);
    const authored: StudioAuthoredV1 = { schemaVersion: STUDIO_AUTHORED_SCHEMA, designId: input.designId as string, revision: 1, spatialOutputKey: STUDIO_SPATIAL_OUTPUT_KEY,
      site: { validation: 'preserved_unvalidated', values: {} }, objectOptions: [], legacyCommercialAssociations: [],
      provenance: { sourceKind: 'imported', sourceEstimateId: parent.appId, sourcePayload: structuredClone(source) } };
    const prepared: StudioCreationPreparation = { row: { project_id: project.uuid, commercial_scope_id: commercialScope, status: 'draft', inputs: {},
      outputs: { [STUDIO_OUTPUT_KEY]: authored as unknown as StudioJsonObject, [STUDIO_SPATIAL_OUTPUT_KEY]: spatial.value as unknown as StudioJsonObject },
      ...(hasOverride && override.ok ? { internal_name: override.value } : hasName && name.ok ? { internal_name: name.value } : {}) },
      lineage: { parentEstimateId: parent.uuid, parentUpdatedAt: source.updated_at, parentAuthoredRevision: 0 }, sourceSnapshot: structuredClone(source), pricing: 'unpriced' };
    return new TextEncoder().encode(JSON.stringify(prepared.row)).length > 2097152 ? failure() : { ok: true, prepared };
  } catch { return failure(); }
}
