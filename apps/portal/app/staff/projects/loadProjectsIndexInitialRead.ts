import 'server-only';

import { randomUUID } from 'node:crypto';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { loadProjectsIndexData, ProjectsIndexSchemaError } from '@/lib/projects/serverProjectsIndex';
import type { ProjectsIndexParams } from '@/lib/projects/projectsIndexContract';
import type { ProjectsIndexInitialRead, ProjectsIndexInitialResult } from './projectsIndexInitialRead';

/** Caller must await the existing page access gate before starting this read. */
export function loadProjectsIndexInitialRead(ownerId: string, params: ProjectsIndexParams): ProjectsIndexInitialRead {
  const result = (async (): Promise<ProjectsIndexInitialResult> => {
    if (params.search.length > 80) return { ok: false, status: 400, message: 'q must be 80 characters or fewer' };
    try {
      const supabase = await getSupabaseServerAuth();
      const { projects, contacts } = await loadProjectsIndexData(params, supabase);
      const { search, status, journey, state, owner, sort } = params;
      return { ok: true, data: {
        archive: params.archive, projects, contacts,
        query: { search, status, journey, state, owner, sort }, generatedAt: new Date().toISOString(),
      } };
    } catch (error) {
      return { ok: false, status: error instanceof ProjectsIndexSchemaError ? 503 : 500,
        message: error instanceof ProjectsIndexSchemaError ? error.message : 'Failed to load projects' };
    }
  })();
  return { id: randomUUID(), ownerId, params, result };
}
