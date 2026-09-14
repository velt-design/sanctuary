import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { seal,unseal } from './security';
const mocks=vi.hoisted(()=>({postgres:vi.fn(),token:vi.fn(),connections:vi.fn(),read:vi.fn()}));
vi.mock('postgres',()=>({default:mocks.postgres}));
vi.mock('./provider',async importOriginal=>({...await importOriginal<typeof import('./provider')>(),tokenRequest:mocks.token,connections:mocks.connections,accountingRead:mocks.read}));
import { access,connect,readAccounting } from './store';
import { XeroError } from './provider';
import { supabaseCa } from './supabaseCa';

const tenant='11111111-1111-4111-8111-111111111111';const key=Buffer.alloc(32,1);
let row: {tenant_id:string;encrypted_tokens:string;last_error:string|null};
let writes:string[];let failSave=false;
beforeEach(()=>{
  vi.resetAllMocks();writes=[];failSave=false;
  for(const [name,value] of Object.entries({XERO_ENABLED:'true',XERO_PORTAL_ORIGIN:'https://portal.example.test',XERO_TOKEN_ENCRYPTION_KEY:key.toString('base64'),XERO_TENANT_ID:tenant,XERO_DATABASE_URL:'postgres://test@localhost/test',XERO_CLIENT_ID:'id',XERO_CLIENT_SECRET:'secret'}))vi.stubEnv(name,value);
  row={tenant_id:tenant,encrypted_tokens:seal({accessToken:'expired',refreshToken:'original',expiresAt:0},key),last_error:null};
  const sql=Object.assign(async(strings:TemplateStringsArray,...values:unknown[])=>{
    const query=strings.join('?');writes.push(query);
    if(query.includes('from pg_roles where'))return[{connector:true,only_connector:true}];
    if(query.includes('select *'))return[row];
    if(query.includes('set encrypted_tokens')){if(failSave)throw new Error('DB_WRITE_FAILURE');row.encrypted_tokens=String(values[0]);}
    if(query.includes('set last_error='))row.last_error=String(values[0]);
    return[];
  },{begin:async(fn:(tx:unknown)=>Promise<unknown>)=>fn(sql),end:vi.fn()});
  mocks.postgres.mockReturnValue(sql);
});
afterEach(()=>vi.unstubAllEnvs());
describe('durable Xero renewal',()=>{
  it('persists a rejected unexpired access token and prevents repeated reads',async()=>{
    row.encrypted_tokens=seal({accessToken:'rejected',refreshToken:'r',expiresAt:Date.now()+1800000},key);
    mocks.read.mockRejectedValue(new XeroError('RECONNECT_REQUIRED'));
    await expect(readAccounting('Invoices','InvoiceNumber=="INV-0033"')).rejects.toThrow('RECONNECT_REQUIRED');
    expect(row.last_error).toBe('RECONNECT_REQUIRED');
    await expect(readAccounting('Invoices','InvoiceNumber=="INV-0033"')).rejects.toThrow('RECONNECT_REQUIRED');
    expect(mocks.read).toHaveBeenCalledOnce();expect(mocks.token).not.toHaveBeenCalled();
    expect(writes.some(s=>s.includes('insert into xero_private.events'))).toBe(true);
  });
  it('does not invalidate a newer connection after an older read is rejected',async()=>{
    row.encrypted_tokens=seal({accessToken:'old',refreshToken:'r',expiresAt:Date.now()+1800000},key);
    mocks.read.mockImplementation(async()=>{
      row.encrypted_tokens=seal({accessToken:'new',refreshToken:'new-r',expiresAt:Date.now()+1800000},key);
      throw new XeroError('RECONNECT_REQUIRED');
    });
    await expect(readAccounting('Invoices','InvoiceNumber=="INV-0033"')).rejects.toThrow('RECONNECT_REQUIRED');
    expect(row.last_error).toBeNull();expect((await access()).accessToken).toBe('new');
  });
  it('keeps a connection usable after a transient accounting failure',async()=>{
    row.encrypted_tokens=seal({accessToken:'valid',refreshToken:'r',expiresAt:Date.now()+1800000},key);
    mocks.read.mockRejectedValueOnce(new XeroError('READ_FAILED')).mockResolvedValueOnce([]);
    await expect(readAccounting('Invoices','InvoiceNumber=="INV-0033"')).rejects.toThrow('READ_FAILED');
    expect(row.last_error).toBeNull();
    await expect(readAccounting('Invoices','InvoiceNumber=="INV-0033"')).resolves.toEqual([]);
  });
  it('adds the official Supabase CA only for managed hosts and keeps certificate verification enabled',async()=>{
    mocks.token.mockResolvedValue({accessToken:'new',refreshToken:'rotated',expiresAt:Date.now()+1800000});
    vi.stubEnv('XERO_DATABASE_URL','postgres://test@aws-0-ap-northeast-1.pooler.supabase.com/test?sslmode=verify-full');
    await access();
    expect(mocks.postgres.mock.calls[0][1].ssl).toMatchObject({rejectUnauthorized:true,ca:expect.arrayContaining([supabaseCa])});
    vi.stubEnv('XERO_DATABASE_URL','postgres://test@aws-0.pooler.supabase.com.example.test/test?sslmode=verify-full');
    await access();
    expect(mocks.postgres.mock.calls[1][1].ssl).toBe('verify-full');
  });
  it('discovery cannot retain tokens or use an existing accounting connection',async()=>{
    vi.stubEnv('XERO_TENANT_ID','');vi.stubEnv('XERO_DISCOVERY','true');
    await expect(access()).rejects.toThrow('XERO_ORGANISATION_NOT_PINNED');
    await expect(connect({accessToken:'a',refreshToken:'r',expiresAt:1},'user')).rejects.toThrow('XERO_ORGANISATION_NOT_PINNED');
    expect(mocks.postgres).not.toHaveBeenCalled();expect(mocks.connections).not.toHaveBeenCalled();expect(mocks.token).not.toHaveBeenCalled();
  });
  it('locks the connection and saves rotated credentials before returning access',async()=>{
    mocks.token.mockResolvedValue({accessToken:'new',refreshToken:'rotated',expiresAt:Date.now()+1800000});
    expect((await access()).accessToken).toBe('new');
    expect(unseal(row.encrypted_tokens,key)).toMatchObject({refreshToken:'rotated'});
    expect(writes.findIndex(s=>s.includes('for update'))).toBeLessThan(writes.findIndex(s=>s.includes('set encrypted_tokens')));
    await access();expect(mocks.token).toHaveBeenCalledOnce();
  });
  it('does not return success when saving rotated credentials fails',async()=>{
    failSave=true;mocks.token.mockResolvedValue({accessToken:'new',refreshToken:'rotated',expiresAt:Date.now()+1800000});
    await expect(access()).rejects.toThrow('CONNECTION_UNAVAILABLE');
  });
  it('records revoked access and prevents repeated invalid refreshes',async()=>{
    mocks.token.mockRejectedValue(new XeroError('RECONNECT_REQUIRED'));
    await expect(access()).rejects.toThrow('RECONNECT_REQUIRED');
    expect(row.last_error).toBe('RECONNECT_REQUIRED');
    await expect(access()).rejects.toThrow('RECONNECT_REQUIRED');expect(mocks.token).toHaveBeenCalledOnce();
  });
  it('refuses an unexpected organisation without saving it',async()=>{
    mocks.connections.mockResolvedValue([{tenantId:'another-tenant',tenantName:'Other business'}]);
    await expect(connect({accessToken:'a',refreshToken:'r',expiresAt:1},'user')).rejects.toThrow('XERO_WRONG_ORGANISATION');
    expect(mocks.postgres).not.toHaveBeenCalled();
  });
});
