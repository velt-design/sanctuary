import { describe, expect, it } from 'vitest';
import { enquiryTypeValue, validateContactForm } from './contactFormModel';

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('contact form model', () => {
  it('requires only the fields required by the enquiry API', () => {
    expect(validateContactForm(formData({}), [])).toEqual({
      enquiryType: 'Choose a project type.',
      name: 'Enter your name.',
      phone: 'Enter your phone number.',
    });
    expect(validateContactForm(formData({
      enquiryType: 'residential',
      name: 'A Customer',
      phone: '021 123 4567',
    }), [])).toEqual({});
  });

  it('allows an omitted email and explains an invalid one', () => {
    expect(validateContactForm(formData({
      enquiryType: 'commercial',
      name: 'A Customer',
      phone: '021 123 4567',
      email: 'not-an-email',
    }), [])).toEqual({
      email: 'Enter a valid email address or leave this field blank.',
    });
  });

  it('surfaces the governed attachment policy message', () => {
    const executable = new File(
      [new Uint8Array([1])],
      'payload.exe',
      { type: 'application/x-msdownload' },
    );
    expect(validateContactForm(formData({
      enquiryType: 'professional',
      name: 'A Designer',
      phone: '021 123 4567',
    }), [executable])).toEqual({
      files: 'Attachments must be PDF, JPG, PNG, or WebP files with matching file extensions.',
    });
  });

  it('normalises the route-owned enquiry value for the API', () => {
    expect(enquiryTypeValue('Professional')).toBe('professional');
    expect(enquiryTypeValue(null)).toBe('');
  });
});
