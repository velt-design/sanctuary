import { describe, expect, it } from 'vitest';
import {
  parseTrackingRegionPolicy,
  resolveTrackingRegionPolicy,
} from './trackingRegion';

describe('tracking region policy', () => {
  it('enables the regional default only for New Zealand', () => {
    expect(resolveTrackingRegionPolicy('NZ')).toBe('nz_automatic');
    expect(resolveTrackingRegionPolicy(' nz ')).toBe('nz_automatic');
    expect(resolveTrackingRegionPolicy('AU')).toBe('consent_required');
  });

  it('requires consent when geography is missing or invalid', () => {
    expect(resolveTrackingRegionPolicy(null)).toBe('consent_required');
    expect(resolveTrackingRegionPolicy(undefined)).toBe('consent_required');
    expect(resolveTrackingRegionPolicy('')).toBe('consent_required');
    expect(parseTrackingRegionPolicy('unknown')).toBeNull();
  });
});
