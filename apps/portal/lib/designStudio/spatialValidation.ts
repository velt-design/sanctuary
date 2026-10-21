import type { HouseComposition } from '@sp/geometry';
import type {
  ObjectFirstWorkbenchDraftVNext, ObjectFirstHouseFormDraft, ObjectFirstHouseAssemblyDraft,
  ObjectFirstDeckDraft, ObjectFirstOpeningDraft, ObjectFirstPergolaDraft, ObjectFirstPergolaGeometryDraft,
  PergolaAttachment, PergolaAttachmentHost, DeckAttachment,
} from '../drawings/state/objectFirstWorkbenchModel';
import { isStudioJson } from './contracts';

type Failure = { ok: false; code: 'INVALID_STUDIO_SPATIAL' | 'UNSUPPORTED_STUDIO_SPATIAL'; path: string; message: string };
type Rule = { optional?: boolean; check: (value: unknown, path: string) => Failure | null };
const fail = (path: string, message: string, unsupported = false): Failure => ({ ok: false, code: unsupported ? 'UNSUPPORTED_STUDIO_SPATIAL' : 'INVALID_STUDIO_SPATIAL', path, message });
const scalar = (check: (value: unknown) => boolean, message: string): Rule => ({ check: (value, path) => check(value) ? null : fail(path, message) });
const string = scalar(value => typeof value === 'string', 'Expected a draft string.');
const id = scalar(value => typeof value === 'string' && value.length > 0 && value.trim() === value, 'Expected a nonempty stable identity without surrounding whitespace.');
const number = scalar(value => typeof value === 'number' && Number.isFinite(value), 'Expected a finite number.');
const index = scalar(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, 'Expected a nonnegative integer index.');
const boolean = scalar(value => typeof value === 'boolean', 'Expected a boolean.');
const choice = (...values: (string | number | boolean)[]): Rule => scalar(value => values.includes(value as string | number | boolean), 'Unsupported discriminator or enum value.');
const optional = (rule: Rule): Rule => ({ ...rule, optional: true });
const nullable = (rule: Rule): Rule => ({ check: (value, path) => value === null ? null : rule.check(value, path) });
const array = (rule: Rule): Rule => ({ check: (value, path) => {
  if (!Array.isArray(value)) return fail(path, 'Expected an array.');
  for (let i = 0; i < value.length; i++) { const error = rule.check(value[i], `${path}[${i}]`); if (error) return error; }
  return null;
} });
/** Keys are compile-time checked against the existing canonical owner, not another model. */
function object<T>(fields: { [K in keyof T]-?: Rule }): Rule {
  return { check(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path, 'Expected an object.');
    const source = value as Record<string, unknown>, rules = fields as Record<string, Rule>;
    for (const key of Object.keys(source)) if (!Object.hasOwn(rules, key)) return fail(`${path}.${key}`, 'Unknown field; retain the source and open read-only.', true);
    for (const [key, rule] of Object.entries(rules)) {
      if (!Object.hasOwn(source, key)) { if (rule.optional) continue; return fail(`${path}.${key}`, 'Missing required field.'); }
      const error = rule.check(source[key], `${path}.${key}`); if (error) return error;
    }
    return null;
  } };
}
const side = choice('rear', 'front', 'left', 'right');
const strategy = nullable(choice('soffit_brackets', 'fascia_under_gutter', 'facade_ledger', 'post_supported_tieback', 'none'));
const axis = choice('x', 'y');
const fall = choice('positive_x', 'negative_x', 'positive_y', 'negative_y');
const position = object<NonNullable<ObjectFirstPergolaDraft['position']>>({ originXMm: string, originYMm: string, rotationDeg: string });
const roofIntent = object<ObjectFirstHouseFormDraft['roofIntent']>({ form: choice('flat', 'mono', 'hipped'), primaryPitchDeg: string, primaryFallDirection: fall, ridgeAxis: axis, openGableEndIds: array(id) });
type Rectangle = Extract<HouseComposition['primitives'][number], { kind: 'axisAlignedRectangle' }>;
type RectangleRoof = Rectangle['roofIntent'];
const rectangleRoof: Rule = { check(value, path) {
  const form = value && typeof value === 'object' ? (value as Record<string, unknown>).form : undefined;
  if (form === 'flat') return object<Extract<RectangleRoof, { form: 'flat' }>>({ form: choice('flat') }).check(value, path);
  if (form === 'mono') return object<Extract<RectangleRoof, { form: 'mono' }>>({ form: choice('mono'), pitchDeg: number, fallDirection: fall }).check(value, path);
  if (form === 'hipped') return object<Extract<RectangleRoof, { form: 'hipped' }>>({ form: choice('hipped'), pitchDeg: number, ridgeAxis: axis, startCap: choice('hipped', 'open_gable'), endCap: choice('hipped', 'open_gable') }).check(value, path);
  return fail(`${path}.form`, 'Unsupported rectangle roof intent.', true);
} };
const primitive: Rule = { check(value, path) {
  if (!value || typeof value !== 'object' || (value as Record<string, unknown>).kind !== 'axisAlignedRectangle') return fail(`${path}.kind`, 'Unsupported composition primitive; no approximation was made.', true);
  return object<Rectangle>({ kind: choice('axisAlignedRectangle'), originXMm: number, originYMm: number, widthMm: number, depthMm: number, roofIntent: rectangleRoof }).check(value, path);
} };
const edge = choice('north', 'south', 'east', 'west');
const composition = object<HouseComposition>({ primitives: array(primitive), joins: array(object<HouseComposition['joins'][number]>({ fromPrimitiveIndex: index, fromEdge: edge, toPrimitiveIndex: index, toEdge: edge })) });
const house = object<ObjectFirstHouseFormDraft>({
  id, label: string, transform: object<ObjectFirstHouseFormDraft['transform']>({ offsetXM: number, offsetYM: number, rotationQuarterTurns: choice(0, 1, 2, 3) }),
  composition, attachmentSide: side, position: optional(nullable(position)), roofIntent, roofIntentAuthored: optional(boolean),
  storeyMode: choice('single_storey', 'double_storey', 'custom'), attachmentStrategy: strategy,
  eaveHeightM: optional(nullable(string)), wallHeightM: optional(nullable(string)), soffitDepthMm: optional(nullable(string)), fasciaHeightMm: optional(nullable(string)),
  gutterWidthMm: optional(nullable(string)), gutterDepthMm: optional(nullable(string)), gutterProjectionMm: optional(nullable(string)), eaveOverhangMm: optional(nullable(string)),
});
const attachmentHost = object<PergolaAttachmentHost>({ objectFamily: choice('house_forms', 'pergolas'), objectId: id, edgeKind: choice('wall', 'roof_eave', 'pergola_outline'), edgeId: id, myEdgeIndex: index });
const attachment = object<PergolaAttachment>({ host: nullable(attachmentHost), spatialKind: choice('wall', 'roof_edge', 'pergola_outline', 'freestanding'), method: choice('facade_ledger', 'fascia_under_gutter', 'direct_to_soffit', 'soffit_brackets', 'none') });
// The canonical deck boundary explicitly retains an empty edgeId before wall snap.
const deckAttachment = object<DeckAttachment>({ host: nullable(object<NonNullable<DeckAttachment['host']>>({ objectFamily: choice('house_forms'), objectId: id, edgeKind: choice('wall'), edgeId: string, myEdgeIndex: index })), spatialKind: choice('wall', 'freestanding') });
const deck = object<ObjectFirstDeckDraft>({
  id, shape: choice('preset', 'custom'), presetType: nullable(choice('rect_attached', 'rect_detached')),
  presetRect: optional(nullable(object<NonNullable<ObjectFirstDeckDraft['presetRect']>>({ widthM: string, depthM: string, centerOffsetM: string, detachedGapM: optional(nullable(string)) }))),
  floatingRect: optional(nullable(object<NonNullable<ObjectFirstDeckDraft['floatingRect']>>({ centerAlongM: string, centerDepthM: string, widthM: string, depthM: string }))),
  outline: array(object<ObjectFirstDeckDraft['outline'][number]>({ alongM: string, depthM: string })), position: optional(nullable(position)), levelOffsetMm: string, isAttached: boolean,
  surfaceMaterial: choice('timber_decking', 'composite', 'concrete'), hostEdgeId: nullable(id), attachmentMode: optional(nullable(choice('floating', 'single_edge', 'corner_dual_edge'))),
  primaryHostEdgeId: optional(nullable(id)), secondaryHostEdgeId: optional(nullable(id)), cornerVertexId: optional(nullable(id)), attachment: optional(nullable(deckAttachment)),
});
const opening = object<ObjectFirstOpeningDraft>({ id, label: string, kind: choice('window', 'hinged_door', 'slider', 'stacker'), panelCount: nullable(choice(2, 3, 4)), hostWallId: nullable(id),
  sourceFormId: optional(nullable(id)), wallId: optional(nullable(side)), hostEdgeId: optional(nullable(id)), widthM: string, heightM: string, sillHeightM: string, offsetAlongWallM: string });
