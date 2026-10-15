import { describe, expect, it } from 'vitest';
import { validateContactForm } from './contactFormModel';

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('contact form model', () => {
  it.each(['/ads/outdoor-living', '/ads/acrylic-pergolas', '/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland'])('keeps phone optional and suburb required for the direct %s enquiry', page => {
    const values = { page, enquiryType: 'residential', name: 'Alex', phone: '', email: 'alex@example.test', suburb: 'Albany' };
    expect(validateContactForm(formData(values), [])).toEqual({});
    expect(validateContactForm(formData({ ...values, phone: 'bad' }), [])).toEqual({ phone: 'Enter a valid phone number.' });
    expect(validateContactForm(formData({ ...values, suburb: '' }), [])).toEqual({ suburb: 'Enter your suburb.' });
    for (const existing of ['/contact', '/auckland-outdoor-living-extra', '/acrylic-roof-pergolas-auckland/', '/ads/acrylic-pergolas-extra']) {
      expect(validateContactForm(formData({ ...values, page: existing }), [])).toEqual({ phone: 'Enter your phone number.' });
    }
    expect(validateContactForm(formData({ ...values, enquiryType: 'commercial' }), [])).toEqual({ phone: 'Enter your phone number.' });
  });
  it('requires a site address for measures but permits an early discussion without one', () => {
    const values = { enquiryType: 'residential', name: 'Alex', phone: '0211234567', email: 'alex@example.test' };
    expect(validateContactForm(formData({ ...values, requestType: 'site-measure', suburb: '  ' }), [])).toEqual({ suburb: 'Enter the site address for your measure request.' });
    expect(validateContactForm(formData({ ...values, requestType: 'project-discussion' }), [])).toEqual({});
    expect(validateContactForm(formData({ ...values, requestType: 'site-measure', suburb: '12 Example Street, Auckland' }), [])).toEqual({});
  });
  it('requires both contact methods alongside the project type and name', () => {
    expect(validateContactForm(formData({}), [])).toEqual({
      enquiryType: 'Choose a project type.',
      name: 'Enter your name.',
      phone: 'Enter your phone number.',
      email: 'Enter your email address.',
    });
    expect(
      validateContactForm(
        formData({
          enquiryType: 'residential',
          name: 'A Customer',
          phone: '021 123 4567',
          email: 'customer@example.com',
        }),
        [],
      ),
    ).toEqual({});
  });

  it('explains invalid contact details', () => {
    expect(
      validateContactForm(
        formData({
          enquiryType: 'commercial',
          name: 'A Customer',
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

  it('surfaces the governed attachment policy message', () => {
    const executable = new File([new Uint8Array([1])], 'payload.exe', {
      type: 'application/x-msdownload',
    });
    expect(
      validateContactForm(
        formData({
          enquiryType: 'professional',
          name: 'A Designer',
          phone: '021 123 4567',
          email: 'designer@example.com',
        }),
        [executable],
      ),
    ).toEqual({
      files: 'Attachments must be PDF, JPG, PNG, or WebP files with matching file extensions.',
    });
  });
});
