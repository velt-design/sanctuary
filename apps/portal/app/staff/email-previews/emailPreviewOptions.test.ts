import { describe, expect, it } from 'vitest';
import {
  previewBlindsOptions,
  previewConfigurationErrorMessage,
  previewConfigurationMessage,
  previewCustomerTypes,
  previewRoofForms,
  previewVariantForSelection,
} from './emailPreviewOptions';

describe('email preview options', () => {
  it('creates 16 configurable fixtures plus the fixed professional fixture', () => {
    const configurable = previewCustomerTypes
      .filter((customerType) => customerType.value !== 'professional')
      .flatMap((customerType) =>
        previewRoofForms.flatMap((roofForm) =>
          previewBlindsOptions.map((blinds) =>
            previewVariantForSelection(customerType.value, roofForm.value, blinds.value),
          ),
        ),
      );
    const variants = [...configurable, previewVariantForSelection('professional', 'gable', 'with-blinds')];

    expect(variants).toHaveLength(17);
    expect(new Set(variants).size).toBe(17);
    expect(variants).toContain('residential-box-perimeter-with-blinds');
    expect(variants).toContain('commercial-hip-without-blinds');
    expect(variants).toContain('professional');
  });

  it('turns every disabled-send reason into an actionable staff message', () => {
    expect(previewConfigurationMessage('missing_api_key')).toContain(
      'RESEND_API_KEY_PREVIEW',
    );
    expect(previewConfigurationMessage('missing_api_key')).toContain(
      'actual Resend secret value',
    );
    expect(previewConfigurationMessage('missing_recipient')).toContain(
      'EMAIL_PREVIEW_TO',
    );
    expect(previewConfigurationMessage('invalid_recipient')).toContain(
      'one valid email address',
    );
    expect(previewConfigurationMessage('disabled')).toContain(
      'EMAIL_PREVIEW_ENABLED=true',
    );
  });

  it('explains safe API configuration failures instead of returning a generic error', () => {
    expect(
      previewConfigurationErrorMessage({
        code: 'EMAIL_PREVIEW_CONFIGURATION_MISSING',
        configurationReason: 'missing_api_key',
      }),
    ).toContain('RESEND_API_KEY_PREVIEW');
    expect(
      previewConfigurationErrorMessage({ code: 'EMAIL_PREVIEW_DISABLED' }),
    ).toContain('EMAIL_PREVIEW_ENABLED=true');
    expect(previewConfigurationErrorMessage({ code: 'OTHER' })).toBeNull();
  });
});
