import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {seal} from './security';
const mocks=vi.hoisted(()=>({cookies:vi.fn()}));
vi.mock('next/headers',()=>({cookies:mocks.cookies}));
import {discoveredOrganisations} from './discovery';
const key=Buffer.alloc(32,8);
const organisations=[{tenantId:'11111111-1111-4111-8111-111111111111',tenantName:'Demo Company'}];
beforeEach(()=>{
  vi.resetAllMocks();
  for(const [name,value] of Object.entries({XERO_ENABLED:'true',XERO_DISCOVERY:'true',XERO_TENANT_ID:'',XERO_PORTAL_ORIGIN:'https://portal.example.test',XERO_TOKEN_ENCRYPTION_KEY:key.toString('base64'),XERO_DATABASE_URL:'postgres://test@localhost/test',XERO_CLIENT_ID:'id',XERO_CLIENT_SECRET:'secret'}))vi.stubEnv(name,value);
});
afterEach(()=>vi.unstubAllEnvs());
describe('private organisation discovery',()=>{
  it('shows authenticated metadata only to the same user before expiry',async()=>{
    mocks.cookies.mockResolvedValue({get:()=>({value:seal({userId:'owner',expires:Date.now()+600000,organisations},key)})});
    expect(await discoveredOrganisations('owner')).toEqual(organisations);
    expect(await discoveredOrganisations('another-user')).toEqual([]);
    mocks.cookies.mockResolvedValue({get:()=>({value:seal({userId:'owner',expires:0,organisations},key)})});
    expect(await discoveredOrganisations('owner')).toEqual([]);
  });
  it('ignores metadata once pinned, when discovery is disabled, or when tampered',async()=>{
    mocks.cookies.mockResolvedValue({get:()=>({value:'tampered'})});
    expect(await discoveredOrganisations('owner')).toEqual([]);
    vi.stubEnv('XERO_DISCOVERY','false');
    expect(await discoveredOrganisations('owner')).toEqual([]);
    vi.stubEnv('XERO_TENANT_ID',organisations[0].tenantId);
    expect(await discoveredOrganisations('owner')).toEqual([]);
  });
});
