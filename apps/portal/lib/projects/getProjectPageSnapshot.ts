import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  logPortalServerError,
  measureRouteStep,
  type PortalServerLogContext,
} from '@/lib/api/routeDiagnostics';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { appIdFromUuid, isUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { normalizeProjectStatus } from '@/lib/types/project';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import type { ProjectActivityItem, ProjectEmailLog, ProjectNote, ProjectPageSnapshot } from '@/lib/projects/types';
import { projectOwnerOption } from '@/lib/projects/commandCentre/projectOwners';
import { getAuthoritativeProjectWorkProjection } from '@/lib/projects/workItems/getAuthoritativeProjectWorkProjection';
import { isProjectWorkModelV2 } from '@/lib/projects/workItems/modelBoundary';

const PROJECT_NOTES_SNAPSHOT_LIMIT = 50;

const PROJECT_RELATED_SNAPSHOT_SELECT = `
  id,
  emails:email_outbox(id,subject,to_email,status,sent_at,created_at,email_type),
  jobPacks:job_pack_generations(id),
  notes:project_notes(id,body,author_id,author_email,author_display_name,created_at,updated_at,deleted_at)
`;

function mapProjectNote(row: any, currentUserId: string | null): ProjectNote | null {
  const id = typeof row?.id === 'string' ? row.id : null;
  const body = typeof row?.body === 'string' ? row.body : null;
  const authorId = typeof row?.author_id === 'string' ? row.author_id : null;
  const createdAt = typeof row?.created_at === 'string' ? row.created_at : null;
  if (!id || !body || !authorId || !createdAt) return null;
  const updatedAt = typeof row?.updated_at === 'string' ? row.updated_at : createdAt;
  const authorEmail = typeof row?.author_email === 'string' ? row.author_email : '';
  const authorDisplayName =
    typeof row?.author_display_name === 'string' && row.author_display_name.trim()
      ? row.author_display_name
      : null;
  return {
    id,
    body,
    authorId,
    authorEmail,
    authorDisplayName,
    createdAt,
    updatedAt,
    isOwn: currentUserId !== null && authorId === currentUserId,
  };
}

function pickString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function safeUuidFromAppId(value: string, prefix: string): string | null {
  try {
    return uuidFromAppId(value, prefix);
  } catch {
    return null;
  }
}

function mapEmailStatus(status: string): ProjectEmailLog['status'] {
  const raw = status.toUpperCase();
  if (raw === 'SENT' || raw === 'DELIVERED') return 'sent';
  if (raw === 'FAILED' || raw === 'ERROR') return 'failed';
  return undefined;
}

function mapEmailKind(kindRaw: string): ProjectEmailLog['kind'] {
  const raw = kindRaw.toLowerCase();
  if (!raw) return undefined;
  if (raw.includes('estimate')) return 'indicative_estimate';
  if (raw.includes('quote')) return 'quote_sent';
  return 'other';
}

function mapEmail(row: any): ProjectEmailLog {
  const status = typeof row?.status === 'string' ? mapEmailStatus(row.status) : undefined;
  const kind = typeof row?.email_type === 'string' ? mapEmailKind(row.email_type) : undefined;
  const sentAt =
    typeof row?.sent_at === 'string'
      ? row.sent_at
      : typeof row?.created_at === 'string'
        ? row.created_at
        : '';

  return {
    id: String(row?.id ?? ''),
    sentAt,
    toEmail: String(row?.to_email ?? ''),
    subject: String(row?.subject ?? ''),
    ...(status ? { status } : null),
    ...(kind ? { kind } : null),
  };
}

function mapOutboxToActivity(row: any): ProjectActivityItem | null {
  const at =
    typeof row?.sent_at === 'string'
      ? row.sent_at
      : typeof row?.created_at === 'string'
        ? row.created_at
        : '';
  if (!at) return null;

  const statusRaw = typeof row?.status === 'string' ? row.status.toUpperCase() : '';
  const title = statusRaw === 'FAILED' ? 'Email failed' : statusRaw === 'QUEUED' ? 'Email queued' : 'Email sent';

  const toEmail = typeof row?.to_email === 'string' ? row.to_email : '';
  const subject = typeof row?.subject === 'string' ? row.subject : '';
  const detailParts = [];
  if (toEmail) detailParts.push(`To: ${toEmail}`);
  if (subject) detailParts.push(subject);

  return {
    id: `outbox:${String(row?.id ?? '')}`,
    at,
    type: 'email_sent',
    title,
    detail: detailParts.length ? detailParts.join(' — ') : undefined,
  };
}

function logSnapshotError(context: PortalServerLogContext | undefined, message: string, error: unknown, query?: string) {
  logPortalServerError(
    context ?? { route: 'project_snapshot', method: 'GET' },
    {
      event: 'project_snapshot.query_failed',
      message,
      error,
      extra: query ? { query } : undefined,
    },
  );
}

function relationRows(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

async function loadProjectHeaderOwner(client: SupabaseClient, projectUuid: string): Promise<ProjectPageSnapshot['project']['owner']> {
  const assignment = await client
    .from('project_owner_assignments')
    .select('owner_key')
    .eq('project_id', projectUuid)
    .maybeSingle();
  if (assignment.error) throw new Error(assignment.error.message ?? 'Failed to load project owner');
  return projectOwnerOption(assignment.data?.owner_key) ?? undefined;
}

function mapProjectSummary(projectRow: any, fallbackProjectId: string): {
  project: ProjectPageSnapshot['project'];
  stage: ProjectPageSnapshot['pipeline']['stage'];
  nextActionDate: string | null;
} {
  const normalizedStage = normalizeProjectStatus(
    projectRow.pipeline_stage ?? projectRow.status ?? projectRow.legacy_status ?? 'NEW',
  ).status;
  const stage = normalizePipelineStageKey(normalizedStage) ?? 'new';
  const contactIdRaw = pickString(projectRow.contact_id, projectRow.contactId);
  const contactUuid = contactIdRaw ? safeUuidFromAppId(contactIdRaw, 'ct') : null;
  const projectId = (() => {
    const raw = String(projectRow.id ?? fallbackProjectId);
    if (raw.startsWith('proj_')) return raw;
    if (isUuid(raw)) return appIdFromUuid('proj', raw);
    return fallbackProjectId;
  })();
  const contactRaw = projectRow.contact;
  const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw ?? null;
  const name = pickString(projectRow.projectName, projectRow.project_name, projectRow.name, 'Project') ?? 'Project';
  const contactName = pickString(contact?.name, projectRow.contact_name, projectRow.contactName);
  const contactEmail = pickString(contact?.email, projectRow.contact_email, projectRow.contactEmail);
  const contactPhone = pickString(contact?.phone, projectRow.contact_phone, projectRow.contactPhone);
  const siteAddress = pickString(projectRow.site_address, projectRow.siteAddress, projectRow.address);
  const region = pickString(projectRow.region);
  const quoteRef = pickString(projectRow.quote_ref, projectRow.quoteRef);
  const nextActionDate = pickString(
    projectRow.next_action_date,
    projectRow.nextActionDate,
    projectRow.follow_up_date,
    projectRow.followUpDate,
  );

  return {
    project: {
      id: projectId,
      name,
      stage,
      ...(contactUuid ? { contactId: appIdFromUuid('ct', contactUuid) } : null),
      ...(contactName ? { contactName } : null),
      ...(contactEmail ? { contactEmail } : null),
      ...(contactPhone ? { contactPhone } : null),
      ...(siteAddress ? { siteAddress } : null),
      ...(region ? { region } : null),
      ...(quoteRef ? { quoteRef } : null),
      ...(nextActionDate ? { nextActionDate } : null),
    },
    stage,
    nextActionDate,
  };
}

export async function getProjectPageSummary(
  projectId: string,
  diagnostics?: PortalServerLogContext,
  supabase?: SupabaseClient,
): Promise<ProjectPageSnapshot | null> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const projectUuid = safeUuidFromAppId(projectId, 'proj');
  if (!projectUuid) return null;

  const [projectRes, owner, usesV2ProjectWork] = await Promise.all([
    measureRouteStep(diagnostics, 'project', async () => client
      .from('projects')
      .select('*,contact:contacts(*)')
      .eq('id', projectUuid)
      .maybeSingle()),
    measureRouteStep(diagnostics, 'owner', () => loadProjectHeaderOwner(client, projectUuid)),
    measureRouteStep(diagnostics, 'work_model', () => isProjectWorkModelV2(client, projectUuid)),
  ]);
  if (projectRes?.error) {
    logSnapshotError(diagnostics, 'project summary query failed', projectRes.error, 'projects');
    throw new Error('Failed to load project summary');
  }
  if (!projectRes?.data) return null;

  const summary = mapProjectSummary(projectRes.data, projectId);
  const workModelVersion = usesV2ProjectWork ? 2 : null;
  return {
    workModel: workModelVersion === 2 ? 'v2' : 'legacy',
    project: { ...summary.project, ...(owner ? { owner } : null) },
    pipeline: { stage: summary.stage },
    activity: [],
    emails: [],
    notes: [],
  };
}

export async function getProjectPageSnapshot(
  projectId: string,
  diagnostics?: PortalServerLogContext,
  supabase?: SupabaseClient,
  authenticatedUserId?: string | null,
): Promise<ProjectPageSnapshot | null> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const projectUuid = safeUuidFromAppId(projectId, 'proj');
  if (!projectUuid) return null;

  // Keep the access-defining project row independent so an optional related
  // read failure cannot hide a project the user may access. All subordinate
  // rows are embedded through their declared foreign keys in one PostgREST
  // request, avoiding a browser-open path with many HTTP round trips while
  // retaining auth-bound RLS on every relation.
  const [projectRes, relatedRes, owner, usesV2ProjectWork] = await Promise.all([
    measureRouteStep(diagnostics, 'project', async () => client
      .from('projects')
      .select('*,contact:contacts(*)')
      .eq('id', projectUuid)
      .maybeSingle()),
    measureRouteStep(diagnostics, 'related', async () => client
      .from('projects')
      .select(PROJECT_RELATED_SNAPSHOT_SELECT)
      .eq('id', projectUuid)
      .is('notes.deleted_at', null)
      .order('created_at', { referencedTable: 'emails', ascending: false })
      .order('created_at', { referencedTable: 'notes', ascending: false })
      .limit(1, { referencedTable: 'jobPacks' })
      .limit(PROJECT_NOTES_SNAPSHOT_LIMIT, { referencedTable: 'notes' })
      .maybeSingle()),
    measureRouteStep(diagnostics, 'owner', () => loadProjectHeaderOwner(client, projectUuid)),
    measureRouteStep(diagnostics, 'work_model', () => isProjectWorkModelV2(client, projectUuid)),
  ]);

  const projectRow = projectRes?.data ?? null;
  if (projectRes?.error) {
    logSnapshotError(diagnostics, 'project query failed', projectRes.error, 'projects');
    throw new Error('Failed to load project snapshot');
  }
  if (!projectRow) return null;
  if (relatedRes?.error) {
    logSnapshotError(diagnostics, 'project related snapshot query failed', relatedRes.error, 'projects+relations');
    throw new Error('Failed to load complete project snapshot');
  }

  const summary = mapProjectSummary(projectRow, projectId);
  const workModelVersion = usesV2ProjectWork ? 2 : null;
  const stage = summary.stage;
  const projectIdOut = summary.project.id;

  const currentUserId = authenticatedUserId === undefined
    ? (await client.auth.getUser())?.data?.user?.id ?? null
    : authenticatedUserId;

  const relatedRow = relatedRes?.data ?? null;
  const emailRows = relationRows(relatedRow?.emails);
  const emails = emailRows.map(mapEmail);
  const outboxActivity = emailRows
    .map(mapOutboxToActivity)
    .filter(Boolean) as ProjectActivityItem[];
  const activity = outboxActivity.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const hasJobPacks = relationRows(relatedRow?.jobPacks).length > 0;
  const projectWork = workModelVersion === 2
    ? await measureRouteStep(
        diagnostics,
        'work_projection',
        () => getAuthoritativeProjectWorkProjection(projectIdOut, client),
      )
    : null;
  if (workModelVersion === 2 && !projectWork) {
    throw new Error('V2 project work could not be loaded');
  }

  const notes = relationRows(relatedRow?.notes)
    .map((row) => mapProjectNote(row, currentUserId))
    .filter((value): value is ProjectNote => value !== null);

  return {
    workModel: workModelVersion === 2 ? 'v2' : 'legacy',
    ...(projectWork ? { projectWork } : null),
    project: {
      ...summary.project,
      ...(owner ? { owner } : null),
      ...(hasJobPacks ? { hasJobPacks } : null),
    },
    pipeline: {
      stage,
    },
    activity,
    emails,
    notes,
  };
}
