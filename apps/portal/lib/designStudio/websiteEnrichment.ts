import { isStudioObject } from './contracts';

export type StudioWebsiteEnrichment = {
  heightM: string; pitchDeg: string; postCount: string;
  postConnectionType: 'pile_1m' | 'pile_1_5m' | 'deck_bracket' | 'slab_anchors';
  ground: 'easy' | 'hard'; ledgerProfile: ''; frontBeamProfile: string; rafterProfile: string; postProfile: string;
};
const keys = ['heightM', 'pitchDeg', 'postCount', 'postConnectionType', 'ground', 'ledgerProfile', 'frontBeamProfile', 'rafterProfile', 'postProfile'];
/** Explicit authoring values, not engineering approval or published stock selection. */
export function parseStudioWebsiteEnrichment(value: unknown): StudioWebsiteEnrichment | null {
  if (!isStudioObject(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) return null;
  const decimal = (v: unknown) => typeof v === 'string' && v.length <= 32 && /^\d+(?:\.\d+)?$/.test(v) && Number.isFinite(Number(v));
  if (!decimal(value.heightM) || Number(value.heightM) <= 0 || !decimal(value.pitchDeg) || Number(value.pitchDeg) < 0 || Number(value.pitchDeg) >= 90
    || typeof value.postCount !== 'string' || !/^\d+$/.test(value.postCount) || !Number.isSafeInteger(Number(value.postCount)) || Number(value.postCount) < 1
    || typeof value.postConnectionType !== 'string' || !['pile_1m', 'pile_1_5m', 'deck_bracket', 'slab_anchors'].includes(String(value.postConnectionType))
    || typeof value.ground !== 'string' || !['easy', 'hard'].includes(String(value.ground)) || value.ledgerProfile !== '') return null;
  for (const key of ['frontBeamProfile', 'rafterProfile', 'postProfile']) {
    const raw = value[key];
    if (typeof raw !== 'string' || raw.length > 100 || !/^\d+\s*[xX]\s*\d+$/.test(raw)) return null;
    if (raw.split(/[xX]/).some(n => !Number.isSafeInteger(Number(n)) || Number(n) <= 0)) return null;
  }
  return structuredClone(value) as StudioWebsiteEnrichment;
}
