export type PortalApiAccessFailure = {
  path: string;
  status: 401 | 403;
};

function requestUrl(
  input: Parameters<typeof fetch>[0],
  origin: string,
): URL | null {
  try {
    if (input instanceof Request) return new URL(input.url, origin);
    if (input instanceof URL) return new URL(input.toString(), origin);
    return new URL(String(input), origin);
  } catch {
    return null;
  }
}

export function portalApiAccessFailureForResponse(
  input: Parameters<typeof fetch>[0],
  response: Response,
  origin = typeof window === 'undefined' ? 'http://portal.local' : window.location.origin,
): PortalApiAccessFailure | null {
  if (response.status !== 401 && response.status !== 403) return null;
  const url = requestUrl(input, origin);
  if (!url || url.origin !== new URL(origin).origin || !url.pathname.startsWith('/api/')) {
    return null;
  }
  return { path: url.pathname, status: response.status };
}

/**
 * Observe same-origin API access failures without changing request or response
 * semantics. This covers both the shared apiJson client and specialist modules
 * that require raw fetch responses (PDFs, uploads, and streamed artifacts).
 */
export function installPortalApiAccessFailureMonitor(
  onAccessFailure: (failure: PortalApiAccessFailure) => void,
): () => void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return () => {};

  const previousFetch = window.fetch;
  const monitoredFetch: typeof window.fetch = async (...args) => {
    const response = await previousFetch(...args);
    const failure = portalApiAccessFailureForResponse(args[0], response);
    if (failure) onAccessFailure(failure);
    return response;
  };

  window.fetch = monitoredFetch;
  return () => {
    if (window.fetch === monitoredFetch) window.fetch = previousFetch;
  };
}
