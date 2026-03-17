import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { isMissingSchemaError, loadDesignPackages } from '@/lib/designPackages/server';

export const runtime = 'nodejs';

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  try {
    const payload = await loadDesignPackages();
    return jsonOk(payload);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(error as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Design list schema is not upgraded yet. Run the latest migrations then refresh.${detail}`, 501);
    }
    return jsonError('Failed to load design list', 500);
  }
}
