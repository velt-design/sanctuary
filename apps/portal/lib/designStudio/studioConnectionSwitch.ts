import { attachmentUnavailable, solvePergolaPreview } from '@sp/configurator/geometry';
import type { StudioAuthoringEdit } from './authoringView';
import { StudioConnectionError } from './studioConnectionDiagnostics';
import { prospectiveStudioFacadeClearance } from './studioFacadeClearance';
import { studioHouseScene, type HouseReference, type StudioHouseConnectionChoice } from './studioHouseScene';
import { studioHouseTargets, solveStudioHouse } from './studioHouseGeometry';
import { previewStudioAttachmentAtAnchor, retainedStudioCanonicalBinding, updateStudioHouse } from './studioHouseCommands';
import { websiteComposition, transformWebsitePoint } from './websiteComposition';
import { websiteConnectionEdge } from './websiteConnectionEdge';
import { websiteCompositionPriceEligibility } from './websiteCompositionEligibility';
import { segmentDistance } from './interaction/finitePlacement';
import { resolveStudioWebsiteDesign } from './websiteDesign';

type Method = StudioHouseConnectionChoice['method'];
export type StudioConnectionSwitchTarget = {
  choice: StudioHouseConnectionChoice;
  anchor: HouseReference['position'] | null;
  /** Keep the tangent where it fits; otherwise project onto the same finite edge. */
  projectToEdge: boolean;
};

/** An explicit method click retains the real relationship first. An unattached
 * object acquires the nearest actual edge, independently of target array order. */
export function studioConnectionSwitchTarget(edit: StudioAuthoringEdit, objectId: string, method: Method): StudioConnectionSwitchTarget {
  const row = websiteComposition(edit).find(row => row.object.id === objectId);
  if (!row?.value || !row.position) throw Error(row?.error ?? 'Select a current pergola.');
  const unavailable = attachmentUnavailable(row.value.selection.input, row.value.selection.roof, method);
  if (unavailable) throw Error(unavailable);
  const scene = studioHouseScene(edit.site, edit.spatial);
  if (!scene?.houses.length) throw Error('Add a house before choosing a house connection.');
  const binding = scene.attachments.find(a => a.objectId === objectId) ?? retainedStudioCanonicalBinding(edit, objectId, row);
  const kind = method === 'facade' ? 'wall' : 'eave';
  const gap = prospectiveStudioFacadeClearance(row.value, method);
  const preference = gap === undefined ? {} : { facadeClearanceMm: gap };
  if (binding) {
    const { reference, ...choice } = binding;
    return { choice: { ...choice, kind, method, ...preference }, anchor: row.position ?? reference.position, projectToEdge: true };
  }
  const roof = { ...row.value.selection.roof };
  delete roof.attachmentIntent;
  const desired = resolveStudioWebsiteDesign({ ...row.value, selection: { ...row.value.selection, input: { ...row.value.selection.input, connection: method }, roof } }, objectId);
  if (!desired.ok) throw Error(desired.message);
  const geometry = solvePergolaPreview(desired.value.input, desired.value.roof, row.geometryOptions).geometry;
  if (!geometry) throw Error('The pergola geometry is unavailable.');
  const edge = websiteConnectionEdge(geometry.assembly);
  const current = { start: transformWebsitePoint(edge.start, row.position), end: transformWebsitePoint(edge.end, row.position) };
  const requiredSpan = Math.hypot(edge.end.x - edge.start.x, edge.end.y - edge.start.y);
  const direction = { x: current.end.x - current.start.x, y: current.end.y - current.start.y };
  const candidates = scene.houses.flatMap(house => studioHouseTargets(house, method))
    .filter(target => target.kind === kind && !target.error)
    .map(target => {
      const dx = target.end.x - target.start.x, dy = target.end.y - target.start.y;
      const span = Math.hypot(dx, dy);
      const angle = 1 - Math.abs((direction.x * dx + direction.y * dy) / (Math.hypot(direction.x, direction.y) * span));
      return { target, span, distance: segmentDistance(current, target), angle, key: `${target.houseId}/${target.side}` };
    })
    .sort((a, b) => a.distance - b.distance || a.angle - b.angle || a.key.localeCompare(b.key));
  const target = (candidates.find(candidate => candidate.span >= requiredSpan - 1e-6) ?? candidates[0])?.target;
  if (!target) throw Error('This house has no compatible level edge for the chosen connection.');
  return { choice: { objectId, houseId: target.houseId, edge: target.side, kind, method, ...preference }, anchor: row.position, projectToEdge: true };
}

