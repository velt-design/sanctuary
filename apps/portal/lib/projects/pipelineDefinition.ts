// apps/portal/lib/projects/pipelineDefinition.ts

export const PIPELINE_STAGES = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'site_visit', label: 'Site Visit' },
  { key: 'quoting', label: 'Quoting' },
  { key: 'sent', label: 'Sent' },
  { key: 'deposit', label: 'Deposit' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'paid', label: 'Paid' },
] as const;

export type PipelineStageKey = typeof PIPELINE_STAGES[number]['key'];

type PipelineStageCounts = Partial<Record<PipelineStageKey, number>>;

const STAGE_KEY_SET = new Set<PipelineStageKey>(PIPELINE_STAGES.map((stage) => stage.key));

const STAGE_ALIASES: Record<string, PipelineStageKey> = {
  sitevisit: 'site_visit',
  site_visits: 'site_visit',
  quote: 'quoting',
  quotes: 'quoting',
  follow_up: 'sent',
  followup: 'sent',
  won: 'deposit',
  lost: 'sent',
  archived: 'sent',
};

function normalizeStageInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizePipelineStageKey(raw: string | null | undefined): PipelineStageKey | null {
  if (!raw) return null;
  const cleaned = normalizeStageInput(raw);
  if (!cleaned) return null;
  const alias = STAGE_ALIASES[cleaned];
  if (alias) return alias;
  if (STAGE_KEY_SET.has(cleaned as PipelineStageKey)) return cleaned as PipelineStageKey;
  return null;
}

export const PIPELINE_STAGE_LABELS: Record<PipelineStageKey, string> = Object.fromEntries(
  PIPELINE_STAGES.map((stage) => [stage.key, stage.label]),
) as Record<PipelineStageKey, string>;

export function stageKeyToStatus(stage: PipelineStageKey): Uppercase<PipelineStageKey> {
  return stage.toUpperCase() as Uppercase<PipelineStageKey>;
}

const DEPOSIT_INDEX = PIPELINE_STAGES.findIndex((stage) => stage.key === 'deposit');

/**
 * Manual stage moves between {new, contacted, site_visit, quoting, sent} are silent;
 * any move that touches deposit-or-later (forward or back) needs a confirmation prompt.
 */
export function requiresStageConfirmation(currentStage: PipelineStageKey, nextStage: PipelineStageKey): boolean {
  const stageOrder = PIPELINE_STAGES.map((stage) => stage.key);
  const currentIdx = stageOrder.indexOf(currentStage);
  const nextIdx = stageOrder.indexOf(nextStage);
  if (currentIdx === -1 || nextIdx === -1) return true;
  return currentIdx >= DEPOSIT_INDEX || nextIdx >= DEPOSIT_INDEX;
}

export function toCanonicalStageCounts(input: Record<string, number> | null | undefined): PipelineStageCounts {
  const out: PipelineStageCounts = {};

  for (const [rawKey, value] of Object.entries(input ?? {})) {
    const id = normalizePipelineStageKey(rawKey);
    if (!id) continue;
    const n = typeof value === 'number' ? value : Number(value ?? 0);
    out[id] = (out[id] ?? 0) + (Number.isFinite(n) ? n : 0);
  }

  return out;
}
