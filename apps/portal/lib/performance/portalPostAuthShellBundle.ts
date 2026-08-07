/**
 * Keep this value stable: the production bundle-budget analyzer uses it to
 * separate the deliberately preloaded, data-free portal frame from each
 * route's own lazy feature code.
 */
export const PORTAL_POST_AUTH_SHELL_BUNDLE_MARKER = 'sanctuary-portal-post-auth-shell-v1';

export const PORTAL_POST_AUTH_SHELL_BUNDLE_BUDGETS = {
  // 2026-08-06 fresh production measurement of the complete authenticated,
  // data-free route-frame catalogue plus 5%, rounded up to KiB. This is a
  // separate post-login preload cap; specialist route runtimes stay lazy.
  rawBytes: 605_184,
  gzipBytes: 126_976,
} as const;

export type PortalPostAuthShellBundleBudgets = {
  rawBytes: number;
  gzipBytes: number;
};
