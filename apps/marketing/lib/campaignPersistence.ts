/** Consent-gated paid-click evidence. Ordinary returns never extend its lifetime. */
export const CAMPAIGN_PERSISTENCE_KEY = 'sanctuary.ad-identifiers.v1';
export const CAMPAIGN_RETENTION_MS = 90 * 86400000;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type GoogleIds = Partial<Record<'gclid' | 'gbraid' | 'wbraid', string>>;
export type PersistentIdentifiers = { google?: { capturedAt: number; ids: GoogleIds }; meta?: { fbc?: string; fbp?: string } };
const clickPattern = /^[A-Za-z0-9_-]{1,600}$/;
const plain = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const recent = (time: number, now: number) => Number.isSafeInteger(time) && time > 0 && time <= now && now - time < CAMPAIGN_RETENTION_MS;

export function validMetaIdentifier(value: unknown, kind: 'fbc' | 'fbp', now = Date.now()): value is string {
  if (typeof value !== 'string' || value.length > 640) return false;
  const match = /^fb\.(\d)\.(\d{13})\.([A-Za-z0-9_-]+)$/.exec(value);
  return Boolean(match && recent(Number(match[2]), now) && (kind === 'fbc' || /^\d+$/.test(match[3])));
}
export function clearPersistentIdentifiers(store: Store | undefined): void {
  try { store?.removeItem(CAMPAIGN_PERSISTENCE_KEY); } catch { /* Optional browser storage. */ }
}
export function clearMetaCookies(document: Pick<Document,'cookie'>, hostname = ''): void {
  const domains = ['', hostname, ...(hostname === 'sanctuarypergolas.co.nz' || hostname.endsWith('.sanctuarypergolas.co.nz') ? ['sanctuarypergolas.co.nz'] : [])];
  for (const name of ['_fbc','_fbp']) for (const domain of domains) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
  }
}
export function readPersistentIdentifiers(store: Store | undefined, now = Date.now()): PersistentIdentifiers {
  try {
    const raw = store?.getItem(CAMPAIGN_PERSISTENCE_KEY);
    if (!raw) return {};
    const data: unknown = raw.length <= 8192 ? JSON.parse(raw) : null;
    if (!plain(data) || data.version !== 1) { clearPersistentIdentifiers(store); return {}; }
    const out: PersistentIdentifiers = {};
    if (plain(data.google) && typeof data.google.capturedAt === 'number' && recent(data.google.capturedAt, now) && plain(data.google.ids)) {
      const ids: GoogleIds = {};
      for (const key of ['gclid', 'gbraid', 'wbraid'] as const) {
        const value = data.google.ids[key];
        if (typeof value === 'string' && clickPattern.test(value)) ids[key] = value;
      }
      if (Object.keys(ids).length) out.google = { capturedAt: Number(data.google.capturedAt), ids };
    }
    if (plain(data.meta)) for (const key of ['fbc', 'fbp'] as const) {
      if (validMetaIdentifier(data.meta[key], key, now)) out.meta = { ...out.meta, [key]: data.meta[key] };
    }
    // Expired values are erased, not retained in an inaccessible stale blob.
    if (Object.keys(out).length) store?.setItem(CAMPAIGN_PERSISTENCE_KEY, JSON.stringify({ version: 1, ...out }));
    else clearPersistentIdentifiers(store);
    return out;
  } catch { clearPersistentIdentifiers(store); return {}; }
}
export function capturePersistentIdentifiers(input: { store: Store | undefined; googleIds?: GoogleIds; fbclid?: string | null;
  cookie: string; observedAt: number; newArrival: boolean }, now = Date.now()): PersistentIdentifiers {
  const out = readPersistentIdentifiers(input.store, now);
  if (input.newArrival && recent(input.observedAt, now)) {
    const ids: GoogleIds = {};
    for (const key of ['gclid', 'gbraid', 'wbraid'] as const) {
      const value = input.googleIds?.[key];
      if (value && clickPattern.test(value)) ids[key] = value;
    }
    // The same click in a re-opened tagged URL is not a new advertising interaction.
    if (Object.keys(ids).length && JSON.stringify(ids) !== JSON.stringify(out.google?.ids)) out.google = { capturedAt: input.observedAt, ids };
    if (input.fbclid && clickPattern.test(input.fbclid) && out.meta?.fbc?.split('.').slice(3).join('.') !== input.fbclid) {
      out.meta = { ...out.meta, fbc: `fb.1.${input.observedAt}.${input.fbclid}` };
    }
  }
  for (const part of input.cookie.split(';')) {
    const index = part.indexOf('='), name = part.slice(0, index).trim();
    const kind = name === '_fbc' ? 'fbc' : name === '_fbp' ? 'fbp' : null;
    if (!kind) continue;
    let value: string; try { value = decodeURIComponent(part.slice(index + 1).trim()); } catch { continue; }
    if (!validMetaIdentifier(value, kind, now)) continue;
    const current = out.meta?.[kind];
    // A newly observed cookie may be older than this visit's genuine fbclid.
    if (!current || Number(value.split('.')[2]) > Number(current.split('.')[2])) out.meta = { ...out.meta, [kind]: value };
  }
  try { if (Object.keys(out).length) input.store?.setItem(CAMPAIGN_PERSISTENCE_KEY, JSON.stringify({ version: 1, ...out })); } catch { /* Enquiry still works. */ }
  return out;
}
