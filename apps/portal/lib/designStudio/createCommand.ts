import { parseStudioWebsiteEnrichment, type StudioWebsiteEnrichment } from './websiteEnrichment';
import { parseStudioWebsiteGableEnrichment, type StudioWebsiteGableEnrichment } from './websiteGableEnrichment';
import { parseStudioWebsiteFacadeEnrichment, type StudioWebsiteFacadeEnrichment } from './websiteFacadeEnrichment';
import { parseStudioWebsiteHostSelection, type StudioWebsiteHostSelection } from './websiteHostSelection';
import { isStudioObject } from './contracts';
import { isUuid } from '@/lib/supabase/mappers';
import { studioIdentifier } from './identifiers';
import { validateCommercialInternalName } from '@/lib/commercial/internalName';

type LegacyStudioCreateCommand = { schemaVersion: 'studio_create.v1'; requestId: string } & (
  | { mode: 'blank'; scope: 'base' | 'add_on'; internalName?: string | null }
  | { mode: 'clone'; sourceEstimateId: string; expectedUpdatedAt: string; expectedRevision: number; internalName?: string | null }
  | { mode: 'import'; sourceEstimateId: string; expectedUpdatedAt: string; expectedRevision: 0; internalName?: string | null }
);
export type StudioCreateCommand = LegacyStudioCreateCommand | ({ requestId: string; mode: 'website'; sourceEstimateId: string; expectedUpdatedAt: string; expectedRevision: 0; internalName?: string | null } & (
  | { schemaVersion: 'studio_create.v2'; enrichment: StudioWebsiteEnrichment }
  | { schemaVersion: 'studio_create.v3'; enrichment: StudioWebsiteGableEnrichment }
  | { schemaVersion: 'studio_create.v4'; enrichment: StudioWebsiteFacadeEnrichment; hostSource: StudioWebsiteHostSelection }
));
export type StudioCreateReceipt = { estimateId: string; designId: string; revision: 1; savedAt: string; alreadyExisted: boolean };

export function parseStudioCreateCommand(value: unknown): StudioCreateCommand | null {
  if (!isStudioObject(value) || typeof value.schemaVersion !== 'string' || !['studio_create.v1', 'studio_create.v2', 'studio_create.v3', 'studio_create.v4'].includes(value.schemaVersion) || typeof value.requestId !== 'string' ||
    value.requestId !== value.requestId.trim().toLowerCase() || !isUuid(value.requestId)) return null;
  const website = value.schemaVersion !== 'studio_create.v1';
  const facade = value.schemaVersion === 'studio_create.v4';
  const enrichment = facade ? parseStudioWebsiteFacadeEnrichment(value.enrichment) : value.schemaVersion === 'studio_create.v3' ? parseStudioWebsiteGableEnrichment(value.enrichment) : parseStudioWebsiteEnrichment(value.enrichment);
  const host = facade ? parseStudioWebsiteHostSelection(value.hostSource) : null;
  if (facade && (!host || host.estimateId === value.sourceEstimateId)) return null;
  if (website ? value.mode !== 'website' || !enrichment : value.mode === 'website') return null;
  const fields = value.mode === 'blank' ? ['schemaVersion', 'requestId', 'mode', 'scope']
    : ['schemaVersion', 'requestId', 'mode', 'sourceEstimateId', 'expectedUpdatedAt', 'expectedRevision'];
  if (website) fields.push('enrichment');
  if (facade) fields.push('hostSource');
  if (Object.hasOwn(value, 'internalName')) {
    const name = validateCommercialInternalName(value.internalName);
    if (!name.ok || name.value !== value.internalName) return null;
    fields.push('internalName');
  }
  if (Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value, key))) return null;
  if (value.mode === 'blank') return value.scope === 'base' || value.scope === 'add_on' ? structuredClone(value) as StudioCreateCommand : null;
  if (typeof value.mode !== 'string' || !['clone', 'import', 'website'].includes(value.mode) || typeof value.sourceEstimateId !== 'string' || typeof value.expectedUpdatedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value.expectedUpdatedAt) || !Number.isFinite(Date.parse(value.expectedUpdatedAt)) ||
    !Number.isSafeInteger(value.expectedRevision) || (value.mode !== 'clone' ? value.expectedRevision !== 0 : Number(value.expectedRevision) < 1)) return null;
  try { if (studioIdentifier(value.sourceEstimateId, 'est').appId !== value.sourceEstimateId) return null; } catch { return null; }
  return structuredClone(value) as StudioCreateCommand;
}
