import { CONSENT_STORAGE_KEY, parseStoredConsent } from './consent';
export type GoogleEnhancedLead = { sha256_email_address?: string; sha256_phone_number?: string };
type AdsWindow = Window & { dataLayer?: Array<Record<string,unknown>>; sanctuaryGoogleEnhancedLead?: GoogleEnhancedLead };
function marketingStillAllowed(target: AdsWindow, allowed: boolean) {
  if (!allowed) return false;
  try { return parseStoredConsent(target.localStorage.getItem(CONSENT_STORAGE_KEY))?.marketing !== false; }
  catch { return allowed; }
}
export async function googleLeadHashes(contact: { email: string; phone: string }, subtle: SubtleCrypto): Promise<GoogleEnhancedLead> {
  const digest = async (value: string) => Array.from(new Uint8Array(await subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const out: GoogleEnhancedLead = {};
  let email=contact.email.replace(/\s/g,'').toLowerCase();
  if (email.length<=254 && /^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    let [local,domain]=email.split('@');
    if (domain==='gmail.com'||domain==='googlemail.com')local=local.split('+')[0].replace(/\./g,'');
    email=`${local}@${domain}`;if(local)out.sha256_email_address=await digest(email);
  }
  const phone=contact.phone.replace(/[\s().-]/g,'');
  if(/^\+[1-9]\d{7,14}$/.test(phone))out.sha256_phone_number=await digest(phone);
  return out;
}
/** Only the three enquiry Ads tags read this short-lived object. No contact data enters GA4 or the event object. */
export async function emitSubmittedLead(event: Record<string,unknown>, contact: { email: string; phone: string } | undefined,
  marketingAllowed: boolean, enabled = process.env.NEXT_PUBLIC_GOOGLE_ENHANCED_LEADS_ENABLED === 'true') {
  const target=window as AdsWindow;
  const clear=()=>{delete target.sanctuaryGoogleEnhancedLead;};
  clear();
  try {
    if(enabled && contact && marketingStillAllowed(target,marketingAllowed) && window.crypto?.subtle) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const hashes=await Promise.race([googleLeadHashes(contact,window.crypto.subtle),new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),400);})]);
      clearTimeout(timer);
      if(hashes && Object.keys(hashes).length && marketingStillAllowed(target,marketingAllowed)) {
        const expiresAt=Date.now()+2500;
        Object.defineProperty(target,'sanctuaryGoogleEnhancedLead',{configurable:true,
          get:()=>Date.now()<expiresAt && marketingStillAllowed(target,marketingAllowed)?hashes:undefined});
      }
    }
    const scoped=Object.getOwnPropertyDescriptor(target,'sanctuaryGoogleEnhancedLead');
    const clearOwn=()=>{if(Object.getOwnPropertyDescriptor(target,'sanctuaryGoogleEnhancedLead')?.get===scoped?.get)clear();};
    const timeout=setTimeout(clearOwn,2500);
    target.dataLayer=target.dataLayer||[];
    target.dataLayer.push({...event,event:'lead_submitted',eventCallback:()=>{clearTimeout(timeout);clearOwn();},eventTimeout:2000});
  } catch { clear(); }
}
