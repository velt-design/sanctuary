import { projectStudioAuthoringView } from './authoringView';
import { isStudioObject } from './contracts';

export const STUDIO_QUOTE_SNAPSHOT_SCHEMA = 'studio_quote_snapshot.v1' as const;
export const STUDIO_CLIENT_QUOTE_SNAPSHOT_SCHEMA = 'studio_quote_snapshot.v2' as const;
export type {StudioQuoteView} from '@sp/quote-format';
export type StudioQuoteHandoff = {
  schemaVersion: typeof STUDIO_QUOTE_SNAPSHOT_SCHEMA | typeof STUDIO_CLIENT_QUOTE_SNAPSHOT_SCHEMA;
  snapshotId: string;
  contentHash: string;
  source: unknown;
  lines: Array<{ description: string; qty: number; unitPriceIncGstCents: number; lineTotalIncGstCents: number; sortOrder: number }>;
  totalIncGstCents: number;
  approvalRequirement: 'neither' | 'engineering_required' | 'full_building_consent';
  approvalIncGstCents: number;
};

/** Portable canonical comparison also used by the local-first Project handoff. */
export function studioCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(studioCanonicalJson).join(',')}]`;
  if (isStudioObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${studioCanonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function readStudioQuoteHandoff(outputs: unknown): StudioQuoteHandoff | null {
  // Estimate projections also contain optional non-Studio fields set to undefined.
  // Validate our three owned payloads strictly, without rejecting that outer DTO.
  if (!outputs || typeof outputs !== 'object' || Array.isArray(outputs) || !Object.hasOwn(outputs, 'studio_authored')) return null;
  const source=outputs as Record<string,unknown>;
  const view = projectStudioAuthoringView({ authored: source.studio_authored, spatial: source.drawing_object_first });
  const raw = source.studio_quote_handoff;
  if (!view.ok || !isStudioObject(raw) || ![STUDIO_QUOTE_SNAPSHOT_SCHEMA,STUDIO_CLIENT_QUOTE_SNAPSHOT_SCHEMA].includes(raw.schemaVersion as typeof STUDIO_QUOTE_SNAPSHOT_SCHEMA)
    || typeof raw.snapshotId !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw.snapshotId)
    || typeof raw.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(raw.contentHash)
    || studioCanonicalJson(raw.source) !== studioCanonicalJson(view.value)
    || !Array.isArray(raw.lines) || !raw.lines.length
    || !['neither', 'engineering_required', 'full_building_consent'].includes(String(raw.approvalRequirement))
    || !Number.isSafeInteger(raw.approvalIncGstCents) || Number(raw.approvalIncGstCents) < 0) return null;
  const lines = raw.lines;
  if (lines.some((line, index) => !isStudioObject(line) || typeof line.description !== 'string' || !line.description.trim()
    || line.qty !== 1 || line.sortOrder !== index || !Number.isSafeInteger(line.unitPriceIncGstCents) || Number(line.unitPriceIncGstCents) < 0
    || line.unitPriceIncGstCents !== line.lineTotalIncGstCents)
    || raw.totalIncGstCents !== lines.reduce<number>((sum, line) => sum + Number((line as Record<string, unknown>).lineTotalIncGstCents), 0)
    || Number(raw.totalIncGstCents) <= 0) return null;
  return structuredClone(raw) as unknown as StudioQuoteHandoff;
}
