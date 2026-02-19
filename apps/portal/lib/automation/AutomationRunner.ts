import 'server-only';

import {
  sendDesignConsultationBookedEmail,
  sendProjectCompletedEmail,
  sendProjectScheduledEmail,
} from '@/lib/emails/transactional';
import {
  EMAIL_DESIGN_CONSULTATION_BOOKED_V1,
  EMAIL_PROJECT_COMPLETED_V1,
  EMAIL_PROJECT_SCHEDULED_V1,
} from '@/lib/emails/transactionalTemplates';
import { supabaseServer } from '@/lib/supabaseClient';
import { isUuid } from '@/lib/supabase/mappers';
import type { ProjectStatus } from '@/lib/types/project';

type PostgrestErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type AuditEventRow = {
  id: string;
  project_id: string | null;
  type: string;
  idempotency_key: string;
  payload: unknown;
  created_at: string;
};

type ProjectRow = {
  id: string;
  contact_id: string | null;
  name: string;
  pipeline_stage: string;
  site_address: string | null;
  quote_ref: string | null;
};

type ContactRow = {
  id: string;
  name: string;
  email: string | null;
};

type EmailTemplateRow = {
  id: string;
  subject: string;
};

type StageChangedPayload = {
  fromStage?: ProjectStatus | null;
  toStage: ProjectStatus;
  reason?: string | null;
  meta?: unknown;
  quoteId?: string | null;
};

type ProjectCreatedPayload = {
  source?: string | null;
};

type BookSiteVisitPayload = {
  status: 'TENTATIVE' | 'CONFIRMED';
  scheduledStart: string;
  scheduledEnd?: string | null;
  salespersonId?: string | null;
  notes?: string | null;
};

type GenerateCostPlanPayload = {
  tier?: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4';
};

function toPostgrestError(value: unknown): PostgrestErrorLike | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as any;
  return { code: v.code, message: v.message, details: v.details, hint: v.hint };
}

function isMissingColumnError(error: unknown): boolean {
  const pg = toPostgrestError(error);
  const code = typeof pg?.code === 'string' ? pg.code.trim() : '';
  const msg = typeof pg?.message === 'string' ? pg.message.toLowerCase() : '';
  return code === 'PGRST204' || code === '42703' || msg.includes('schema cache') || msg.includes('does not exist');
}

function missingColumnFromError(error: unknown): string | null {
  const pg = toPostgrestError(error);
  if (!pg) return null;
  const code = typeof pg.code === 'string' ? pg.code.trim() : '';
  const msg = typeof pg.message === 'string' ? pg.message : '';

  if (code === 'PGRST204') {
    const match = msg.match(/'([^']+)' column/i);
    return match ? match[1] : null;
  }
  const pgMatch = msg.match(/column\s+([a-z0-9_\\.]+)\s+does not exist/i);
  if (pgMatch) {
    const dotted = pgMatch[1] || '';
    return dotted.split('.').at(-1) ?? null;
  }
  return null;
}

function isUniqueViolation(error: unknown): boolean {
  const pg = toPostgrestError(error);
  const code = typeof pg?.code === 'string' ? pg.code.trim() : '';
  const msg = typeof pg?.message === 'string' ? pg.message : '';
  return code === '23505' || /duplicate key value/i.test(msg) || /unique constraint/i.test(msg);
}