type Geometry = ObjectFirstPergolaGeometryDraft;
const geometry = object<Geometry>({
  dimensions: optional(object<NonNullable<Geometry['dimensions']>>({ lengthM: optional(string), projectionM: optional(string), hipCornerLengthBM: optional(string), hipCornerProjectionBM: optional(string) })),
  roof: optional(object<NonNullable<Geometry['roof']>>({ material: optional(choice('none', 'acrylic', 'timber', 'mixed', 'insulated', 'louvre')), pitchDeg: optional(string), boxPerimeterEnabled: optional(boolean), mixedAcrylicBaysMain: optional(string), mixedAcrylicBaysA: optional(string), mixedAcrylicBaysB: optional(string) })),
  gable: optional(object<NonNullable<Geometry['gable']>>({ endFramesMode: optional(choice('none', 'outer_end_only', 'both_ends')), houseEaveGutterMode: optional(choice('house', 'our')), outerEaveGutterMode: optional(choice('house', 'our')) })),
  supports: optional(object<NonNullable<Geometry['supports']>>({ postConnectionType: optional(choice('pile_1m', 'pile_1_5m', 'deck_bracket', 'slab_anchors')), ground: optional(choice('easy', 'hard')), postCount: optional(string), postCutHeightM: optional(string) })),
  overrides: optional(object<NonNullable<Geometry['overrides']>>({ ledgerProfile: optional(nullable(string)), rafterProfile: optional(nullable(string)), postProfile: optional(nullable(string)), frontBeamProfile: optional(nullable(string)), ridgeBeamProfile: optional(nullable(string)), boxPerimeterBeamProfile: optional(nullable(string)), tieBeamProfile: optional(nullable(string)), strutProfile: optional(nullable(string)) })),
});
const pergola = object<ObjectFirstPergolaDraft>({ id, label: string, family: choice('mono', 'gable', 'box', 'hip', 'hip_corner', 'unknown'), connectionKind: optional(nullable(choice('freestanding', 'soffit', 'fascia', 'wall'))),
  attachmentEdgeId: nullable(id), attachmentZoneId: nullable(id), side, strategy, geometry: optional(nullable(geometry)), position: optional(nullable(position)), attachment: optional(nullable(attachment)) });
