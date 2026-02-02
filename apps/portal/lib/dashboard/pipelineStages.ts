export type PipelineStageId =
  | 'NEW'
  | 'CONTACTED'
  | 'SITE_VISIT'
  | 'QUOTING'
  | 'SENT'
  | 'DEPOSIT'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'PAID';

export const PIPELINE_STAGES: Array<{ id: PipelineStageId; label: string }> = [
  { id: 'NEW', label: 'New' },
  { id: 'CONTACTED', label: 'Contacted' },
  { id: 'SITE_VISIT', label: 'Site visit' },
  { id: 'QUOTING', label: 'Quoting' },
  { id: 'SENT', label: 'Sent' },
  { id: 'DEPOSIT', label: 'Deposit' },
  { id: 'SCHEDULED', label: 'Scheduled' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'PAID', label: 'Paid' },
] as const;

const ALIASES: Record<string, PipelineStageId> = {
  'SITE VISIT': 'SITE_VISIT',
  'SITE VISITS': 'SITE_VISIT',
  QUOTE: 'QUOTING',
  QUOTES: 'QUOTING',
};

export type PipelineStageCounts = Partial<Record<PipelineStageId, number>>;

export function normalizePipelineStageId(raw: string): PipelineStageId | null {
  if (!raw) return null;

  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[_\s]+/g, ' ');

  if (ALIASES[cleaned]) return ALIASES[cleaned];

  const underscore = cleaned.replace(/\s+/g, '_');

  switch (underscore) {
    case 'NEW':
    case 'CONTACTED':
    case 'SITE_VISIT':
    case 'QUOTING':
    case 'SENT':
    case 'DEPOSIT':
    case 'SCHEDULED':
    case 'COMPLETED':
    case 'PAID':
      return underscore;
    default:
      return null;
  }
}

export function toCanonicalStageCounts(input: Record<string, number> | null | undefined): PipelineStageCounts {
  const out: PipelineStageCounts = {};

  for (const [rawKey, value] of Object.entries(input ?? {})) {
    const id = normalizePipelineStageId(rawKey);
    if (!id) continue;
    const n = typeof value === 'number' ? value : Number(value ?? 0);
    out[id] = (out[id] ?? 0) + (Number.isFinite(n) ? n : 0);
  }

  return out;
}
