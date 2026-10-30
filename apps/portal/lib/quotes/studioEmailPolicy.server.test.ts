import {afterEach,expect,it,vi} from 'vitest';
import {studioCustomerEmailEnabled,studioQuoteDeliveryBlocked} from './studioEmailPolicy.server';
afterEach(()=>vi.unstubAllEnvs());
it('requires a separate affirmative Studio mail rollout and lets prepare-only override it',()=>{
 expect(studioCustomerEmailEnabled({})).toBe(false);
 expect(studioCustomerEmailEnabled({STUDIO_CUSTOMER_EMAIL_ENABLED:'1'})).toBe(true);
 expect(studioCustomerEmailEnabled({STUDIO_CUSTOMER_EMAIL_ENABLED:'1',STUDIO_CLIENT_PACKAGE_PREPARE_ONLY:'1'})).toBe(false);
});
it('uses immutable Studio provenance or the frozen package marker without restricting unrelated quotes',()=>{
 vi.stubEnv('STUDIO_CUSTOMER_EMAIL_ENABLED','');
 expect(studioQuoteDeliveryBlocked({})).toBe(false);
 expect(studioQuoteDeliveryBlocked({studioDesign:{snapshotId:'frozen'} as any})).toBe(true);
 expect(studioQuoteDeliveryBlocked({}, {protectedPayload:{studioPackage:{revision:3}}} as any)).toBe(true);
 expect(studioQuoteDeliveryBlocked({}, {protectedPayload:{studioPackage:null}} as any)).toBe(true);
});
