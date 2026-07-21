import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProjectCommandStaffSummary } from './types';

type DirectoryRow = {
  user_id?: unknown;
  display_name?: unknown;
  email?: unknown;
  access_role?: unknown;
};

export async function getPortalStaffDirectory(supabase: SupabaseClient): Promise<ProjectCommandStaffSummary[]> {
  const result = await supabase.rpc('portal_staff_directory');
  if (result.error) throw new Error(result.error.message ?? 'Failed to load staff directory');
  return (Array.isArray(result.data) ? result.data : []).flatMap((raw) => {
    const row = raw as DirectoryRow;
    const userId = typeof row.user_id === 'string' ? row.user_id : '';
    const displayName = typeof row.display_name === 'string' ? row.display_name.trim() : '';
    const accessRole = row.access_role === 'admin' ? 'admin' : row.access_role === 'staff' ? 'staff' : null;
    if (!userId || !displayName || !accessRole) return [];
    return [{
      userId,
      displayName,
      email: typeof row.email === 'string' && row.email.trim() ? row.email.trim() : null,
      accessRole,
    }];
  });
}
