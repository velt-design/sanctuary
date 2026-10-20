import type { ObjectFirstWorkbenchDraftVNext } from '../drawings/state/objectFirstWorkbenchModel';
import { isStudioJson, isStudioObject, parseStudioAuthored, STUDIO_OUTPUT_KEY, STUDIO_SPATIAL_OUTPUT_KEY, validateStudioAssociations, type StudioAuthoredV1, type StudioJsonObject } from './contracts';

export type StudioPersistenceFailure = { ok: false; code: 'INVALID_STUDIO_AUTHORED' | 'UNSUPPORTED_STUDIO_SCHEMA' | 'ESTIMATE_LOCKED' | 'STUDIO_STALE' | 'STUDIO_IDENTITY_CHANGED'; message: string };
export type StudioReadResult =
  | { ok: true; state: 'absent'; revision: 0; pricing: 'retained_unverified' }
  | { ok: true; state: 'authored'; revision: number; authored: StudioAuthoredV1; pricing: 'unpriced'; }
  | StudioPersistenceFailure;

export function readStudioAuthoredOutputs(outputs: unknown): StudioReadResult {
  if (!isStudioObject(outputs)) return { ok: false, code: 'INVALID_STUDIO_AUTHORED', message: 'Estimate outputs must be a JSON object.' };
  if (!Object.hasOwn(outputs, STUDIO_OUTPUT_KEY)) return { ok: true, state: 'absent', revision: 0, pricing: 'retained_unverified' };
  const result = parseStudioAuthored(outputs[STUDIO_OUTPUT_KEY]);
  return result.ok ? { ok: true, state: 'authored', revision: result.value.revision, authored: result.value, pricing: 'unpriced' } : result;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

/**
 * Pure preparation only. The authenticated command MUST recheck lock/revision and
 * commit atomically; this function alone supplies no database concurrency guarantee.
 * No import, normalization, calculation or commercial readiness occurs here.
 */
export function prepareStudioAuthoredSave(args: {
  existingOutputs: unknown;
  expectedRevision: number;
  isLocked: boolean;
  authored: unknown;
  /** Validated by the canonical object-first owner, never synthesized from calculator inputs. */
  spatial: ObjectFirstWorkbenchDraftVNext;
}): StudioPersistenceFailure | { ok: true; outputs: StudioJsonObject; revision: number; changed: boolean; pricing: 'unpriced' } {
  const fail = (code: StudioPersistenceFailure['code'], message: string): StudioPersistenceFailure => ({ ok: false, code, message });
  if (args.isLocked) return fail('ESTIMATE_LOCKED', 'Create a new revision to change this locked source estimate.');
  const current = readStudioAuthoredOutputs(args.existingOutputs);
  if (!current.ok) return current;
  if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision !== current.revision) return fail('STUDIO_STALE', 'The design changed. Reload the saved revision before saving.');
  const next = parseStudioAuthored(args.authored);
  if (!next.ok) return next;
  if (next.value.revision !== Math.max(1, args.expectedRevision)) return fail('STUDIO_STALE', 'The submitted authored revision does not match the saved revision.');
  if (!isStudioJson(args.spatial)) return fail('INVALID_STUDIO_AUTHORED', 'Spatial draft is not lossless JSON.');
  const associationError = validateStudioAssociations(next.value, args.spatial);
  if (associationError) return fail('INVALID_STUDIO_AUTHORED', associationError);
  if (current.state === 'authored' && (current.authored.designId !== next.value.designId || canonical(current.authored.provenance) !== canonical(next.value.provenance) || canonical(current.authored.legacyCommercialAssociations) !== canonical(next.value.legacyCommercialAssociations))) return fail('STUDIO_IDENTITY_CHANGED', 'Design identity and original provenance are immutable.');
  const outputs = structuredClone(args.existingOutputs) as StudioJsonObject;
  const changed = current.state === 'absent' || canonical(current.authored) !== canonical(next.value) || canonical(outputs[STUDIO_SPATIAL_OUTPUT_KEY]) !== canonical(args.spatial);
  const revision = changed ? current.revision + 1 : current.revision;
  if (!Number.isSafeInteger(revision)) return fail('STUDIO_STALE', 'The revision cannot advance safely.');
  outputs[STUDIO_OUTPUT_KEY] = { ...next.value, revision } as unknown as StudioJsonObject;
  outputs[STUDIO_SPATIAL_OUTPUT_KEY] = structuredClone(args.spatial) as unknown as StudioJsonObject;
  return { ok: true, outputs, revision, changed, pricing: 'unpriced' };
}
