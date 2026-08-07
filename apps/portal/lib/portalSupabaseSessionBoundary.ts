const AUTH_COOKIE_SUFFIX = '-auth-token';

export function portalSupabaseAuthStorageKey(supabaseUrl: string): string | null {
  try {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0]?.trim().toLowerCase();
    if (!projectRef || !/^[a-z0-9-]+$/.test(projectRef)) return null;
    return `sb-${projectRef}${AUTH_COOKIE_SUFFIX}`;
  } catch {
    return null;
  }
}

function isAuthCookieChunk(name: string, storageKey: string): boolean {
  const storageKeys = [storageKey, `${storageKey}-user`, `${storageKey}-code-verifier`];
  return storageKeys.some((candidate) =>
    name === candidate
    || new RegExp(`^${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(?:0|[1-9][0-9]*)$`).test(name));
}

/**
 * Last-resort local sign-out for @supabase/ssr's browser cookie storage.
 * Supabase auth-js performs its network logout before removing the local
 * session, so a network/5xx error otherwise leaves the SSR cookie intact.
 */
export function clearPortalSupabaseBrowserSession(
  supabaseUrl: string,
  options: {
    cookieHeader?: string;
    expireCookie?: (serialized: string) => void;
    localStorage?: Pick<Storage, 'removeItem'> | null;
  } = {},
): number {
  const storageKey = portalSupabaseAuthStorageKey(supabaseUrl);
  if (!storageKey) return 0;

  const cookieHeader = options.cookieHeader
    ?? (typeof document === 'undefined' ? '' : document.cookie);
  const expireCookie = options.expireCookie
    ?? ((serialized: string) => {
      document.cookie = serialized;
    });
  const localStorage = options.localStorage
    ?? (typeof window === 'undefined' ? null : window.localStorage);
  const cookieNames = cookieHeader
    .split(';')
    .map((part) => part.trim().split('=')[0] ?? '')
    .filter((name) => isAuthCookieChunk(name, storageKey));

  for (const name of cookieNames) {
    expireCookie(`${name}=; Path=/; Max-Age=0; SameSite=Lax`);
  }
  for (const key of [storageKey, `${storageKey}-user`, `${storageKey}-code-verifier`]) {
    localStorage?.removeItem(key);
  }
  return cookieNames.length;
}
