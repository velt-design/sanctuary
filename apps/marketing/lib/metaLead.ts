'use client';

import { CONSENT_STORAGE_KEY, parseStoredConsent } from './consent';

type Lead = { event: Record<string, unknown>; timer: ReturnType<typeof setTimeout> };
type PixelWindow = Window & { fbq?: (...args: unknown[]) => void };
const pending = new Map<string, Lead>(), dispatched = new Set<string>();
const pendingLimit = 8, dispatchedLimit = 64, pendingLifetimeMs = 60_000;

function permitted(allowed: boolean) {
  if (!allowed || typeof window === 'undefined') return false;
  try { return parseStoredConsent(localStorage.getItem(CONSENT_STORAGE_KEY))?.marketing !== false; }
  catch { return allowed; }
}
function forget(id: string) {
  const lead = pending.get(id);
  if (lead) clearTimeout(lead.timer);
  pending.delete(id);
}
export function clearPendingMetaLeads() {
  for (const id of pending.keys()) forget(id);
  dispatched.clear();
}
function dispatch(id: string, event: Record<string, unknown>) {
  const pixel = (window as PixelWindow).fbq;
  if (typeof pixel !== 'function') return false;
  forget(id);
  // A throw may follow an accepted queue operation. Do not repeat that dispatch.
  dispatched.add(id);
  if (dispatched.size > dispatchedLimit) dispatched.delete(dispatched.values().next().value!);
  try { pixel('track', 'Lead', event, { eventID: id }); } catch { /* Optional measurement. */ }
  return true;
}

/** Only existing non-PII success properties enter this short-lived in-memory queue.
 * The submission UUID remains Meta's deduplication identity, never a new lead. */
export function emitMetaLead(event: Record<string, unknown>, id: string, allowed: boolean) {
  if (!permitted(allowed) || dispatched.has(id) || pending.has(id)) return;
  if (dispatch(id, event)) return;
  if (pending.size >= pendingLimit) forget(pending.keys().next().value!);
  pending.set(id, { event: { ...event }, timer: setTimeout(() => forget(id), pendingLifetimeMs) });
}
export function flushPendingMetaLeads(allowed: boolean) {
  if (!permitted(allowed)) { clearPendingMetaLeads(); return; }
  for (const [id, lead] of pending) dispatch(id, lead.event);
}