/** The single explicit method-switch policy. The ordinary resolver never edits
 * a house. Here measured constraints may adjust its model, with every affected
 * relationship checked before the session records one compound Undo entry. */
export function previewStudioConnectionSwitch(edit: StudioAuthoringEdit, request: StudioConnectionSwitchTarget) {
  const rowsBefore = websiteComposition(edit);
  const current = rowsBefore.find(row => row.object.id === request.choice.objectId);
  const binding = current?.studioAttachment ?? (current && retainedStudioCanonicalBinding(edit, current.object.id, current));
  if (current && !current.error && binding?.method === request.choice.method &&
    binding.houseId === request.choice.houseId && binding.edge === request.choice.edge &&
    current.value?.selection.input.connection === request.choice.method &&
    (request.choice.method !== 'facade' || current.value.facadeClearanceMm === request.choice.facadeClearanceMm))
    return { edit, choice: request.choice };
  let candidate = edit;
  let changedHouse = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const result = previewStudioAttachmentAtAnchor(candidate, request.choice, request.anchor, request.projectToEdge);
      const rows = websiteComposition(result.edit);
      if (changedHouse) {
        const host = request.choice.houseId;
        const siblings = rows.filter(row => row.object.attachment?.host?.objectId === host);
        const invalid = siblings.find(row => row.error);
        if (invalid) throw Error(`${invalid.object.label}: ${invalid.error}. The house and connections have been kept.`);
      }
      // Preserve the existing arrangement/pricing authority. An existing unrelated
      // refusal remains visible; a method click cannot introduce a new one.
      const before = websiteCompositionPriceEligibility(rowsBefore, edit.site.websiteJoins);
      const after = websiteCompositionPriceEligibility(rows, result.edit.site.websiteJoins);
      if (after && after !== before) throw Error(after);
      return result;
    } catch (error) {
      const constraint = error instanceof StudioConnectionError ? error.measurements?.fitConstraint : undefined;
      if (!constraint) throw error;
      const scene = studioHouseScene(candidate.site, candidate.spatial);
      const house = scene?.houses.find(house => house.id === request.choice.houseId);
      if (!house) throw error;
      if (constraint.kind === 'fascia-depth') {
        const depth = Math.ceil(constraint.requiredDepthMm);
        if (Number(house.roof.fasciaHeightMm) >= depth) throw error;
        candidate = updateStudioHouse(candidate, { ...house, roof: { ...house.roof, fasciaHeightMm: String(depth) } });
      } else {
        const { supportDatumMm: datum, minimumMm: min, maximumMm: max } = constraint;
        const delta = datum < min ? Math.ceil(min - datum) : datum > max ? Math.floor(max - datum) : 0;
        if (!delta) throw error;
        const eave = house.eaveHeightMm === ''
          ? Math.min(...(solveStudioHouse(house).model.eave.gutterLines ?? []).flatMap(line => [line.start.z, line.end.z]))
          : Number(house.eaveHeightMm);
        if (!Number.isFinite(eave)) throw Error('The actual house eave height is unavailable. Your design is kept.');
        candidate = updateStudioHouse(candidate, {
          ...house,
          wallHeightMm: String(Number(house.wallHeightMm) + delta),
          eaveHeightMm: String(eave + delta),
        });
      }
      changedHouse = true;
    }
  }
  throw Error('This connection cannot be fitted without changing other design choices. Your design is kept.');
}
