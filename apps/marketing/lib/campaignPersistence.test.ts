import { describe, expect, it } from 'vitest';
import { CAMPAIGN_PERSISTENCE_KEY, CAMPAIGN_RETENTION_MS, capturePersistentIdentifiers, clearPersistentIdentifiers, readPersistentIdentifiers } from './campaignPersistence';
const now = 1791900000000;
const storage = () => { const values = new Map<string,string>(); return { getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key,value); }, removeItem: (key: string) => { values.delete(key); } }; };
describe('fixed paid-click retention', () => {
  it('keeps independent Google and Meta arrivals across a returning visit without extending either date', () => {
    const store = storage();
    capturePersistentIdentifiers({ store, googleIds: { gclid: 'first_click' }, cookie: '', observedAt: now, newArrival: true }, now);
    capturePersistentIdentifiers({ store, fbclid: 'meta_click', cookie: '', observedAt: now+1000, newArrival: true }, now+1000);
    const returned = capturePersistentIdentifiers({ store, cookie: '', observedAt: now+86400000, newArrival: false }, now+86400000);
    expect(returned.google).toEqual({ capturedAt: now, ids: { gclid:'first_click' } });
    expect(returned.meta?.fbc).toBe(`fb.1.${now+1000}.meta_click`);
    expect(readPersistentIdentifiers(store,now+CAMPAIGN_RETENTION_MS)).toEqual({meta:{fbc:`fb.1.${now+1000}.meta_click`}});
    expect(readPersistentIdentifiers(store,now+1000+CAMPAIGN_RETENTION_MS)).toEqual({});
    expect(store.getItem(CAMPAIGN_PERSISTENCE_KEY)).toBeNull();
  });
  it('does not renew an identical tagged link or reload, and never invents fbp or fbc without evidence', () => {
    const store=storage();
    expect(capturePersistentIdentifiers({store,cookie:'',observedAt:now,newArrival:false},now)).toEqual({});
    capturePersistentIdentifiers({store,googleIds:{gclid:'same'},fbclid:'same',cookie:'',observedAt:now,newArrival:true},now);
    capturePersistentIdentifiers({store,googleIds:{gclid:'same'},fbclid:'same',cookie:'',observedAt:now+1000,newArrival:true},now+1000);
    expect(readPersistentIdentifiers(store,now+1000).google?.capturedAt).toBe(now);
    expect(readPersistentIdentifiers(store,now+1000).meta).toEqual({fbc:`fb.1.${now}.same`});
  });
  it('rejects malformed, future, stale and credential-shaped cookie values', () => {
    const store=storage();
    for(const cookie of [`_fbc=fb.1.${now+1}.future`,`_fbp=fb.1.${now}.not-a-number`,`_fbc=fb.1.${now-CAMPAIGN_RETENTION_MS}.old`,'_fbc=%broken'])
      expect(capturePersistentIdentifiers({store,cookie,observedAt:now,newArrival:false},now)).toEqual({});
    capturePersistentIdentifiers({store,cookie:`_fbp=fb.1.${now}.123456`,observedAt:now,newArrival:false},now);
    clearPersistentIdentifiers(store);expect(readPersistentIdentifiers(store,now)).toEqual({});
  });
  it('does not block the enquiry when browser storage is unavailable',()=>{
    const store={getItem:()=>{throw Error();},setItem:()=>{throw Error();},removeItem:()=>{throw Error();}};
    expect(()=>capturePersistentIdentifiers({store,cookie:'',observedAt:now,newArrival:true},now)).not.toThrow();
  });
});
