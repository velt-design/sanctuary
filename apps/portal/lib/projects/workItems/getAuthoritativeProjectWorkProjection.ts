import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getProjectCommandCentre } from '@/lib/projects/commandCentre/getProjectCommandCentre';
import type { ProjectWorkProjection } from './types';

/**
 * Returns the V2 project-work projection composed by the Command Centre.
 *
 * The Command Centre owns the authoritative commercial/design selection used
 * to derive specialist and recovery candidates. Other project readers must use
 * this aggregate instead of loading raw work rows and silently losing those
 * candidates.
 */
export async function getAuthoritativeProjectWorkProjection(
  projectId: string,
  supabase: SupabaseClient,
): Promise<ProjectWorkProjection | null> {
  const commandCentre = await getProjectCommandCentre(projectId, supabase);
  if (!commandCentre || commandCentre.workModel !== 'v2') return null;
  return commandCentre.projectWork;
}
