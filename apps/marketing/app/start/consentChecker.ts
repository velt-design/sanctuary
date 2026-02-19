import type { PublicAccess, SiteAttachment, SiteLevel } from './startFlowContent';

export type ConsentResultCode =
  | 'likely_exempt_unroofed_pergola'
  | 'likely_exempt_porch_veranda_upto_20'
  | 'possibly_exempt_with_professional_signoff_20_to_30'
  | 'building_consent_likely_required';

export type ConsentCheckInput = {
  roofed: boolean;
  attached: SiteAttachment | null;
  level: SiteLevel | null;
  publicAccess: PublicAccess | null;
  areaM2: number | null;
};

export type ConsentCheckResult = {
  code: ConsentResultCode;
  title: string;
  reasons: string[];
  areaM2: number | null;
  nextStep: string;
};

const NEXT_STEP_TEXT = "We'll confirm consent and engineering needs during design sign-off.";

function baseResult(
  code: ConsentResultCode,
  title: string,
  areaM2: number | null,
  reasons: string[]
): ConsentCheckResult {
  return {
    code,
    title,
    areaM2,
    reasons,
    nextStep: NEXT_STEP_TEXT,
  };
}

export function evaluateConsentQuickCheck(input: ConsentCheckInput): ConsentCheckResult {
  const areaText = input.areaM2 == null ? 'unknown' : `${input.areaM2.toFixed(1)}m^2`;

  if (!input.roofed) {
    return baseResult('likely_exempt_unroofed_pergola', 'Likely exempt (pergola - unroofed)', input.areaM2, [
      'Structure is treated as unroofed pergola.',
      'Schedule 1 pergola exemption has no size limit when unroofed.',
      `Calculated area: ${areaText}.`,
    ]);
  }

  if (input.publicAccess === 'yes') {
    return baseResult('building_consent_likely_required', 'Building consent likely required', input.areaM2, [
      'Area is accessible by the public.',
      'Porch/veranda exemptions do not apply where publicly accessible.',
      `Calculated area: ${areaText}.`,
    ]);
  }

  if (input.attached !== 'attached') {
    return baseResult(
      'building_consent_likely_required',
      'Building consent likely required (or needs checking)',
      input.areaM2,
      [
        'Porch/veranda exemption requires the structure to be on or attached to an existing building.',
        `Attachment status is ${input.attached ?? 'unknown'}.`,
        `Calculated area: ${areaText}.`,
      ]
    );
  }

  if (input.areaM2 == null || !Number.isFinite(input.areaM2) || input.areaM2 <= 0) {
    return baseResult(
      'building_consent_likely_required',
      'Building consent likely required (or needs checking)',
      null,
      [
        'Area is required to assess the 20m^2 and 30m^2 thresholds.',
        'Provide length and projection to complete this quick-check.',
      ]
    );
  }

  if (input.areaM2 <= 20) {
    if (input.level === 'ground' || input.level === 'first') {
      return baseResult(
        'likely_exempt_porch_veranda_upto_20',
        'Likely exempt (porch/veranda <=20m^2)',
        input.areaM2,
        [
          'Roofed structure is attached to an existing building.',
          'Area is at or below 20m^2.',
          `Level is ${input.level === 'ground' ? 'ground' : 'first-storey'}.`,
        ]
      );
    }

    return baseResult('building_consent_likely_required', 'Building consent likely required', input.areaM2, [
      'For <=20m^2 roofed exemptions, level must be ground or first-storey.',
      `Current level is ${input.level ?? 'unknown'}.`,
      `Calculated area: ${input.areaM2.toFixed(1)}m^2.`,
    ]);
  }

  if (input.areaM2 > 20 && input.areaM2 <= 30) {
    if (input.level === 'ground') {
      return baseResult(
        'possibly_exempt_with_professional_signoff_20_to_30',
        'Possibly exempt with professional sign-off (20-30m^2)',
        input.areaM2,
        [
          'Roofed structure is attached to an existing building.',
          'Area is between 20m^2 and 30m^2.',
          'Ground-level only, with professional sign-off requirements.',
        ]
      );
    }

    return baseResult('building_consent_likely_required', 'Building consent likely required', input.areaM2, [
      '20-30m^2 exemption pathway generally applies at ground level only.',
      `Current level is ${input.level ?? 'unknown'}.`,
      `Calculated area: ${input.areaM2.toFixed(1)}m^2.`,
    ]);
  }

  return baseResult('building_consent_likely_required', 'Building consent likely required', input.areaM2, [
    'Area is above 30m^2.',
    `Calculated area: ${input.areaM2.toFixed(1)}m^2.`,
    'This exceeds the quick-check exemption thresholds.',
  ]);
}
