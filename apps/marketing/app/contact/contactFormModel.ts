import { validateEnquiryAttachments } from '../../lib/enquiryAttachments';
import type { EnquiryAudience } from '../../lib/enquiryContext';
import type { EnquiryType } from './enquiryRoute';

export type ContactField =
  | 'enquiryType'
  | 'name'
  | 'phone'
  | 'email'
  | 'files';

export type ContactFieldErrors = Partial<Record<ContactField, string>>;

export function validateContactForm(
  formData: FormData,
  files: File[],
): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  const enquiryType = String(formData.get('enquiryType') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();

  if (!enquiryType) errors.enquiryType = 'Choose a project type.';
  if (!name) errors.name = 'Enter your name.';
  if (!phone) errors.phone = 'Enter your phone number.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address or leave this field blank.';
  }

  const fileError = validateEnquiryAttachments(files);
  if (fileError) errors.files = fileError;
  return errors;
}

export function enquiryTypeValue(type: EnquiryType | null): EnquiryAudience | '' {
  return type ? type.toLowerCase() as EnquiryAudience : '';
}
