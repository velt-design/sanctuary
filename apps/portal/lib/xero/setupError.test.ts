import { describe, expect, it } from 'vitest';
import { setupError } from './setupError';

describe('developer setup diagnostics', () => {
  it('distinguishes configuration, credentials, permissions and TLS failures', () => {
    expect(setupError(new Error('XERO_NOT_CONFIGURED'))).toContain('setting is missing');
    expect(setupError({ code: '28P01', message: 'private database details' })).toContain('rejected the connector password');
    expect(setupError({ code: '42501' })).toContain('permission');
    expect(setupError({ code: 'SELF_SIGNED_CERT_IN_CHAIN' })).toContain('certificate chain');
  });
  it('never reflects unrecognised messages or inherited properties', () => {
    for (const error of [null, new Error('postgres://user:secret@private-host/db'), { code: 'toString' }, 'private']) {
      expect(setupError(error)).toBe('Connection setup failed; further diagnosis is required.');
    }
  });
});
