import { jsonError, requireAdminSession } from '@/lib/api/adminApi';

export const runtime = 'nodejs';

export async function PATCH() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;
  return jsonError(
    'Immediate driver-curve overrides are retired. Create and publish a versioned costing draft in /admin/costing.',
    409,
  );
}
