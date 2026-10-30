import 'server-only';
import {resolvePortalAccessState,type PortalAccessLookup} from './portalAccess';

type RoleQuery = ReturnType<ReturnType<ReturnType<PortalAccessLookup['from']>['select']>['eq']> & {
  abortSignal?: (signal: AbortSignal) => RoleQuery;
};
type RoleResult = Awaited<ReturnType<RoleQuery['maybeSingle']>>;
export type PortalAccessMode = 'studio-opening';
export type StudioPortalAccessLookup = {
  auth: {
    getUser: (jwt?: string) => ReturnType<PortalAccessLookup['auth']['getUser']>;
    getSession?: () => Promise<{data?: {session?: {access_token?: string} | null} | null; error?: {message?: string} | null}>;
  };
  from: (table: string) => {select: (columns: string) => {eq: (column: string, value: string) => RoleQuery}};
};

/** Unverified routing hint only. Malformed/missing data cannot deny fresh access. */
function untrustedSubject(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[1].length > 16384) return null;
    const bytes = Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    const subject: unknown = JSON.parse(new TextDecoder().decode(bytes)).sub;
    return typeof subject === 'string' && subject.length > 0 && subject.length <= 128 ? subject : null;
  } catch { return null; }
}


/** Request-local I/O scheduling only. The original resolver still owns user,
 * role, error and admission policy; the underlying caller client is unchanged. */
export async function resolveStudioPortalAccessState(supabase: StudioPortalAccessLookup) {
  let hintedId: string | null = null;
  let pendingRole: Promise<{ok: true; value: RoleResult} | {ok: false; error: unknown}> | null = null;
  const permission = new AbortController();
  const lookup: PortalAccessLookup = {
    auth: {getUser: async () => {
      if (!supabase.auth.getSession) return supabase.auth.getUser();
      const session = await supabase.auth.getSession();
      // Do not retry a failed SDK refresh with another getUser call.
      if (session.error) return {data: {user: null}, error: session.error};
      const token = session.data?.session?.access_token;
      if (typeof token !== 'string' || !token.length) return supabase.auth.getUser();
      hintedId = untrustedSubject(token);
      if (hintedId) {
        let query = supabase.from('portal_users').select('role').eq('user_id', hintedId);
        if (query.abortSignal) query = query.abortSignal(permission.signal);
        pendingRole = Promise.resolve(query.maybeSingle())
          .then(value => ({ok: true as const, value}), error => ({ok: false as const, error}));
      }
      // Fresh remote verification without retaining the SDK storage lock.
      return supabase.auth.getUser(token);
    }},
    from: table => ({select: columns => ({eq: (column, userId) => ({maybeSingle: async () => {
      if (pendingRole && userId === hintedId && table === 'portal_users' && columns === 'role' && column === 'user_id') {
        const result = await pendingRole;
        if (!result.ok) throw result.error;
        return result.value;
      }
      permission.abort();
      // A missing/lying hint cannot veto a verified identity. Delegate the exact
      // canonical query, including any future changed table/selection/filter.
      return supabase.from(table).select(columns).eq(column, userId).maybeSingle();
    }})})})
  };
  try {return await resolvePortalAccessState(lookup);}
  finally {permission.abort();}
}
