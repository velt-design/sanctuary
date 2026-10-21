import { isStudioObject } from './contracts';
import { studioIdentifier } from './identifiers';

/** Saved source identity, not a browser-supplied house or contact proof. */
export type StudioWebsiteHostSelection = {
  estimateId: string;
  expectedUpdatedAt: string;
  expectedDesignId: string;
  expectedRevision: number;
  houseFormId: string;
  wallId: string;
};
const keys = ['estimateId', 'expectedUpdatedAt', 'expectedDesignId', 'expectedRevision', 'houseFormId', 'wallId'];
const identity = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value;

export function parseStudioWebsiteHostSelection(raw: unknown): StudioWebsiteHostSelection | null {
  try {
    if (!isStudioObject(raw) || Object.keys(raw).length !== keys.length || keys.some(key => !Object.hasOwn(raw, key))) return null;
    if (!identity(raw.estimateId) || studioIdentifier(raw.estimateId, 'est').appId !== raw.estimateId
      || !identity(raw.expectedDesignId) || !identity(raw.houseFormId) || !identity(raw.wallId)
      || typeof raw.expectedRevision !== 'number' || !Number.isSafeInteger(raw.expectedRevision) || raw.expectedRevision < 1
      || typeof raw.expectedUpdatedAt !== 'string' || raw.expectedUpdatedAt.length > 64
      || !/^\d{4}-\d{2}-\d{2}T/.test(raw.expectedUpdatedAt) || !Number.isFinite(Date.parse(raw.expectedUpdatedAt))) return null;
    // Preserve original precision; reconstructing Date would discard microseconds.
    return structuredClone(raw) as StudioWebsiteHostSelection;
  } catch { return null; }
}