function isOnConflictConstraintMissing(error: unknown): boolean {
  const pg = toPostgrestError(error);
  const code = typeof pg?.code === 'string' ? pg.code.trim() : '';
  const msg = typeof pg?.message === 'string' ? pg.message.toLowerCase() : '';
  return code === '42P10' || (msg.includes('on conflict') && msg.includes('no unique'));
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

function safeJson(value: unknown): unknown {
  if (value === undefined) return null;
  return value;
}

function makeIdempotencyKey(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(':');
}

function isBusinessDay(d: Date): boolean {
  const day = d.getUTCDay();
  return day !== 0 && day !== 6;
}

function addBusinessDays(from: Date, days: number): Date {
  const dir = days >= 0 ? 1 : -1;
  let remaining = Math.abs(days);
  let cur = new Date(from.getTime());

  while (remaining > 0) {
    cur = new Date(cur.getTime() + dir * 24 * 60 * 60 * 1000);
    if (isBusinessDay(cur)) remaining -= 1;
  }

  return cur;
}

function withUtcHour(d: Date, hour: number): Date {
  const next = new Date(d.getTime());
  next.setUTCHours(hour, 0, 0, 0);
  return next;
}

function now(): Date {
  return new Date();
}

function normaliseStage(value: unknown): ProjectStatus {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  switch (raw) {
    case 'CONTACTED':
    case 'SITE_VISIT':
    case 'QUOTING':
    case 'SENT':
    case 'DEPOSIT':
    case 'SCHEDULED':
    case 'COMPLETED':
    case 'PAID':
    case 'NEW':
      return raw;
    default:
      return 'NEW';
  }
}

async function loadProject(projectId: string): Promise<ProjectRow | null> {
  const { data, error } = await supabaseServer
    .from('projects')
    .select('id, contact_id, name, pipeline_stage, site_address, quote_ref')
    .eq('id', projectId)
    .single();
  if (error || !data) return null;
  return data as any;
}

async function loadContact(contactId: string): Promise<ContactRow | null> {
  const { data, error } = await supabaseServer.from('contacts').select('id, name, email').eq('id', contactId).single();
  if (error || !data) return null;
  return data as any;
}

async function loadEmailTemplate(templateId: string): Promise<EmailTemplateRow | null> {
  const { data, error } = await supabaseServer.from('email_templates').select('id, subject').eq('id', templateId).single();
  if (error || !data) return null;
  return data as any;
}

function formatNzDate(valueIso: string): string {
  const parsed = new Date(valueIso);
  if (!Number.isFinite(parsed.getTime())) return valueIso;
  return new Intl.DateTimeFormat('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

function formatNzTime(valueIso: string): string {
  const parsed = new Date(valueIso);
  if (!Number.isFinite(parsed.getTime())) return valueIso;
  return new Intl.DateTimeFormat('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

function formatDuration(startIso: string, endIso?: string | null): string {
  if (!endIso) return '60 minutes';
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return '60 minutes';
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const totalMinutes = Math.round(diffMs / (60 * 1000));
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '60 minutes';
  if (totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${totalMinutes} minutes`;
}

function formatDateFromDateOnly(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return 'To be confirmed';
  if (startDate && endDate) return `${formatDateFromDateOnly(startDate)} to ${formatDateFromDateOnly(endDate)}`;
  return formatDateFromDateOnly(startDate || endDate || 'To be confirmed');
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const msg = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
  return msg || fallback;
}

async function ensureEmailTemplateSeed(templateId: string, subject: string): Promise<void> {
  const res = await supabaseServer
    .from('email_templates')
    .upsert(
      {
        id: templateId,
        subject,
        body_html: '<p>(Rendered in app code)</p>',
        body_text: null,
        variables: [],
      } as any,
      { onConflict: 'id' } as any,
    );
  if (res.error) throw res.error;
}

async function upsertTask(params: {
  projectId: string;
  type:
    | 'CREATE_DESIGN_PACKAGE'
    | 'REVIEW_NEW_LEAD'
    | 'BOOK_SITE_VISIT'
    | 'ATTEND_SITE_VISIT'
    | 'FINALIZE_SEND_QUOTE'
    | 'SCHEDULE_INSTALL_WINDOW'
    | 'UPLOAD_COMPLETION_PHOTOS';
  title: string;
  dueAt?: string | null;
  details?: string | null;
  meta?: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<void> {
  const payload: any = {
    project_id: params.projectId,
    type: params.type,
    status: 'OPEN',
    title: params.title,
    due_at: params.dueAt ?? null,
    details: params.details ?? null,
    meta: params.meta ?? {},
    idempotency_key: params.idempotencyKey,
  };

  const { error } = await supabaseServer.from('tasks').upsert(payload, { onConflict: 'idempotency_key' });
  if (error) throw error;
}

async function insertEmailOutbox(params: {
  projectId: string;
  contactId: string | null;
  emailType: string;
  toEmail: string;
  templateId: string;
  subject: string;
  variables: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<void> {
  const { error } = await supabaseServer.from('email_outbox').insert({
    project_id: params.projectId,
    contact_id: params.contactId,
    email_type: params.emailType,
    to_email: params.toEmail,
    subject: params.subject,
    template_id: params.templateId,
    variables: params.variables,
    status: 'QUEUED',
    idempotency_key: params.idempotencyKey,
  } as any);

  if (!error) return;
  if (isUniqueViolation(error)) return;
  throw error;
}

async function insertOrUpdateEmailOutbox(params: {
  projectId: string;
  contactId: string | null;
  emailType: string;
  toEmail: string;
  templateId: string;
  subject: string;
  variables: Record<string, unknown>;
  status: 'SENT' | 'FAILED';
  error: string | null;
  sentAt: string | null;
  idempotencyKey: string;
}): Promise<void> {
  const payload = {
    project_id: params.projectId,
    contact_id: params.contactId,
    email_type: params.emailType,
    to_email: params.toEmail,
    subject: params.subject,
    template_id: params.templateId,
    variables: params.variables,
    status: params.status,
    error: params.error,
    sent_at: params.sentAt,
    idempotency_key: params.idempotencyKey,
  };

  const insertRes = await supabaseServer.from('email_outbox').insert(payload as any);
  if (!insertRes.error) return;
  if (!isUniqueViolation(insertRes.error)) throw insertRes.error;

  const updateRes = await supabaseServer
    .from('email_outbox')
    .update({
      subject: params.subject,
      template_id: params.templateId,
      variables: params.variables,
      status: params.status,
      error: params.error,
      sent_at: params.sentAt,
    } as any)
    .eq('idempotency_key', params.idempotencyKey);
  if (updateRes.error) throw updateRes.error;
}

async function loadScheduleWindow(projectId: string): Promise<{ startDate: string | null; endDate: string | null }> {
  const res = await supabaseServer
    .from('schedule_items')
    .select('start_date, end_date')
    .eq('project_id', projectId)
    .order('start_date', { ascending: true })
    .limit(1);

  if (res.error) return { startDate: null, endDate: null };

  const row = Array.isArray(res.data) ? res.data[0] : null;
  return {
    startDate: typeof row?.start_date === 'string' ? row.start_date : null,
    endDate: typeof row?.end_date === 'string' ? row.end_date : null,
  };
}

async function ensureFollowupPlanActive(projectId: string, quoteUuid: string | null): Promise<{ id: string } | null> {
  const insertRes = await supabaseServer
    .from('followup_plans')
    .insert({
      project_id: projectId,
      quote_id: quoteUuid,
      status: 'ACTIVE',
    } as any)
    .select('id')
    .single();

  if (!insertRes.error && insertRes.data) return insertRes.data as any;

  if (isUniqueViolation(insertRes.error)) {
    const existing = await supabaseServer.from('followup_plans').select('id').eq('project_id', projectId).eq('status', 'ACTIVE').single();
    if (existing.error || !existing.data) return null;
    return existing.data as any;
  }

  throw insertRes.error;
}

async function insertFollowupTask(params: {
  planId: string;
  projectId: string;
  type: 'FOLLOWUP_CALL' | 'FOLLOWUP_EMAIL';
  dueAt: string;
  idempotencyKey: string;
}): Promise<void> {
  const { error } = await supabaseServer.from('followup_tasks').insert({
    plan_id: params.planId,
    project_id: params.projectId,
    type: params.type,
    status: 'OPEN',
    due_at: params.dueAt,
    idempotency_key: params.idempotencyKey,
  } as any);
  if (!error) return;
  if (isUniqueViolation(error)) return;
  throw error;
}

async function cancelFollowupsForProject(projectId: string, reason: string): Promise<void> {
  const nowIso = new Date().toISOString();

  const planRes = await supabaseServer
    .from('followup_plans')
    .update({ status: 'CANCELLED' } as any)
    .eq('project_id', projectId)
    .in('status', ['ACTIVE', 'PAUSED']);
  if (planRes.error) throw planRes.error;

  const tasksRes = await supabaseServer
    .from('followup_tasks')
    .update({ status: 'SKIPPED', outcome_note: reason, completed_at: nowIso } as any)
    .eq('project_id', projectId)
    .eq('status', 'OPEN');
  if (tasksRes.error) throw tasksRes.error;
}

async function upsertSiteVisitEvent(projectId: string, patch: Record<string, unknown>): Promise<void> {
  const payload: any = {
    project_id: projectId,
    ...patch,
  };
  const mutable = { ...payload };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { error } = await supabaseServer.from('site_visit_events').upsert(mutable, { onConflict: 'project_id' });
    if (!error) return;

    if (isOnConflictConstraintMissing(error)) {
      const updatePatch: any = { ...mutable };
      delete updatePatch.project_id;

      for (let updateAttempt = 0; updateAttempt < 4; updateAttempt += 1) {
        const updateRes = await supabaseServer.from('site_visit_events').update(updatePatch).eq('project_id', projectId);
        if (!updateRes.error) return;

        if (isMissingColumnError(updateRes.error)) {
          const missing = missingColumnFromError(updateRes.error);
          if (missing && missing in updatePatch) {
            delete updatePatch[missing];
            continue;
          }
          delete updatePatch.assigned_sales_owner_id;
          delete updatePatch.customer_notified;
          delete updatePatch.last_notified_at;
          delete updatePatch.cancel_reason;
          continue;
        }

        throw updateRes.error;
      }

      // If update couldn't find a row (or schema is too drifted), attempt insert without relying on ON CONFLICT.
      const insertPayload: any = { project_id: projectId, ...updatePatch };
      for (let insertAttempt = 0; insertAttempt < 4; insertAttempt += 1) {
        const insertRes = await supabaseServer.from('site_visit_events').insert(insertPayload);
        if (!insertRes.error) return;
        if (isMissingColumnError(insertRes.error)) {
          const missing = missingColumnFromError(insertRes.error);
          if (missing && missing in insertPayload) {
            delete insertPayload[missing];
            continue;
          }
          delete insertPayload.assigned_sales_owner_id;
          delete insertPayload.customer_notified;
          delete insertPayload.last_notified_at;
          delete insertPayload.cancel_reason;
          continue;
        }
        throw insertRes.error;
      }

      throw new Error('site_visit_events insert failed after retries');
    }

    if (isMissingColumnError(error)) {
      const missing = missingColumnFromError(error);
      if (missing && missing in mutable) {
        delete mutable[missing];
        continue;
      }
      delete mutable.assigned_sales_owner_id;
      delete mutable.customer_notified;
      delete mutable.last_notified_at;
      delete mutable.cancel_reason;
      continue;
    }

    throw error;
  }

  throw new Error('site_visit_events upsert failed after retries');
}

async function ensureUnscheduledSiteVisit(projectId: string): Promise<void> {
  const selectRes = await supabaseServer
    .from('site_visit_events')
    .select('id,status,scheduled_start,scheduled_end')
    .eq('project_id', projectId)
    .maybeSingle();

  if (selectRes.error) {
    if (isMissingColumnError(selectRes.error)) return;
    throw selectRes.error;
  }

  const row: any = selectRes.data;
  if (!row) {
    await upsertSiteVisitEvent(projectId, { status: 'UNSCHEDULED' });
    return;
  }

  const status = String(row?.status ?? '').toUpperCase();
  const scheduledStart = typeof row?.scheduled_start === 'string' ? row.scheduled_start : null;

  if (scheduledStart && ['TENTATIVE', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED'].includes(status)) {
    return;
  }

  if (status === 'UNSCHEDULED') {
    return;
  }

  await upsertSiteVisitEvent(projectId, { status: 'UNSCHEDULED', scheduled_start: null, scheduled_end: null });
}

async function upsertDesignTicket(projectId: string, patch: Record<string, unknown>): Promise<{ id: string } | null> {
  const res = await supabaseServer
    .from('design_package_tickets')
    .upsert({ project_id: projectId, ...patch } as any, { onConflict: 'project_id' })
    .select('id')
    .single();
  if (res.error || !res.data) return null;
  return res.data as any;
}

async function setProjectNextAction(projectId: string, nextActionAt: string | null, nextActionType: string | null): Promise<void> {
  const { error } = await supabaseServer
    .from('projects')
    .update({ next_action_at: nextActionAt, next_action_type: nextActionType } as any)
    .eq('id', projectId);
  if (!error) return;
  const pg = toPostgrestError(error);
  if (pg?.code === 'PGRST204') return;
  throw error;
}

export class AutomationRunner {
  async emitEvent(params: {
    type: string;
    projectId?: string | null;
    payload?: unknown;
    stage?: string | null;
    primaryId?: string | null;
  }): Promise<{ inserted: boolean; event: AuditEventRow | null }> {
    const idempotencyKey = makeIdempotencyKey([params.projectId ?? null, params.type, params.stage ?? null, params.primaryId ?? null]);
    if (!idempotencyKey) {
      throw new Error('AutomationRunner.emitEvent requires an idempotency key (type + projectId).');
    }

    const insertRes = await supabaseServer
      .from('audit_events')
      .insert({
        project_id: params.projectId ?? null,
        type: params.type,
        idempotency_key: idempotencyKey,
        payload: safeJson(params.payload),
      } as any)
      .select('*')
      .single();

    if (!insertRes.error && insertRes.data) return { inserted: true, event: insertRes.data as any };
    if (isUniqueViolation(insertRes.error)) return { inserted: false, event: null };
    throw insertRes.error;
  }

  async runEvent(params: {
    type: string;
    projectId: string | null;
    payload?: unknown;
    stage?: string | null;
    primaryId?: string | null;
  }): Promise<void> {
    const event = await this.emitEvent(params);
    if (!event.inserted) return;
    await this.handleEvent(params.type, params.projectId, params.payload);
  }

  private async handleEvent(type: string, projectId: string | null, payload: unknown): Promise<void> {
    if (!projectId) return;

    switch (type) {
      case 'ui.action.project_created':
        await this.onProjectCreated(projectId, (payload ?? {}) as ProjectCreatedPayload);
        return;
      case 'ui.action.mark_contacted':
        await this.onMarkContacted(projectId);
        return;
      case 'ui.action.customer_agreed_site_visit':
        await this.onCustomerAgreedSiteVisit(projectId);
        return;
      case 'ui.action.book_site_visit':
        await this.onBookSiteVisit(projectId, (payload ?? {}) as BookSiteVisitPayload);
        return;
      case 'ui.action.complete_site_visit':
        await this.onCompleteSiteVisit(projectId);
        return;
      case 'ui.action.generate_cost_plan':
        await this.onGenerateCostPlan(projectId, (payload ?? {}) as GenerateCostPlanPayload);
        return;
      case 'ticket.design_package_marked_done':
        await this.onDesignTicketMarkedDone(projectId);
        return;
      case 'ui.action.quote_mark_sent':
        await this.onQuoteMarkSent(projectId, payload as any);
        return;
      case 'ui.action.mark_deposit_received':
        await this.onDepositReceived(projectId);
        return;
      case 'ui.action.confirm_schedule':
        await this.onConfirmSchedule(projectId);
        return;
      case 'ui.action.mark_completed':
        await this.onMarkCompleted(projectId);
        return;
      case 'ui.action.mark_paid':
        await this.onMarkPaid(projectId);
        return;
      case 'pipeline.stage_changed':
        await this.onStageChanged(projectId, (payload ?? {}) as StageChangedPayload);
        return;
      default:
        return;
    }
  }

  private async onProjectCreated(projectId: string, _payload: ProjectCreatedPayload): Promise<void> {
    const project = await loadProject(projectId);
    if (!project) return;

    const contact = project.contact_id ? await loadContact(project.contact_id) : null;
    const contactName = contact?.name ?? '';
    const projectName = project.name ?? '';

    const due = withUtcHour(addBusinessDays(now(), 1), 9).toISOString();
    await upsertTask({
      projectId,
      type: 'REVIEW_NEW_LEAD',
      title: 'Review new lead',
      dueAt: due,
      details: null,
      meta: { source: 'automation' },
      idempotencyKey: makeIdempotencyKey([projectId, 'task', 'REVIEW_NEW_LEAD']),
    });

    if (contact?.email && contact.email.trim()) {
      const templateId = 'EMAIL_NEW_RANGE_AND_BROCHURES';
      const template = await loadEmailTemplate(templateId);
      await insertEmailOutbox({
        projectId,
        contactId: contact.id,
        emailType: templateId,
        toEmail: contact.email.trim(),
        templateId,
        subject: template?.subject ?? 'Thanks for your enquiry',
        variables: { contactName, projectName },
        idempotencyKey: makeIdempotencyKey([projectId, 'email', templateId]),
      });
    }
  }

  private async onMarkContacted(projectId: string): Promise<void> {
    const project = await loadProject(projectId);
    if (!project) return;
    const contact = project.contact_id ? await loadContact(project.contact_id) : null;
    if (!contact) return;

    const nextActionAt = withUtcHour(addBusinessDays(now(), 2), 9).toISOString();
    await setProjectNextAction(projectId, nextActionAt, 'CALL');

    if (contact.email && contact.email.trim()) {
      const templateId = 'EMAIL_CONTACTED_CONFIRM_RANGE';
      const template = await loadEmailTemplate(templateId);
      await insertEmailOutbox({
        projectId,
        contactId: contact.id,
        emailType: templateId,
        toEmail: contact.email.trim(),
        templateId,
        subject: template?.subject ?? 'Next steps for your pergola',
        variables: { contactName: contact.name ?? '', projectName: project.name ?? '' },
        idempotencyKey: makeIdempotencyKey([projectId, 'email', templateId]),
      });
    }
  }

  private async onCustomerAgreedSiteVisit(projectId: string): Promise<void> {
    await upsertSiteVisitEvent(projectId, { status: 'UNSCHEDULED' });

    const due = new Date(now().getTime() + 48 * 60 * 60 * 1000).toISOString();
    await upsertTask({
      projectId,
      type: 'BOOK_SITE_VISIT',
      title: 'Book site visit',
      dueAt: due,
      details: null,
      meta: { source: 'automation' },
      idempotencyKey: makeIdempotencyKey([projectId, 'task', 'BOOK_SITE_VISIT']),
    });
  }

  private async onBookSiteVisit(projectId: string, payload: BookSiteVisitPayload): Promise<void> {
    const status = payload.status === 'CONFIRMED' ? 'CONFIRMED' : 'TENTATIVE';
    const scheduledStart = isIsoDate(payload.scheduledStart) ? payload.scheduledStart : null;
    const scheduledEnd = payload.scheduledEnd && isIsoDate(payload.scheduledEnd) ? payload.scheduledEnd : null;

    if (!scheduledStart) return;

    await upsertSiteVisitEvent(projectId, {
      status,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      ...(typeof payload.salespersonId === 'string' ? { assigned_sales_owner_id: payload.salespersonId.trim() || null } : null),
      ...(typeof payload.notes === 'string' ? { notes: payload.notes.trim() || null } : null),
      ...(status === 'CONFIRMED' ? { customer_notified: true, last_notified_at: now().toISOString() } : null),
    });

    await upsertTask({
      projectId,
      type: 'ATTEND_SITE_VISIT',
      title: 'Attend site visit',
      dueAt: scheduledStart,
      details: null,
      meta: { source: 'automation' },
      idempotencyKey: makeIdempotencyKey([projectId, 'task', 'ATTEND_SITE_VISIT']),
    });

    if (status === 'CONFIRMED') {
      const project = await loadProject(projectId);
      if (!project) return;
      const contact = project.contact_id ? await loadContact(project.contact_id) : null;
      if (!contact || !contact.email?.trim()) return;

      const templateId = EMAIL_DESIGN_CONSULTATION_BOOKED_V1;
      const consultationDate = formatNzDate(scheduledStart);
      const consultationTime = formatNzTime(scheduledStart);
      const consultationDuration = formatDuration(scheduledStart, scheduledEnd);
      const subject = `Design consultation booked - ${consultationDate}`;
      const idempotencyKey = makeIdempotencyKey([projectId, 'email', templateId, scheduledStart]);
      const variables = {
        name: contact.name ?? '',
        consultation_date: consultationDate,
        consultation_time: consultationTime,
        consultation_duration: consultationDuration,
        consultation_timezone: 'NZ local time',
        site_address: project.site_address ?? undefined,
        rep_name: undefined,
        reference_id: project.quote_ref ?? undefined,
      } satisfies Record<string, unknown>;

      try {
        await ensureEmailTemplateSeed(templateId, subject);
        await sendDesignConsultationBookedEmail({
          to: contact.email.trim(),
          name: String(variables.name ?? ''),
          consultation_date: String(variables.consultation_date ?? ''),
          consultation_time: String(variables.consultation_time ?? ''),
          consultation_duration: String(variables.consultation_duration ?? ''),
          consultation_timezone: String(variables.consultation_timezone ?? ''),
          site_address: typeof variables.site_address === 'string' ? variables.site_address : undefined,
          reference_id: typeof variables.reference_id === 'string' ? variables.reference_id : undefined,
        });
        await insertOrUpdateEmailOutbox({
          projectId,
          contactId: contact.id,
          emailType: templateId,
          toEmail: contact.email.trim(),
          templateId,
          subject,
          variables,
          status: 'SENT',
          error: null,
          sentAt: now().toISOString(),
          idempotencyKey,
        });
      } catch (error) {
        await insertOrUpdateEmailOutbox({
          projectId,
          contactId: contact.id,
          emailType: templateId,
          toEmail: contact.email.trim(),
          templateId,
          subject,
          variables,
          status: 'FAILED',
          error: errorMessage(error, 'Failed to send design consultation email'),
          sentAt: null,
          idempotencyKey,
        });
      }

    }
  }

  private async onCompleteSiteVisit(projectId: string): Promise<void> {
    await upsertSiteVisitEvent(projectId, { status: 'COMPLETED' });
  }

  private async onGenerateCostPlan(projectId: string, payload: GenerateCostPlanPayload): Promise<void> {
    const tier = payload.tier ?? 'TIER_2';
    const due =
      tier === 'TIER_1'
        ? withUtcHour(addBusinessDays(now(), 2), 9).toISOString()
        : tier === 'TIER_2'
          ? withUtcHour(addBusinessDays(now(), 3), 9).toISOString()
          : tier === 'TIER_3'
            ? withUtcHour(addBusinessDays(now(), 4), 9).toISOString()
            : null;

    const status = tier === 'TIER_4' ? 'BLOCKED' : 'OPEN';

    await upsertDesignTicket(projectId, {
      tier,
      status,
      due_at: due,
    });

    if (status !== 'BLOCKED') {
      await upsertTask({
        projectId,
        type: 'CREATE_DESIGN_PACKAGE',
        title: `Create design package (${tier.replace('_', ' ')})`,
        dueAt: due,
        details: null,
        meta: { tier, source: 'automation' },
        idempotencyKey: makeIdempotencyKey([projectId, 'task', 'CREATE_DESIGN_PACKAGE']),
      });
    }
  }

  private async onDesignTicketMarkedDone(projectId: string): Promise<void> {
    const due = withUtcHour(addBusinessDays(now(), 1), 9).toISOString();
    await upsertTask({
      projectId,
      type: 'FINALIZE_SEND_QUOTE',
      title: 'Finalize + send quote',
      dueAt: due,
      details: null,
      meta: { source: 'automation' },
      idempotencyKey: makeIdempotencyKey([projectId, 'task', 'FINALIZE_SEND_QUOTE']),
    });
  }

  private async onQuoteMarkSent(projectId: string, payload: any): Promise<void> {
    const project = await loadProject(projectId);
    if (!project) return;
    const contact = project.contact_id ? await loadContact(project.contact_id) : null;
    if (!contact || !contact.email?.trim()) return;

    const templateId = 'EMAIL_QUOTE_SENT';
    const template = await loadEmailTemplate(templateId);
    const quoteIdRaw = typeof payload?.quoteId === 'string' ? payload.quoteId.trim() : '';
    await insertEmailOutbox({
      projectId,
      contactId: contact.id,
      emailType: templateId,
      toEmail: contact.email.trim(),
      templateId,
      subject: template?.subject ?? 'Your quote is ready',
      variables: { contactName: contact.name ?? '', projectName: project.name ?? '', quoteId: quoteIdRaw || null },
      idempotencyKey: makeIdempotencyKey([projectId, 'email', templateId, quoteIdRaw || null]),
    });
  }

  private async onDepositReceived(projectId: string): Promise<void> {
    const project = await loadProject(projectId);
    if (!project) return;
    const contact = project.contact_id ? await loadContact(project.contact_id) : null;
    if (contact?.email?.trim()) {
      const templateId = 'EMAIL_DEPOSIT_RECEIVED';
      const template = await loadEmailTemplate(templateId);
      await insertEmailOutbox({
        projectId,
        contactId: contact.id,
        emailType: templateId,
        toEmail: contact.email.trim(),
        templateId,
        subject: template?.subject ?? 'Deposit received',
        variables: { contactName: contact.name ?? '', projectName: project.name ?? '' },
        idempotencyKey: makeIdempotencyKey([projectId, 'email', templateId]),
      });
    }

    const due = withUtcHour(addBusinessDays(now(), 2), 9).toISOString();
    await upsertTask({
      projectId,
      type: 'SCHEDULE_INSTALL_WINDOW',
      title: 'Schedule install window',
      dueAt: due,
      details: null,
      meta: { source: 'automation' },
      idempotencyKey: makeIdempotencyKey([projectId, 'task', 'SCHEDULE_INSTALL_WINDOW']),
    });
  }

  private async onConfirmSchedule(projectId: string): Promise<void> {
    const project = await loadProject(projectId);
    if (!project) return;
    const contact = project.contact_id ? await loadContact(project.contact_id) : null;
    if (!contact?.email?.trim()) return;

    const templateId = EMAIL_PROJECT_SCHEDULED_V1;
    const schedule = await loadScheduleWindow(projectId);
    const startDate = schedule.startDate ?? now().toISOString().slice(0, 10);
    const scheduledStartDate = formatDateFromDateOnly(startDate);
    const estimatedInstallWindow = formatDateRange(schedule.startDate, schedule.endDate);
    const estimatedCompletionDate = schedule.endDate ? formatDateFromDateOnly(schedule.endDate) : undefined;
    const subject = `Your project is scheduled - ${scheduledStartDate}`;
    const idempotencyKey = makeIdempotencyKey([projectId, 'email', templateId]);
    const variables = {
      name: contact.name ?? '',
      site_address: project.site_address ?? 'To be confirmed',
      scheduled_start_date: scheduledStartDate,
      estimated_install_window: estimatedInstallWindow,
      estimated_completion_date: estimatedCompletionDate,
      reference_id: project.quote_ref ?? undefined,
    } satisfies Record<string, unknown>;

    try {
      await ensureEmailTemplateSeed(templateId, subject);
      await sendProjectScheduledEmail({
        to: contact.email.trim(),
        name: String(variables.name ?? ''),
        site_address: String(variables.site_address ?? 'To be confirmed'),
        scheduled_start_date: String(variables.scheduled_start_date ?? ''),
        estimated_install_window: String(variables.estimated_install_window ?? ''),
        estimated_completion_date:
          typeof variables.estimated_completion_date === 'string' ? variables.estimated_completion_date : undefined,
        reference_id: typeof variables.reference_id === 'string' ? variables.reference_id : undefined,
      });
      await insertOrUpdateEmailOutbox({
        projectId,
        contactId: contact.id,
        emailType: templateId,
        toEmail: contact.email.trim(),
        templateId,
        subject,
        variables,
        status: 'SENT',
        error: null,
        sentAt: now().toISOString(),
        idempotencyKey,
      });
    } catch (error) {
      await insertOrUpdateEmailOutbox({
        projectId,
        contactId: contact.id,
        emailType: templateId,
        toEmail: contact.email.trim(),
        templateId,
        subject,
        variables,
        status: 'FAILED',
        error: errorMessage(error, 'Failed to send project scheduled email'),
        sentAt: null,
        idempotencyKey,
      });
    }

  }

  private async onMarkCompleted(projectId: string): Promise<void> {
    const project = await loadProject(projectId);
    if (!project) return;
    const contact = project.contact_id ? await loadContact(project.contact_id) : null;
    if (contact?.email?.trim()) {
      const templateId = EMAIL_PROJECT_COMPLETED_V1;
      const completionDate = formatNzDate(now().toISOString());
      const subject = 'Your pergola is complete';
      const idempotencyKey = makeIdempotencyKey([projectId, 'email', templateId]);
      const variables = {
        name: contact.name ?? '',
        site_address: project.site_address ?? undefined,
        completion_date: completionDate,
        care_item_1: 'Rinse down the structure with fresh water every few months.',
        care_item_2: 'Check gutters, flashings, and fixings seasonally and clear debris.',
        care_item_3: 'Use mild soap only; avoid abrasive cleaners on coated surfaces.',
        reference_id: project.quote_ref ?? undefined,
      } satisfies Record<string, unknown>;

      try {
        await ensureEmailTemplateSeed(templateId, subject);
        await sendProjectCompletedEmail({
          to: contact.email.trim(),
          name: String(variables.name ?? ''),
          site_address: typeof variables.site_address === 'string' ? variables.site_address : undefined,
          completion_date: String(variables.completion_date ?? ''),
          care_item_1: String(variables.care_item_1 ?? ''),
          care_item_2: String(variables.care_item_2 ?? ''),
          care_item_3: String(variables.care_item_3 ?? ''),
          reference_id: typeof variables.reference_id === 'string' ? variables.reference_id : undefined,
        });
        await insertOrUpdateEmailOutbox({
          projectId,
          contactId: contact.id,
          emailType: templateId,
          toEmail: contact.email.trim(),
          templateId,
          subject,
          variables,
          status: 'SENT',
          error: null,
          sentAt: now().toISOString(),
          idempotencyKey,
        });
      } catch (error) {
        await insertOrUpdateEmailOutbox({
          projectId,
          contactId: contact.id,
          emailType: templateId,
          toEmail: contact.email.trim(),
          templateId,
          subject,
          variables,
          status: 'FAILED',
          error: errorMessage(error, 'Failed to send project completed email'),
          sentAt: null,
          idempotencyKey,
        });
      }

    }

    await upsertTask({
      projectId,
      type: 'UPLOAD_COMPLETION_PHOTOS',
      title: 'Upload completion photos',
      dueAt: null,
      details: null,
      meta: { source: 'automation' },
      idempotencyKey: makeIdempotencyKey([projectId, 'task', 'UPLOAD_COMPLETION_PHOTOS']),
    });
  }

  private async onMarkPaid(projectId: string): Promise<void> {
    const project = await loadProject(projectId);
    if (!project) return;
    const contact = project.contact_id ? await loadContact(project.contact_id) : null;
    if (!contact?.email?.trim()) return;

    const templateId = 'EMAIL_PAID_THANK_YOU';
    const template = await loadEmailTemplate(templateId);
    await insertEmailOutbox({
      projectId,
      contactId: contact.id,
      emailType: templateId,
      toEmail: contact.email.trim(),
      templateId,
      subject: template?.subject ?? 'Thanks for your payment',
      variables: { contactName: contact.name ?? '', projectName: project.name ?? '' },
      idempotencyKey: makeIdempotencyKey([projectId, 'email', templateId]),
    });
  }

  private async onStageChanged(projectId: string, payload: StageChangedPayload): Promise<void> {
    const toStage = normaliseStage(payload.toStage);
    const quoteId = typeof payload.quoteId === 'string' ? payload.quoteId.trim() : '';
    const quoteUuidRaw = quoteId ? (quoteId.includes('_') ? quoteId.split('_').at(-1) ?? '' : quoteId) : '';
    const quoteUuid = quoteUuidRaw && isUuid(quoteUuidRaw) ? quoteUuidRaw : null;

    if (toStage === 'SITE_VISIT') {
      await ensureUnscheduledSiteVisit(projectId);
      return;
    }

    if (toStage === 'SENT') {
      const plan = await ensureFollowupPlanActive(projectId, quoteUuid);
      if (!plan) return;

      const offsets = [
        { type: 'FOLLOWUP_CALL' as const, days: 2 },
        { type: 'FOLLOWUP_EMAIL' as const, days: 5 },
        { type: 'FOLLOWUP_CALL' as const, days: 9 },
        { type: 'FOLLOWUP_CALL' as const, days: 14 },
      ];

      for (const o of offsets) {
        const due = withUtcHour(addBusinessDays(now(), o.days), 9).toISOString();
        await insertFollowupTask({
          planId: plan.id,
          projectId,
          type: o.type,
          dueAt: due,
          idempotencyKey: makeIdempotencyKey([projectId, 'followup', quoteUuid ?? 'noquote', String(o.days), o.type]),
        });
      }
      return;
    }

    if (toStage === 'DEPOSIT' || toStage === 'SCHEDULED' || toStage === 'COMPLETED' || toStage === 'PAID') {
      await cancelFollowupsForProject(projectId, `Cancelled on stage change to ${toStage}`);
    }
  }
}

export const automationRunner = new AutomationRunner();
