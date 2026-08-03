import { describe, expect, it } from 'vitest';
import { ENQUIRY_ATTACHMENT_HELP_TEXT, getEnquiryContextDisplay, validateEnquiryForm } from './enquiryFormContract';

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('enquiry form contract', () => {
  it('requires both contact methods alongside the project type and name', () => {
    expect(validateEnquiryForm(formData({}), [])).toEqual({
      enquiryType: 'Choose a project type.',
      name: 'Enter your name.',
      phone: 'Enter your phone number.',
      email: 'Enter your email address.',
    });
    expect(
      validateEnquiryForm(
        formData({
          enquiryType: 'commercial',
          name: 'A Customer',
          phone: '021 123 4567',
          email: 'customer@example.com',
        }),
        [],
      ),
    ).toEqual({});
  });

  it('validates email and rejects implausible phone values', () => {
    expect(
      validateEnquiryForm(
        formData({
          enquiryType: 'professional',
          name: 'A Designer',
          phone: 'x',
          email: 'not-an-email',
        }),
        [],
      ),
    ).toEqual({
      phone: 'Enter a valid phone number.',
      email: 'Enter a valid email address.',
    });
  });

  it('accepts plausible local and international phone formats', () => {
    for (const phone of ['021 123 4567', '+61 2 9374 4000', '+44 (0)20 7946 0958']) {
      expect(
        validateEnquiryForm(
          formData({
            enquiryType: 'residential',
            name: 'A Customer',
            phone,
            email: 'customer@example.com',
          }),
          [],
        ),
      ).toEqual({});
    }
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
          email: 'customer@example.com',
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

    expect(getEnquiryContextDisplay({
      enquiryType: 'residential',
      sourceExperience: 'project-finder-home-v1',
      projectDirection: 'outdoor-room',
      projectPriorities: ['entertaining', 'daylight'],
    })).toEqual({
      isVisible: true,
      heading: 'Starting brief: A complete outdoor room',
      audience:
        'Priorities: Plan for cooking or entertaining, Keep natural light · Residential enquiry',
    });

    expect(getEnquiryContextDisplay({
      enquiryType: 'professional',
      sourceExperience: 'project-finder-home-v1',
      projectDirection: 'commercial-professional',
      projectProfessionalPath: 'architects-designers',
    })).toEqual({
      isVisible: true,
      heading: 'Starting brief: Architects and Designers',
      audience:
        'Commercial / Professional · Architects and Designers · Professional enquiry',
    });
  });
});
