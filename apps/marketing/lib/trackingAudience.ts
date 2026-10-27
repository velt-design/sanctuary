export const VERIFICATION_TRAFFIC_KEY = 'sanctuary.verification-traffic';
const productionTrackingHost = (hostname: string) =>
  hostname === 'sanctuarypergolas.co.nz' || hostname === 'www.sanctuarypergolas.co.nz';
const verifiedDocuments=new WeakSet<Window>();

// Delayed first-party vendor scripts recheck the same tab policy immediately
// before loading an external runtime, including after a queued render.
export const trackingRuntimeGuard = `
if (location.hostname !== 'sanctuarypergolas.co.nz' && location.hostname !== 'www.sanctuarypergolas.co.nz') return;
var measurement = new URLSearchParams(location.search).get('measurement');
if (measurement === 'verification') sessionStorage.setItem('${VERIFICATION_TRAFFIC_KEY}', 'true');
if (measurement === 'normal') sessionStorage.removeItem('${VERIFICATION_TRAFFIC_KEY}');
if (sessionStorage.getItem('${VERIFICATION_TRAFFIC_KEY}') === 'true') return;
`;

/** Open ?measurement=verification before testing. The tab keeps this choice
 * through navigation; ?measurement=normal or closing it ends verification.
 * It only suppresses measurement; it grants no access or intake rights. */
function verificationState(): boolean | undefined {
  if (typeof window === 'undefined') return undefined;
  const marker=new URLSearchParams(window.location.search).get('measurement');
  if(marker==='verification') {
    verifiedDocuments.add(window);
    try { window.sessionStorage.setItem(VERIFICATION_TRAFFIC_KEY,'true'); } catch { /* The explicit URL still establishes verification. */ }
    return true;
  }
  if(marker==='normal')verifiedDocuments.delete(window);
  try {
    if(marker==='normal')window.sessionStorage.removeItem(VERIFICATION_TRAFFIC_KEY);
    const saved=window.sessionStorage.getItem(VERIFICATION_TRAFFIC_KEY)==='true';
    if(saved)verifiedDocuments.add(window);
    return saved || verifiedDocuments.has(window);
  }
  catch { return verifiedDocuments.has(window) ? true : undefined; }
}

// A failed measurement prerequisite is not evidence that a customer is a test.
export function verificationTraffic(): boolean {
  return typeof window !== 'undefined'
    && (!productionTrackingHost(window.location.hostname) || verificationState()===true);
}

export function trackingAudienceAllowed(): boolean {
  if (typeof window === 'undefined' || !productionTrackingHost(window.location.hostname)) return false;
  const allowed=verificationState()===false;
  // Also disable an already loaded Google tag when a direct event/navigation
  // observes verification or cannot establish the measurement prerequisites.
  const measurementId=(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID||'G-KGLF83X6JW').trim();
  (window as unknown as Record<string,unknown>)[`ga-disable-${measurementId}`]=!allowed;
  return allowed;
}
