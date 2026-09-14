import 'server-only';
import { getPortalSession } from '@/lib/auth';
import { isDeveloper, config } from './security';

export const privateHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export function json(value: unknown, status = 200) { return Response.json(value, { status, headers: privateHeaders }); }
export async function developer() {
  const session = await getPortalSession();
  return session && isDeveloper(session.user) ? session : null;
}
export function sameOrigin(request: Request): boolean {
  return request.headers.get('origin') === config().origin;
}
