export const PIPELINE_STAGES = [
  { key: 'NEW', label: 'NEW' },
  { key: 'CONTACTED', label: 'CONTACTED' },
  { key: 'SITE_VISIT', label: 'SITE VISIT' },
  { key: 'QUOTING', label: 'QUOTING' },
  { key: 'SENT', label: 'SENT' },
  { key: 'DEPOSIT', label: 'DEPOSIT' },
  { key: 'SCHEDULED', label: 'SCHEDULED' },
  { key: 'COMPLETED', label: 'COMPLETED' },
  { key: 'PAID', label: 'PAID' },
] as const;

export function normalizeStageKey(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '_');
}
