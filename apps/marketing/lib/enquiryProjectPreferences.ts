export type EnquiryProjectPreferences = {
  preferredTiming: string | null;
  budgetPreference: 'provided' | 'not-sure' | null;
  budgetHint: string | null;
};

/** Customer preferences inform the conversation; they never change calculated pricing. */
export function normalizeEnquiryProjectPreferences(value: unknown, allowBudget: boolean): EnquiryProjectPreferences {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const text = (value: unknown) => typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 160) || null : null;
  const budgetPreference = allowBudget && input.budgetPreference === 'provided' ? 'provided'
    : allowBudget && input.budgetPreference === 'not-sure' ? 'not-sure' : null;
  return {
    preferredTiming: text(input.preferredTiming), budgetPreference,
    budgetHint: budgetPreference === 'provided' ? text(input.budgetHint) : null,
  };
}
