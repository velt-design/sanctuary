import { appIdFromUuid } from '@/lib/supabase/mappers';
import {
  PROJECT_EFFECTIVE_STATES,
  type Project,
  type ProjectEffectiveState,
} from '@/lib/types/project';
import { normalizeProjectStatus } from '@/lib/types/project';
import type { ProjectOperationalState } from '@/lib/projects/workItems/types';
import { nowIso } from '@/lib/utils/time';

function operationalState(value: unknown): ProjectOperationalState | undefined {
  return value === 'ACTIVE' || value === 'WAITING' || value === 'CLOSED'
    ? value
    : undefined;
}

function effectiveState(value: unknown): ProjectEffectiveState | undefined {
  return typeof value === 'string'
    && PROJECT_EFFECTIVE_STATES.includes(value as ProjectEffectiveState)
    ? value as ProjectEffectiveState
    : undefined;
}

export function mapProjectRecord(row: Record<string, unknown>): Project {
  const createdAt = typeof row.created_at === 'string' ? row.created_at : nowIso();
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : createdAt;
  const normalized = normalizeProjectStatus(row.pipeline_stage ?? row.status ?? row.legacy_status ?? 'NEW');
  const projectName = typeof row.name === 'string' ? row.name : '';
  const siteAddress = typeof row.site_address === 'string' ? row.site_address : '';
  const followUpDate = typeof row.follow_up_date === 'string' ? row.follow_up_date : null;
  const contactId = typeof row.contact_id === 'string' ? appIdFromUuid('ct', row.contact_id) : undefined;

  return {
    id: appIdFromUuid('proj', typeof row.id === 'string' ? row.id : ''),
    createdAt,
    updatedAt,
    ...(contactId ? { contactId } : null),
    projectName,
    name: projectName,
    region: typeof row.region === 'string' ? row.region : undefined,
    quoteRef: typeof row.quote_ref === 'string' ? row.quote_ref : undefined,
    siteAddress: siteAddress || undefined,
    address: siteAddress || undefined,
    status: normalized.status,
    operationalState: operationalState(row.operational_state),
    effectiveState: effectiveState(row.effective_state),
    isLost: normalized.isLost,
    isArchived: typeof row.archived_at === 'string' ? true : normalized.isArchived,
    legacyStatus: normalized.legacyStatus,
    nextActionDate: followUpDate,
    followUpDate,
    nextActionType: typeof row.next_action_type === 'string' ? (row.next_action_type as Project['nextActionType']) : null,
    depositAmountCents:
      typeof row.deposit_amount_cents === 'number' && Number.isFinite(row.deposit_amount_cents)
        ? row.deposit_amount_cents
        : null,
    depositPaidDate: typeof row.deposit_paid_date === 'string' ? row.deposit_paid_date : null,
    finalPaymentDate: typeof row.final_payment_date === 'string' ? row.final_payment_date : null,
    notes: typeof row.notes === 'string' ? row.notes : '',
  };
}
