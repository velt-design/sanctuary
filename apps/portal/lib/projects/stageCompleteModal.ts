import type { PipelineStageKey } from '@/lib/projects/pipelineDefinition';

export type StageKey = PipelineStageKey;

export type StageCompleteAction =
  | { kind: 'advance'; toStage: StageKey; label: string }
  | { kind: 'advance_skip'; toStage: StageKey; label: string }
  | { kind: 'archive'; label: string }
  | { kind: 'call_later'; label: string }
  | { kind: 'set_reminder'; label: string };

export const STAGE_COMPLETE_MODAL: Record<StageKey, StageCompleteAction[]> = {
  new: [
    { kind: 'advance', toStage: 'contacted', label: 'Move to Contacted' },
    { kind: 'advance_skip', toStage: 'site_visit', label: 'Move to Site Visit' },
    { kind: 'archive', label: 'Archive lead' },
  ],
  contacted: [
    { kind: 'call_later', label: 'Call later' },
    { kind: 'advance', toStage: 'site_visit', label: 'Move to Site Visit' },
    { kind: 'archive', label: 'Archive lead' },
  ],
  site_visit: [
    { kind: 'advance', toStage: 'quoting', label: 'Move to Quoting' },
    { kind: 'set_reminder', label: 'Set reminder' },
    { kind: 'archive', label: 'Archive lead' },
  ],
  quoting: [
    { kind: 'advance', toStage: 'sent', label: 'Move to Sent' },
    { kind: 'set_reminder', label: 'Set reminder' },
    { kind: 'archive', label: 'Archive lead' },
  ],
  sent: [
    { kind: 'call_later', label: 'Call later' },
    { kind: 'advance', toStage: 'deposit', label: 'Move to Deposit' },
    { kind: 'archive', label: 'Archive lead' },
  ],
  deposit: [
    { kind: 'advance', toStage: 'scheduled', label: 'Move to Scheduled' },
    { kind: 'set_reminder', label: 'Set reminder' },
  ],
  scheduled: [
    { kind: 'set_reminder', label: 'Set reminder' },
    { kind: 'advance', toStage: 'completed', label: 'Move to Completed' },
  ],
  completed: [
    { kind: 'set_reminder', label: 'Set reminder' },
    { kind: 'advance', toStage: 'paid', label: 'Move to Paid' },
  ],
  paid: [],
};
