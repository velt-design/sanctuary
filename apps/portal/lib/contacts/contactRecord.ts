import { appIdFromUuid } from '@/lib/supabase/mappers';
import type { Contact } from '@/lib/types/contact';
import { nowIso } from '@/lib/utils/time';

export function mapContactRecord(row: Record<string, unknown>): Contact {
  const id = typeof row.id === 'string' ? row.id : '';
  const createdAt = typeof row.created_at === 'string' ? row.created_at : nowIso();
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : createdAt;

  return {
    id: appIdFromUuid('ct', id),
    displayName: typeof row.name === 'string' ? row.name.trim() : '',
    email: typeof row.email === 'string' ? row.email : '',
    phone: typeof row.phone === 'string' ? row.phone : '',
    createdAt,
    updatedAt,
  };
}
