import { describe, expect, it, vi } from 'vitest';

import {
  redactEvidenceValue,
  redactSensitiveText,
  resolvePortalEvidenceMode,
  sanitizeUrlForEvidence,
  shouldAttachRichPortalEvidence,
} from './portalBrowserEvidence';

describe('portalBrowserEvidence', () => {
  it('defaults to lightweight evidence mode unless explicitly set to full', () => {
    expect(resolvePortalEvidenceMode({} as NodeJS.ProcessEnv)).toBe('default');
    expect(resolvePortalEvidenceMode({ PORTAL_EVIDENCE_MODE: 'default' } as NodeJS.ProcessEnv)).toBe('default');
    expect(resolvePortalEvidenceMode({ PORTAL_EVIDENCE_MODE: 'full' } as NodeJS.ProcessEnv)).toBe('full');
  });

  it('attaches rich evidence for failed tests or full mode', () => {
    expect(shouldAttachRichPortalEvidence({ status: 'passed', expectedStatus: 'passed' } as any)).toBe(false);
    expect(shouldAttachRichPortalEvidence({ status: 'failed', expectedStatus: 'passed' } as any)).toBe(true);
    expect(shouldAttachRichPortalEvidence(undefined, true)).toBe(true);

    vi.stubEnv('PORTAL_EVIDENCE_MODE', 'full');
    expect(shouldAttachRichPortalEvidence({ status: 'passed', expectedStatus: 'passed' } as any)).toBe(true);
    vi.unstubAllEnvs();
  });

  it('redacts known secrets and sensitive query parameters', () => {
    vi.stubEnv('PORTAL_TEST_PASSWORD', 'super-secret-password');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-secret');

    expect(redactSensitiveText('password=super-secret-password token=service-role-secret')).toContain('[REDACTED]');
    expect(sanitizeUrlForEvidence('https://example.test/path?token=abc123&safe=value')).toBe(
      'https://example.test/path?token=[REDACTED]&safe=value',
    );
    expect(
      redactEvidenceValue({
        nested: {
          serviceRoleKey: 'service-role-secret',
          message: 'password=super-secret-password',
        },
      }),
    ).toEqual({
      nested: {
        serviceRoleKey: '[REDACTED]',
        message: 'password=[REDACTED]',
      },
    });

    vi.unstubAllEnvs();
  });
});
