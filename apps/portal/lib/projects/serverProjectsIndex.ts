import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { mapContactRecord } from '@/lib/contacts/contactRecord';
import { portalTodayYmd } from '@/lib/format/portalDateTime';
import {
  buildProjectJourneyStageSet,
  type ProjectJourneyPhase,
} from '@/lib/projects/projectJourney';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { mapProjectRecord } from './projectRecord';
import type {
  ProjectsIndexParams,
  ProjectsIndexResponse,
} from './projectsIndexContract';

type RpcPayload = {
  rows?: unknown;
  totalCount?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

export class ProjectsIndexSchemaError extends Error {
  constructor() {
    super('Projects search is temporarily unavailable while the portal database is updated.');
    this.name = 'ProjectsIndexSchemaError';
  }
}

function isMissingFunction(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return code === 'PGRST202'
    || code === '42883'
    || /staff_projects_index_v[12]|schema cache|function .* does not exist/i.test(message);
}

function readPayload(value: unknown): RpcPayload {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RpcPayload
    : {};
}

function finiteInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;
}

function contactFromProjectRow(row: Record<string, unknown>) {
  if (typeof row.contact_id !== 'string') return null;
  return mapContactRecord({
    id: row.contact_id,
    name: row.contact_name,
    email: row.contact_email,
    phone: row.contact_phone,
    created_at: row.contact_created_at,
    updated_at: row.contact_updated_at,
  });
}

function stagesForProjectsIndex(params: ProjectsIndexParams): string[] | null {
  if (params.journey === 'all') {
    return params.status === 'all' ? null : [params.status];
  }

  const journeyStages = [...buildProjectJourneyStageSet([
    params.journey as ProjectJourneyPhase,
  ])].map((stage) => stage.toUpperCase());
  if (params.status === 'all') return journeyStages;
  return journeyStages.includes(params.status)
    ? [params.status]
    : ['__NO_MATCH__'];
}

export async function loadProjectsIndexData(
  params: ProjectsIndexParams,
  supabase?: SupabaseClient,
): Promise<Pick<ProjectsIndexResponse, 'projects' | 'contacts'>> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const result = await client.rpc('staff_projects_index_v2', {
    p_archive: params.archive,
    p_search: params.search,
    p_status: params.status,
    p_due: 'all',
    p_today: portalTodayYmd(),
    p_page: params.page,
    p_page_size: params.pageSize,
    p_sort: params.sort,
    p_state: params.state,
    p_stages: stagesForProjectsIndex(params),
  });
  if (result.error) {
    if (isMissingFunction(result.error)) throw new ProjectsIndexSchemaError();
    throw result.error;
  }

  const payload = readPayload(result.data);
  const rawRows = (Array.isArray(payload.rows) ? payload.rows : []) as Record<string, unknown>[];
  const projects = rawRows.map(mapProjectRecord);
  const contacts = new Map(
    rawRows
      .map(contactFromProjectRow)
      .filter((contact): contact is NonNullable<ReturnType<typeof contactFromProjectRow>> => Boolean(contact))
      .map((contact) => [contact.id, contact]),
  );
  const totalCount = finiteInteger(payload.totalCount, projects.length);
  const page = Math.max(1, finiteInteger(payload.page, params.page));
  const pageSize = params.pageSize;

  return {
    projects: {
      rows: projects,
      totalCount,
      truncated: false,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
    contacts: {
      rows: Array.from(contacts.values()),
      totalCount: null,
      truncated: false,
    },
  };
}
