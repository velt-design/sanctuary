import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FrozenSimpleCoverPricingResult } from './simpleCoverPricing.server';
import {
  hashFrozenSimpleCoverPricingResult,
  issueSimpleCoverCalculationRef,
  readSimpleCoverCalculationRef,
} from './simpleCoverCalculationRef.server';

const NOW_MS = Date.UTC(2026, 7, 6, 1, 2, 3);

function frozenResult(): FrozenSimpleCoverPricingResult {
  return {
    schemaVersion: 'simple-cover-pricing.v1',
    input: {
      widthMm: 6_000,
      projectionMm: 3_000,
      level: 'elevated',
      connection: 'soffit',
    },
    siteInputs: { pergolas: [] },
    siteOutput: {
      totals: { cost_ex_gst: 10_000, cost_inc_gst: 11_500 },
      materials: { lines: [] },
      install: { actions: [] },
      overhead: {},
      pergolas: [],
    },
    customerPrice: {
      exactExGst: 20_000,
      exactIncGst: 23_000,
      displayedFromIncGst: 23_000,
    },
    costingConfiguration: {
      schemaVersion: 'costing-provenance.v1',
      source: 'published',
      versionId: '11111111-1111-4111-8111-111111111111',
      versionNumber: 17,
      contentHash: 'a'.repeat(64),
      baseManifestVersion: 'v2.2',
    },
    publicResult: {
      ok: true,
      status: 'priced',
      input: {
        widthMm: 6_000,
        projectionMm: 3_000,
        level: 'elevated',
        connection: 'soffit',
      },
      areaM2: 18,
      postCount: 3,
      postSpacingMm: 3_000,
      plan: { postPositions: [0, 0.5, 1], rafterPositions: [0, 0.5, 1] },
      price: { fromIncGst: 23_000, currency: 'NZD' },
      configuration: { versionNumber: 17 },
    },
  } as unknown as FrozenSimpleCoverPricingResult;
}

describe('Simple cover calculation references', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('issues an opaque authenticated token and round-trips only continuity claims', () => {
    const frozen = frozenResult();
    const token = issueSimpleCoverCalculationRef(frozen, {
      secret: 'secret-one',
      nowMs: NOW_MS,
    });
    const claims = readSimpleCoverCalculationRef(token, {
      secret: 'secret-one',
      nowMs: NOW_MS,
    });

    expect(token).toMatch(/^sc1\.[A-Za-z0-9_-]+$/);
    expect(token.length).toBeLessThan(2_048);
    expect(token).not.toContain(frozen.costingConfiguration.versionId);
    expect(claims).toEqual({
      schemaVersion: 'simple-cover-calculation-ref.v1',
      input: frozen.input,
      costingConfiguration: frozen.costingConfiguration,
      issuedAt: Math.floor(NOW_MS / 1_000),
      frozenResultHash: hashFrozenSimpleCoverPricingResult(frozen),
    });
  });

  it.each([
    ['tampered', (token: string) => `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`, 'secret-one'],
    ['wrong secret', (token: string) => token, 'secret-two'],
    ['malformed', () => 'sc1.not+base64url', 'secret-one'],
    ['oversized', () => `sc1.${'a'.repeat(2_048)}`, 'secret-one'],
  ])('rejects a %s reference without throwing', (_label, mutate, secret) => {
    const token = issueSimpleCoverCalculationRef(frozenResult(), {
      secret: 'secret-one',
      nowMs: NOW_MS,
    });
    expect(readSimpleCoverCalculationRef(mutate(token), { secret, nowMs: NOW_MS })).toBeNull();
  });

  it('hashes the full frozen snapshot deterministically and detects any changed result field', () => {
    const left = frozenResult();
    const reordered = {
      ...left,
      input: {
        connection: left.input.connection,
        level: left.input.level,
        projectionMm: left.input.projectionMm,
        widthMm: left.input.widthMm,
      },
    };
    const changed = {
      ...left,
      customerPrice: { ...left.customerPrice, displayedFromIncGst: 23_250 },
    };

    expect(hashFrozenSimpleCoverPricingResult(reordered)).toBe(hashFrozenSimpleCoverPricingResult(left));
    expect(hashFrozenSimpleCoverPricingResult(changed)).not.toBe(hashFrozenSimpleCoverPricingResult(left));
  });

  it('fails closed in production when the server secret is missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => issueSimpleCoverCalculationRef(frozenResult(), { nowMs: NOW_MS })).toThrow(
      'Simple cover calculation continuity is unavailable.',
    );
  });
});
