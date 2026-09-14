import { describe,it,expect,afterEach,vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { config,isDeveloper,seal,unseal,XERO_SCOPES } from './security';
import { reviewQuery } from './review';

afterEach(()=>vi.unstubAllEnvs());
describe('Xero boundary',()=>{
  it('requires Jordan verified identity, independent of ordinary admin role',()=>{
    expect(isDeveloper({email:'info@sanctuarypergolas.co.nz',email_confirmed_at:'today'})).toBe(false);
    expect(isDeveloper({email:'jordan@sanctuarypergolas.co.nz'})).toBe(false);
    expect(isDeveloper({email:'jordan@sanctuarypergolas.co.nz.evil',email_confirmed_at:'today'})).toBe(false);
    expect(isDeveloper({email:'Jordan@sanctuarypergolas.co.nz',email_confirmed_at:'today'})).toBe(true);
  });
  it('encrypts credentials and rejects tampering or wrong keys',()=>{
    const key=randomBytes(32); const sealed=seal({refreshToken:'private-refresh'},key);
    expect(sealed).not.toContain('private-refresh');
    expect(unseal(sealed,key)).toEqual({refreshToken:'private-refresh'});
    expect(()=>unseal(sealed,randomBytes(32))).toThrow();
    const bytes=Buffer.from(sealed,'base64url');bytes[30]^=1;
    expect(()=>unseal(bytes.toString('base64url'),key)).toThrow();
  });
  it('requests read scopes only and never opens an arbitrary provider query',()=>{
    expect(XERO_SCOPES.split(' ').filter(s=>s.startsWith('accounting.')).every(s=>s.endsWith('.read'))).toBe(true);
    expect(reviewQuery('invoice','INV-0033').where).toContain('InvoiceNumber=="INV-0033"');
    expect(reviewQuery('receipt','Peter Harvey').where).toContain('Contact.Name=="Peter Harvey"');
    expect(()=>reviewQuery('Payments','Peter')).toThrow();
  });
  it('fails closed without explicit activation',()=>{vi.stubEnv('XERO_ENABLED','false');expect(()=>config()).toThrow('XERO_DISABLED');});
});