const draft = object<ObjectFirstWorkbenchDraftVNext>({ houseAssembly: nullable(object<ObjectFirstHouseAssemblyDraft>({ id, label: string, houseForms: array(house) })), decks: array(deck), openings: array(opening), pergolas: array(pergola) });

function references(value: ObjectFirstWorkbenchDraftVNext): Failure | null {
  const houses = value.houseAssembly?.houseForms ?? [], ids = new Map<string, string>();
  const groups = { house_forms: houses, decks: value.decks, openings: value.openings, pergolas: value.pergolas };
  if (value.houseAssembly) ids.set(value.houseAssembly.id, 'assembly');
  for (const [family, objects] of Object.entries(groups)) for (const item of objects) {
    if (ids.has(item.id)) return fail('$', `Duplicate object identity: ${item.id}`);
    ids.set(item.id, family);
  }
  for (const [i, form] of houses.entries()) for (const [j, join] of form.composition.joins.entries()) {
    if (join.fromPrimitiveIndex >= form.composition.primitives.length || join.toPrimitiveIndex >= form.composition.primitives.length) return fail(`$.houseAssembly.houseForms[${i}].composition.joins[${j}]`, 'Join references a missing primitive.');
  }
  for (const [i, item] of value.openings.entries()) if (item.sourceFormId && ids.get(item.sourceFormId) !== 'house_forms') return fail(`$.openings[${i}].sourceFormId`, 'Opening references a missing house form.');
  for (const [i, item] of value.decks.entries()) {
    const a = item.attachment; if (!a) continue;
    if ((a.spatialKind === 'freestanding') !== (a.host === null)) return fail(`$.decks[${i}].attachment`, 'Deck attachment kind and host disagree.');
    if (a.host && ids.get(a.host.objectId) !== 'house_forms') return fail(`$.decks[${i}].attachment.host.objectId`, 'Deck host is not a current house form.');
  }
  for (const [i, item] of value.pergolas.entries()) {
    const a = item.attachment; if (!a) continue;
    const path = `$.pergolas[${i}].attachment`;
    const methods = { freestanding: ['none'], wall: ['facade_ledger'], pergola_outline: ['none'], roof_edge: ['fascia_under_gutter', 'direct_to_soffit', 'soffit_brackets'] };
    if (!methods[a.spatialKind].includes(a.method) || (a.spatialKind === 'freestanding' && a.host !== null)) return fail(path, 'Attachment kind, method and host disagree.');
    // Null hosts on non-freestanding historical drafts remain explicitly unresolved.
    if (!a.host) continue;
    if (a.host.objectId === item.id || ids.get(a.host.objectId) !== a.host.objectFamily) return fail(`${path}.host.objectId`, 'Attachment references a missing, wrong-family or self host.');
    const expectedKind = a.spatialKind === 'wall' ? 'wall' : a.spatialKind === 'roof_edge' ? 'roof_eave' : 'pergola_outline';
    const expectedFamily = a.spatialKind === 'pergola_outline' ? 'pergolas' : 'house_forms';
    if (a.host.edgeKind !== expectedKind || a.host.objectFamily !== expectedFamily) return fail(`${path}.host`, 'Attachment host kind does not match its spatial relationship.');
  }
  return null;
}

/** Structural ingress only. No dimension limits, numeric-string coercion, solve,
 * engineering checks, costing or rendering-readiness claim. The canonical solver
 * still owns empty/overlapping compositions, invalid sizes/pitches and edge geometry. */
export function parseStudioSpatialDraft(value: unknown): Failure | { ok: true; value: ObjectFirstWorkbenchDraftVNext; readiness: 'unchecked' } {
  if (!isStudioJson(value)) return fail('$', 'Expected lossless JSON with finite numbers and bounded nesting.');
  const error = draft.check(value, '$'); if (error) return error;
  const typed = value as unknown as ObjectFirstWorkbenchDraftVNext;
  const referenceError = references(typed); if (referenceError) return referenceError;
  return { ok: true, value: structuredClone(typed), readiness: 'unchecked' };
}
