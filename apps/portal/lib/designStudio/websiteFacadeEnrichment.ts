import { isStudioObject } from './contracts';

/** Explicit staff intent, not measured-house evidence or engineering approval.
 * Height is the high-side support underside; position is in canonical mm.
 * Fresh canonical attachment inspection still owns contact and bearing validity.
 */
export type StudioWebsiteFacadeEnrichment = {
  family: 'mono';
  connection: 'facade_ledger';
  sourceConnectionConfirmed: true;
  houseGeometryReviewed: true;
  heightM: string;
  pitchDeg: string;
  postCount: string;
  postConnectionType: 'slab_anchors' | 'deck_bracket' | 'pile_1_5m';
  ground: 'easy' | 'hard';
  ledgerProfile: string;
  rafterProfile: string;
  postProfile: string;
  position: { originXMm: string; originYMm: string; rotationDeg: '0' | '90' | '180' | '270' };
  myEdgeIndex: number;
};

const keys = ['family', 'connection', 'sourceConnectionConfirmed', 'houseGeometryReviewed', 'heightM', 'pitchDeg', 'postCount', 'postConnectionType', 'ground', 'ledgerProfile', 'rafterProfile', 'postProfile', 'position', 'myEdgeIndex'];
function exactKeys(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  return isStudioObject(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
}

/** Check the decimal digits before Number can erase fractional millimetres. */
function wholeMm(raw: unknown, metres: boolean): boolean {
  if (typeof raw !== 'string' || raw.length > 32 || !(metres ? /^\d+(?:\.\d+)?$/ : /^-?\d+(?:\.\d+)?$/).test(raw)) return false;
  const [whole, fraction = ''] = raw.split('.');
  const places = metres ? 3 : 0;
  if (/[^0]/.test(fraction.slice(places))) return false;
  const magnitude = BigInt(whole.replace('-', '')) * (metres ? BigInt(1000) : BigInt(1))
    + BigInt(places ? fraction.slice(0, places).padEnd(places, '0') : '0');
  const exact = raw.startsWith('-') ? -magnitude : magnitude;
  if (magnitude > BigInt(Number.MAX_SAFE_INTEGER) || (metres && exact <= BigInt(0))) return false;
  const number = Number(raw), mm = Number(exact);
  return Number.isFinite(number) && (metres ? Math.round(number * 1000) === mm && number === mm / 1000 : number === mm);
}

function profile(raw: unknown): boolean {
  return typeof raw === 'string' && raw.length <= 100 && /^[1-9]\d*x[1-9]\d*$/.test(raw)
    && raw.split('x').every(part => BigInt(part) <= BigInt(Number.MAX_SAFE_INTEGER));
}

export function parseStudioWebsiteFacadeEnrichment(value: unknown): StudioWebsiteFacadeEnrichment | null {
  if (!exactKeys(value, keys) || value.family !== 'mono' || value.connection !== 'facade_ledger'
    || value.sourceConnectionConfirmed !== true || value.houseGeometryReviewed !== true) return null;
  if (!wholeMm(value.heightM, true) || typeof value.pitchDeg !== 'string' || value.pitchDeg.length > 32
    || !/^\d+(?:\.\d+)?$/.test(value.pitchDeg) || !Number.isFinite(Number(value.pitchDeg))
    || Number(value.pitchDeg) < 0 || Number(value.pitchDeg) >= 90) return null;
  if (typeof value.postCount !== 'string' || value.postCount.length > 32 || !/^\d+$/.test(value.postCount)
    || BigInt(value.postCount) < BigInt(1) || BigInt(value.postCount) > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  if (typeof value.postConnectionType !== 'string' || !['slab_anchors', 'deck_bracket', 'pile_1_5m'].includes(value.postConnectionType)
    || typeof value.ground !== 'string' || !['easy', 'hard'].includes(value.ground)) return null;
  if (!['ledgerProfile', 'rafterProfile', 'postProfile'].every(key => profile(value[key]))) return null;
  if (!exactKeys(value.position, ['originXMm', 'originYMm', 'rotationDeg'])
    || !wholeMm(value.position.originXMm, false) || !wholeMm(value.position.originYMm, false)
    || typeof value.position.rotationDeg !== 'string' || !['0', '90', '180', '270'].includes(value.position.rotationDeg)) return null;
  if (typeof value.myEdgeIndex !== 'number' || !Number.isSafeInteger(value.myEdgeIndex) || value.myEdgeIndex < 0) return null;
  return structuredClone(value) as StudioWebsiteFacadeEnrichment;
}
