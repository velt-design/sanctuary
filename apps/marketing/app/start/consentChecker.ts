import type { PublicAccess, SiteAttachment, SiteLevel } from './startFlowContent';

type ConsentResultCode = 'project_specific_review';

type ConsentCheckInput = {
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

const CONSENT_REVIEW_TEXT =
  "Consent depends on the final design and property. We'll identify the checks needed for your project.";

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
    nextStep: CONSENT_REVIEW_TEXT,
  };
}

export function evaluateConsentQuickCheck(input: ConsentCheckInput): ConsentCheckResult {
  return baseResult(
    'project_specific_review',
    'Project-specific review',
    input.areaM2,
    [CONSENT_REVIEW_TEXT]
  );
}
