export const previewCustomerTypes = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'professional', label: 'Professional' },
] as const;

export const previewRoofForms = [
  { value: 'pitched', label: 'Pitched' },
  { value: 'gable', label: 'Gable' },
  { value: 'box-perimeter', label: 'Box perimeter' },
  { value: 'hip', label: 'Hip' },
] as const;

export const previewBlindsOptions = [
  { value: 'without-blinds', label: 'Without blinds' },
  { value: 'with-blinds', label: 'With blinds' },
] as const;

export const previewLayoutIds = [
  'editorial-refined',
  'image-led',
  'compact',
] as const;

export const previewDisplayModeOptions = [
  {
    value: 'compare',
    label: 'Compare',
    description: 'Review all three alternatives together',
  },
  {
    value: 'focus',
    label: 'Focus',
    description: 'Inspect one alternative at a larger scale',
  },
] as const;

export const previewViewportOptions = [
  { value: 'desktop', label: 'Desktop', width: 760, description: '760 px' },
  { value: 'narrow', label: 'Narrow', width: 600, description: '600 px' },
  { value: 'mobile', label: 'Mobile', width: 390, description: '390 px' },
] as const;

export const previewThemeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

export const previewZoomOptions = [
  { value: 50, label: '50%' },
  { value: 75, label: '75%' },
  { value: 100, label: '100%' },
] as const;

export type PreviewCustomerType = (typeof previewCustomerTypes)[number]['value'];
export type PreviewRoofForm = (typeof previewRoofForms)[number]['value'];
export type PreviewBlindsOption = (typeof previewBlindsOptions)[number]['value'];
export type PreviewLayoutId = (typeof previewLayoutIds)[number];
export type PreviewDisplayMode =
  (typeof previewDisplayModeOptions)[number]['value'];
export type PreviewViewport = (typeof previewViewportOptions)[number]['value'];
export type PreviewTheme = (typeof previewThemeOptions)[number]['value'];
export type PreviewZoom = (typeof previewZoomOptions)[number]['value'];
export type PreviewVariant =
  | `${Exclude<PreviewCustomerType, 'professional'>}-${PreviewRoofForm}-${PreviewBlindsOption}`
  | 'professional';

export type PreviewConfigurationReason =
  | 'ready'
  | 'disabled'
  | 'environment_not_allowed'
  | 'missing_api_key'
  | 'missing_recipient'
  | 'invalid_recipient';

export function previewVariantForSelection(
  customerType: PreviewCustomerType,
  roofForm: PreviewRoofForm,
  blinds: PreviewBlindsOption,
): PreviewVariant {
  return customerType === 'professional'
    ? 'professional'
    : `${customerType}-${roofForm}-${blinds}`;
}

const previewVariants = Object.freeze([
  ...previewCustomerTypes
    .filter((customerType) => customerType.value !== 'professional')
    .flatMap((customerType) =>
      previewRoofForms.flatMap((roofForm) =>
        previewBlindsOptions.map((blinds) =>
          previewVariantForSelection(
            customerType.value,
            roofForm.value,
            blinds.value,
          ),
        ),
      ),
    ),
  'professional',
]) as readonly PreviewVariant[];

export function previewVariantPosition(variant: PreviewVariant): {
  current: number;
  total: number;
} {
  const index = previewVariants.indexOf(variant);
  return {
    current: index >= 0 ? index + 1 : 1,
    total: previewVariants.length,
  };
}

export function previewViewportDefinition(viewport: PreviewViewport) {
  return (
    previewViewportOptions.find((option) => option.value === viewport)
    ?? previewViewportOptions[0]
  );
}

export function previewConfigurationMessage(
  reason: PreviewConfigurationReason,
): string {
  switch (reason) {
    case 'ready':
      return 'Ready to send from this preview deployment.';
    case 'missing_api_key':
      return 'Sending is unavailable because RESEND_API_KEY_PREVIEW is missing from this sanctuary-portal Preview deployment. Add the actual Resend secret value (not its display name) for Preview, then redeploy this branch.';
    case 'missing_recipient':
      return 'Sending is unavailable because EMAIL_PREVIEW_TO is missing from this sanctuary-portal Preview deployment.';
    case 'invalid_recipient':
      return 'Sending is unavailable because EMAIL_PREVIEW_TO must contain one valid email address.';
    case 'disabled':
      return 'Email previews are disabled. Set EMAIL_PREVIEW_ENABLED=true for the sanctuary-portal Preview environment, then redeploy.';
    case 'environment_not_allowed':
      return 'Sending is available only in local development/test or a Vercel Preview deployment.';
  }
}

export function previewConfigurationErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (record.code === 'EMAIL_PREVIEW_DISABLED') {
    return previewConfigurationMessage('disabled');
  }
  if (
    record.code === 'EMAIL_PREVIEW_CONFIGURATION_MISSING'
    && typeof record.configurationReason === 'string'
  ) {
    const reason = record.configurationReason as PreviewConfigurationReason;
    if (
      [
        'missing_api_key',
        'missing_recipient',
        'invalid_recipient',
        'disabled',
        'environment_not_allowed',
      ].includes(reason)
    ) {
      return previewConfigurationMessage(reason);
    }
  }
  return null;
}
