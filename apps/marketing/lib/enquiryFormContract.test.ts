import { describe, expect, it } from 'vitest';
import { ENQUIRY_ATTACHMENT_HELP_TEXT, getEnquiryContextDisplay, validateEnquiryForm } from './enquiryFormContract';

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('enquiry form contract', () => {
  it('requires only the fields required by the enquiry API', () => {
    expect(validateEnquiryForm(formData({}), [])).toEqual({
      enquiryType: 'Choose a project type.',
      name: 'Enter your name.',
      phone: 'Enter your phone number.',
    });
    expect(
      validateEnquiryForm(
        formData({
          enquiryType: 'commercial',
          name: 'A Customer',
          phone: '021 123 4567',
        }),
        [],
      ),
    ).toEqual({});
  });

  it('keeps email optional but validates it when supplied', () => {
    expect(
      validateEnquiryForm(
        formData({
          enquiryType: 'professional',
          name: 'A Designer',
          phone: '021 123 4567',
          email: 'not-an-email',
        }),
        [],
      ),
    ).toEqual({
      email: 'Enter a valid email address or leave this field blank.',
    });
  });

  it('uses the governed attachment policy and describes all limits', () => {
    const executable = new File([new Uint8Array([1])], 'payload.exe', {
      type: 'application/x-msdownload',
    });
    expect(
      validateEnquiryForm(
        formData({
          enquiryType: 'residential',
          name: 'A Customer',
          phone: '021 123 4567',
        }),
        [executable],
      ),
    ).toEqual({
      files: 'Attachments must be PDF, JPG, PNG, or WebP files with matching file extensions.',
    });
    expect(ENQUIRY_ATTACHMENT_HELP_TEXT).toBe('Up to 8 PDF, JPG, JPEG, PNG or WebP files, 20 MB total.');
  });

  it('builds consistent audience and item context for forms and success states', () => {
    expect(
      getEnquiryContextDisplay(
        {
          enquiryType: 'commercial',
          sourcePath: '/projects/goodhome-commercial-terrace',
          sourceComponent: 'project_cta',
          sourceProject: 'goodhome-commercial-terrace',
        },
        { sourceProjectLabel: 'The Good Home Takanini' },
      ),
    ).toEqual({
      isVisible: true,
      heading: 'Project: The Good Home Takanini',
      audience: 'Commercial enquiry',
    });

    expect(getEnquiryContextDisplay({})).toEqual({
      isVisible: false,
      heading: '',
      audience: '',
    });

    expect(
      getEnquiryContextDisplay({
        sourcePath: '/pergolas-auckland',
        sourceComponent: 'embedded_form',
      }),
    ).toEqual({
      isVisible: false,
      heading: '',
      audience: '',
    });

    expect(getEnquiryContextDisplay({ enquiryType: 'residential' })).toEqual({
      isVisible: true,
      heading: 'Residential project',
      audience: '',
    });
  });
});
