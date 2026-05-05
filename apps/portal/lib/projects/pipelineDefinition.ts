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

export type TaskKind = 'manual' | 'action';

export type TaskKey =
  | 'call_enquiry'
  | 'call_again_later_contacted'
  | 'book_site_visit'
  | 'generate_costing'
  | 'upload_photos_site_visit'
  | 'create_quote'
  | 'invoice_paid'
  | 'call_again_later_sent'
  | 'schedule_install'
  | 'confirm_schedule'
  | 'order_materials'
  | 'roofing_ordered'
  | 'job_complete'
  | 'reminder'
  | 'upload_pictures';

export type TaskDefinition = {
  key: TaskKey;
  label: string;
  kind: TaskKind;
  // If provided: task only appears when this evaluates true
  when?: (ctx: TaskContext) => boolean;
  // For action tasks: derived "done" state from portal data
  done?: (ctx: TaskContext) => boolean;
  // Optional CTA
  action?: (ctx: TaskContext) => { label: string; href: string };
};

export type TaskContext = {
  projectId: string;
  manualDone: Set<TaskKey>;

  // Prefer deriving from existing snapshot fields.
  // Fill these from getProjectPageSnapshot().
  hasBookedSiteVisit: boolean;
  hasGeneratedCosting: boolean;
  hasScheduledInstall: boolean;
  hasAcceptedQuote: boolean;
  hasOpenDepositInvoice: boolean;
  nextActionDate?: string | null;
};

export const STAGE_TASKS: Record<PipelineStageKey, TaskDefinition[]> = {
  new: [{ key: 'call_enquiry', label: 'Call enquiry', kind: 'manual' }],
  contacted: [{ key: 'call_again_later_contacted', label: 'Call again later', kind: 'manual' }],
  site_visit: [
    {
      key: 'book_site_visit',
      label: 'Book site visit',
      kind: 'action',
      done: (ctx) => ctx.hasBookedSiteVisit,
      action: (ctx) => ({ label: 'Book', href: `/staff/schedule?view=site-visits&project=${ctx.projectId}` }),
    },
    {
      key: 'generate_costing',
      label: 'Generate costing',
      kind: 'action',
      // IMPORTANT: only show after booking
      when: (ctx) => ctx.hasBookedSiteVisit,
      done: (ctx) => ctx.hasGeneratedCosting,
      action: (ctx) => ({ label: 'Generate', href: `/staff/projects/${ctx.projectId}?tab=estimates` }),
    },
    {
      key: 'upload_photos_site_visit',
      label: 'Upload photos',
      kind: 'manual',
      // IMPORTANT: only after costing is done
      when: (ctx) => ctx.hasGeneratedCosting,
    },
    {
      key: 'reminder',
      label: 'Reminder',
      kind: 'manual',
      when: (ctx) => Boolean(ctx.nextActionDate),
    },
  ],
  quoting: [
    { key: 'create_quote', label: 'Create quote', kind: 'manual' },
    {
      key: 'reminder',
      label: 'Reminder',
      kind: 'manual',
      when: (ctx) => Boolean(ctx.nextActionDate),
    },
  ],
  sent: [
    {
      key: 'invoice_paid',
      label: 'Invoice paid',
      kind: 'manual',
      when: (ctx) => ctx.hasAcceptedQuote && ctx.hasOpenDepositInvoice,
    },
    {
      key: 'call_again_later_sent',
      label: 'Call again later',
      kind: 'manual',
      when: (ctx) => !(ctx.hasAcceptedQuote && ctx.hasOpenDepositInvoice),
    },
  ],
  deposit: [
    {
      key: 'schedule_install',
      label: 'Schedule',
      kind: 'action',
      done: (ctx) => ctx.hasScheduledInstall,
      action: (ctx) => ({ label: 'Schedule', href: `/staff/schedule?project=${ctx.projectId}` }),
    },
    {
      key: 'confirm_schedule',
      label: 'Confirm schedule',
      kind: 'manual',
      when: (ctx) => ctx.hasScheduledInstall,
    },
    {
      key: 'reminder',
      label: 'Reminder',
      kind: 'manual',
      when: (ctx) => Boolean(ctx.nextActionDate),
    },
  ],
  scheduled: [
    { key: 'order_materials', label: 'Order materials', kind: 'manual' },
    { key: 'roofing_ordered', label: 'Roofing ordered', kind: 'manual' },
    {
      key: 'job_complete',
      label: 'Job complete',
      kind: 'manual',
      when: (ctx) => ctx.manualDone.has('order_materials'),
    },
    {
      key: 'reminder',
      label: 'Reminder',
      kind: 'manual',
      when: (ctx) => Boolean(ctx.nextActionDate),
    },
  ],
  completed: [
    { key: 'upload_pictures', label: 'Upload pictures', kind: 'manual' },
    {
      key: 'reminder',
      label: 'Reminder',
      kind: 'manual',
      when: (ctx) => Boolean(ctx.nextActionDate),
    },
  ],
  paid: [],
};

export type ResolvedTaskItem = {
  key: TaskKey;
  label: string;
  kind: TaskKind;
  isDone: boolean;
  isManualDone?: boolean;
  isLocked?: boolean;
  cta?: { label: string; href: string };
};

export type PipelineStageCounts = Partial<Record<PipelineStageKey, number>>;

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

const TASK_DEFINITIONS = Object.values(STAGE_TASKS).flat();
const TASKS_BY_KEY = new Map<TaskKey, TaskDefinition>();

for (const task of TASK_DEFINITIONS) {
  if (!TASKS_BY_KEY.has(task.key)) TASKS_BY_KEY.set(task.key, task);
}

export const TASK_KEYS = Array.from(TASKS_BY_KEY.keys());

export function getTaskDefinition(key: string | null | undefined): TaskDefinition | null {
  if (!key) return null;
  return TASKS_BY_KEY.get(key as TaskKey) ?? null;
}

export function isTaskKey(value: string | null | undefined): value is TaskKey {
  return Boolean(getTaskDefinition(value));
}

export function isManualTaskKey(value: string | null | undefined): value is TaskKey {
  const def = getTaskDefinition(value);
  return Boolean(def && def.kind === 'manual');
}

export function resolveStageTasks(
  stage: PipelineStageKey,
  ctx: TaskContext,
  manualCompleted: Set<TaskKey>,
): ResolvedTaskItem[] {
  const stageTasks = STAGE_TASKS[stage] ?? [];
  return stageTasks.map((task) => {
    const isLocked = task.when ? !task.when(ctx) : false;

    if (task.kind === 'manual') {
      const isDone = manualCompleted.has(task.key);
      return {
        key: task.key,
        label: task.label,
        kind: task.kind,
        isDone,
        isManualDone: isDone,
        ...(isLocked && !isDone ? { isLocked: true } : null),
      };
    }

    const isDone = typeof task.done === 'function' ? task.done(ctx) : false;
    const cta = !isLocked && !isDone && task.action ? task.action(ctx) : undefined;
    return {
      key: task.key,
      label: task.label,
      kind: task.kind,
      isDone,
      ...(cta ? { cta } : null),
      ...(isLocked && !isDone ? { isLocked: true } : null),
    };
  });
}

export function stageKeyToStatus(stage: PipelineStageKey): Uppercase<PipelineStageKey> {
  return stage.toUpperCase() as Uppercase<PipelineStageKey>;
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
