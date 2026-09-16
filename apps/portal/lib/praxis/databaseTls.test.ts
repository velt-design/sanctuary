import { X509Certificate } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { praxisDatabaseTls } from './databaseTls';
import { supabaseCa } from '../xero/supabaseCa';

describe('Praxis database TLS trust', () => {
  it('trusts the verified Supabase public root only on explicit managed hostnames', () => {
    expect(new X509Certificate(supabaseCa).fingerprint256.replaceAll(':', '')).toBe('807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA');
    for (const hostname of ['aws-1-ap-south-1.pooler.supabase.com', 'db.iytanftukulcnavossmd.supabase.co']) {
      expect(praxisDatabaseTls(`postgres://reader@${hostname}/postgres`, 'verify-full')).toMatchObject({ rejectUnauthorized: true, ca: expect.arrayContaining([supabaseCa]) });
    }
    for (const hostname of ['db.example.com', 'pooler.supabase.com.evil.test', 'evil-supabase.com', 'localhost']) {
      expect(praxisDatabaseTls(`postgres://reader@${hostname}/postgres`, 'verify-full')).toBe('verify-full');
    }
  });

  it('preserves the validated disposable-local non-TLS mode', () => {
    expect(praxisDatabaseTls('postgres://reader@127.0.0.1/postgres', false)).toBe(false);
  });
});
