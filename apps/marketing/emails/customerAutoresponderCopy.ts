function givenName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.trim().split(/\s+/)[0] ?? '';
}

function personalized(name: unknown, subject: string): string {
  const firstName = givenName(name);
  return firstName ? `${firstName}, ${subject}` : subject[0]!.toUpperCase() + subject.slice(1);
}

export function customerEstimateSubject(
  name: unknown,
  enquiryType: 'residential' | 'commercial',
): string {
  return personalized(
    name,
    enquiryType === 'commercial'
      ? "we've received your commercial pergola enquiry"
      : "we've received your pergola enquiry",
  );
}

export function professionalEnquirySubject(name: unknown): string {
  return personalized(name, "we've received your project enquiry");
}

export function customerEstimatePreheader(
  enquiryType: 'residential' | 'commercial',
  baseRange?: { lowIncGst: number; highIncGst: number },
): string {
  if (!baseRange) {
    return enquiryType === 'commercial'
      ? 'Your commercial project details and the next steps from Sanctuary.'
      : 'Your project details and the next steps from Sanctuary.';
  }
  const amountLabel =
    baseRange.lowIncGst === baseRange.highIncGst
      ? 'indicative installed estimate'
      : 'indicative installed range';
  return enquiryType === 'commercial'
    ? `Your commercial project details, ${amountLabel} and the next steps from Sanctuary.`
    : `Your project details, ${amountLabel} and the next steps from Sanctuary.`;
}

export const PROFESSIONAL_ENQUIRY_PREHEADER =
  'Your brief is with Sanctuary. Review the details received and what happens next.';
