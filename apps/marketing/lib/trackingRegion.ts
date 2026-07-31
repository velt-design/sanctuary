export const TRACKING_REGION_SESSION_KEY = 'sp_tracking_region_v1';

export type TrackingRegionPolicy = 'nz_automatic' | 'consent_required';
export type TrackingBasis = 'none' | 'regional_default' | 'user_choice';

export function resolveTrackingRegionPolicy(
  countryCode: string | null | undefined,
): TrackingRegionPolicy {
  return countryCode?.trim().toUpperCase() === 'NZ'
    ? 'nz_automatic'
    : 'consent_required';
}

export function parseTrackingRegionPolicy(
  value: unknown,
): TrackingRegionPolicy | null {
  return value === 'nz_automatic' || value === 'consent_required'
    ? value
    : null;
}
