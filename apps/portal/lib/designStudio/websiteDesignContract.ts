import { parseWebsiteSubmittedDesign, type WebsiteSubmittedDesignV1 } from '@sp/configurator/website/contract';
import { isStudioObject, type StudioJsonObject } from './contracts';

export const WEBSITE_DESIGN_SCHEMA = 'studio_website_design.v1' as const;
export type StudioWebsiteDesign = {
  schemaVersion: typeof WEBSITE_DESIGN_SCHEMA;
  objectId: string;
  selection: WebsiteSubmittedDesignV1;
  rawDimensions: { widthMm: string; projectionMm: string };
  rawGaps?: Record<string,string>;
  supportDatumMm?: string;
  priorManualSupportDatumMm?: string;
  roofDatumBasis?: 'attached';
  facadeClearanceMm?: string;
};
const keys = (v: StudioJsonObject, names: string[]) => Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const id = (v: unknown): v is string => typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= 200;

/** Browser-safe authored intent only. Dormant website fields remain intact;
 * unknown nested fields never pass through the shared structural parser. */
export function parseStudioWebsiteDesign(value: unknown, objectId?: string):
  { ok: true; value: StudioWebsiteDesign } | { ok: false; message: string } {
  const fail = () => ({ ok: false as const, message: 'The website design choices could not be verified.' });
  if (!isStudioObject(value) || !keys(value, ['schemaVersion', 'objectId', 'selection', 'rawDimensions', ...(Object.hasOwn(value,'facadeClearanceMm')?['facadeClearanceMm']:[]), ...(Object.hasOwn(value,'roofDatumBasis')?['roofDatumBasis']:[]), ...(Object.hasOwn(value,'rawGaps')?['rawGaps']:[]), ...(Object.hasOwn(value,'supportDatumMm')?['supportDatumMm']:[]), ...(Object.hasOwn(value,'priorManualSupportDatumMm')?['priorManualSupportDatumMm']:[])]) ||
    value.schemaVersion !== WEBSITE_DESIGN_SCHEMA || !id(value.objectId) || (objectId !== undefined && value.objectId !== objectId) ||
    !isStudioObject(value.rawDimensions) || !keys(value.rawDimensions, ['widthMm', 'projectionMm']) ||
    !Object.values(value.rawDimensions).every(v => typeof v === 'string' && v.length <= 64)) return fail();
  if (Object.hasOwn(value,'roofDatumBasis') && value.roofDatumBasis !== 'attached') return fail();
  const selection = parseWebsiteSubmittedDesign(value.selection);
  if (!selection.ok) return fail();
  if (Object.hasOwn(value,'supportDatumMm') && (typeof value.supportDatumMm !== 'string' || value.supportDatumMm.length > 64)) return fail();
  if (Object.hasOwn(value,'facadeClearanceMm') && (typeof value.facadeClearanceMm !== 'string' || value.facadeClearanceMm.length > 64)) return fail();
  if (Object.hasOwn(value,'priorManualSupportDatumMm') && (typeof value.priorManualSupportDatumMm !== 'string' || value.priorManualSupportDatumMm.length > 64)) return fail();
  if(value.rawGaps!==undefined&&(!isStudioObject(value.rawGaps)||Object.keys(value.rawGaps).length>17||Object.entries(value.rawGaps).some(([key,raw])=>typeof raw!=='string'||raw.length>64||(key!=='roof'&&!selection.value.roof.sidePanels?.some(panel=>key===panel.opening)))))return fail();
  return { ok: true, value: { schemaVersion: WEBSITE_DESIGN_SCHEMA, objectId: value.objectId,
    selection: selection.value, ...(typeof value.facadeClearanceMm==='string'?{facadeClearanceMm:value.facadeClearanceMm}:{}), ...(value.roofDatumBasis==='attached'?{roofDatumBasis:'attached' as const}:{}), rawDimensions: structuredClone(value.rawDimensions) as StudioWebsiteDesign['rawDimensions'],...(value.rawGaps?{rawGaps:structuredClone(value.rawGaps) as Record<string,string>}:{}), ...(typeof value.supportDatumMm==='string'?{supportDatumMm:value.supportDatumMm}:{}), ...(typeof value.priorManualSupportDatumMm==='string'?{priorManualSupportDatumMm:value.priorManualSupportDatumMm}:{}) } };
}

/** Tuple encoding prevents delimiter collisions; local website IDs stay unchanged. */
export function studioWebsiteElementKey(objectId: string, kind: 'opening' | 'member' | 'section', localId: string) {
  if (!id(objectId) || !id(localId)) throw Error('Invalid website element identity.');
  return JSON.stringify([objectId, kind, localId]);
}

export function rebindStudioWebsiteDesign(value: StudioWebsiteDesign, objectId: string): StudioWebsiteDesign {
  if (!id(objectId)) throw Error('Invalid target pergola identity.');
  return { ...structuredClone(value), objectId };
}


export function newStudioWebsiteDesign(objectId: string): StudioWebsiteDesign {
  return { schemaVersion: WEBSITE_DESIGN_SCHEMA, objectId,
    selection: { version: 1, input: { widthMm: 6000, projectionMm: 3000, level: 'ground', connection: 'facade' },
      roof: { family: 'mono', orientation: 'parallel', infills: false } },
    rawDimensions: { widthMm: '6000', projectionMm: '3000' } };
}


/** Website-owned objects retain only spatial identity/placement here. Product
 * geometry is derived from the website selection, never a stale workbench copy. */
export function websiteSpatialMatches(value: StudioWebsiteDesign, object: { id: string; family: string; geometry?: unknown }) {
  return value.objectId === object.id && value.selection.roof.family === object.family && object.geometry === undefined;
}

/** The explicit starter never replaces existing or retained design work. */
export function isEmptyWebsiteStart(view: { revision: number; objectOptions: unknown[]; spatial: { houseAssembly: unknown; decks: unknown[]; openings: unknown[]; pergolas: unknown[] } }) {
 return view.revision === 1 && view.objectOptions.length === 0 && view.spatial.houseAssembly === null &&
  view.spatial.decks.length === 0 && view.spatial.openings.length === 0 && view.spatial.pergolas.length === 0;
}

/** User-triggered profile/default changes supersede only their matching raw gap. */
export function changeStudioGap(value:StudioWebsiteDesign,key:string,raw:string):StudioWebsiteDesign {return {...value,rawGaps:{...value.rawGaps,[key]:raw}};}
export function clearStudioGap(value:StudioWebsiteDesign,key:string):StudioWebsiteDesign {const rawGaps={...value.rawGaps};delete rawGaps[key];return {...value,rawGaps};}
