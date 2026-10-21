import { appIdFromUuid, uuidFromAppId } from '../supabase/mappers';

/** Studio endpoints accept raw UUIDs or the exact expected application prefix. */
export function studioIdentifier(value: string, prefix: 'proj' | 'est' | 'qv' | 'ct') {
  const trimmed = value.trim();
  if (trimmed.includes('_') && !trimmed.startsWith(`${prefix}_`)) throw new Error('Invalid identifier');
  const uuid = uuidFromAppId(trimmed, prefix).toLowerCase();
  return { uuid, appId: appIdFromUuid(prefix, uuid) };
}
