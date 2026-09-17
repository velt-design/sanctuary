/** First-party campaign context only; no identity, conversion or vendor events. */
export const CAMPAIGN_SESSION_KEY = 'sanctuary.campaign-context.v1';
export const CAMPAIGN_SESSION_MS = 30 * 60 * 1000;
export const CAMPAIGN_UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'] as const;
export const CAMPAIGN_CLICK_KEYS = ['gclid', 'gbraid', 'wbraid'] as const;
export type CampaignContext = {
  utm: Record<string, string>;
  clickIds: Partial<Record<(typeof CAMPAIGN_CLICK_KEYS)[number], string>>;
  landingPage?: string;
  referrer?: string;
};
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Stored = { version: 1; capturedAt: number; context: CampaignContext };
const empty = (): CampaignContext => ({ utm: {}, clickIds: {} });
export function hasCampaign(context: CampaignContext): boolean {
  return Object.keys(context.utm).length > 0 || Object.keys(context.clickIds).length > 0;
}
export function clearCampaignSession(storage: StorageLike | undefined): void {
  try { storage?.removeItem(CAMPAIGN_SESSION_KEY); } catch { /* Storage is optional. */ }
}
function validContext(value: unknown): value is CampaignContext {
  if (!value || typeof value !== 'object') return false;
  const c = value as CampaignContext;
  for (const [record, keys] of [[c.utm, CAMPAIGN_UTM_KEYS], [c.clickIds, CAMPAIGN_CLICK_KEYS]] as const) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    if (Object.entries(record).some(([key, item]) => !(keys as readonly string[]).includes(key) || typeof item !== 'string' || item.length > 600)) return false;
  }
  if (Object.keys(c).some(key => !['utm', 'clickIds', 'landingPage', 'referrer'].includes(key))) return false;
  for (const url of [c.landingPage, c.referrer]) {
    if (url === undefined) continue;
    try { const u = new URL(url); if (url.length > 600 || !['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash) return false; }
    catch { return false; }
  }
  return true;
}
function readStored(storage: StorageLike | undefined, now: number): Stored | null | undefined {
  try {
    const raw = storage?.getItem(CAMPAIGN_SESSION_KEY);
    if (!raw) return undefined;
    const value = raw.length > 8192 ? null : JSON.parse(raw);
    if (value?.version === 1 && value?.expired === true) return null;
    if (value?.version !== 1 || !Number.isFinite(value.capturedAt) || value.capturedAt > now || now - value.capturedAt >= CAMPAIGN_SESSION_MS || !validContext(value.context)) {
      // Erase campaign values, retaining only a tab-local expiry marker so a
      // refresh cannot silently restart an expired tagged arrival.
      storage?.setItem(CAMPAIGN_SESSION_KEY, JSON.stringify({ version: 1, expired: true }));
      return null;
    }
    return value as Stored;
  } catch { clearCampaignSession(storage); return undefined; }
}
export function readCampaignSession(storage: StorageLike | undefined, now = Date.now()): CampaignContext | undefined {
  const stored = readStored(storage, now);
  return stored === null ? empty() : stored?.context;
}
export function captureCampaignSession(context: CampaignContext, storage: StorageLike | undefined, newArrival: boolean, now = Date.now()): void {
  if (!hasCampaign(context) || !validContext(context)) return;
  const previous = readStored(storage, now);
  if (previous === null && !newArrival) return;
  if (previous && !newArrival) return;
  if (previous && previous.context.landingPage === context.landingPage &&
    [...CAMPAIGN_UTM_KEYS, ...CAMPAIGN_CLICK_KEYS].every(key =>
      (previous.context.utm[key] ?? previous.context.clickIds[key as keyof typeof context.clickIds]) ===
      (context.utm[key] ?? context.clickIds[key as keyof typeof context.clickIds]))) return;
  try { storage?.setItem(CAMPAIGN_SESSION_KEY, JSON.stringify({ version: 1, capturedAt: now, context })); }
  catch { /* A blocked store must never prevent the enquiry. */ }
}
