import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';

const contact = z.object({ email: z.string().nullable() });
const identity = z.object({ id: z.uuid(), contact_id: z.uuid().nullable(),
  contact: z.union([contact, z.array(contact).max(1), z.null()]) });

/** An uncached, auth-bound project visibility and customer check. No owner/work reads. */
export async function readProjectCorrespondenceIdentity(projectId: string, client: SupabaseClient) {
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const result = await client.from('projects').select('id,contact_id,contact:contacts(email)')
    .eq('id', projectUuid).maybeSingle();
  if (result.error) throw new Error('Project identity unavailable');
  if (!result.data) return null;
  const row = identity.parse(result.data);
  if (row.id !== projectUuid) throw new Error('Project identity mismatch');
  const customer = Array.isArray(row.contact) ? row.contact[0] : row.contact;
  return { project: { id: appIdFromUuid('proj', row.id),
    contactId: row.contact_id ? appIdFromUuid('ct', row.contact_id) : null,
    contactEmail: customer?.email?.trim() || null } };
}
