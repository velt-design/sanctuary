import 'server-only';

export type PortalServerLogContext = {
  requestId?: string | null;
  route: string;
  method: string;
  startedAt?: number | null;
};

export type RouteDiagnostics = PortalServerLogContext & {
  requestId: string;
  startedAt: number;
};

type RouteLogInput = {
  event?: string;
  status?: number;
  message: string;
  error?: unknown;
  extra?: Record<string, unknown>;
};

function safeRandomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function normalizeRequestId(request: Request | null | undefined): string {
  const headerValue =
    request?.headers.get('x-portal-request-id')?.trim() ||
    request?.headers.get('x-request-id')?.trim() ||
    '';
  return headerValue || safeRandomId();
}

function durationMs(context: PortalServerLogContext): number | undefined {
  if (typeof context.startedAt !== 'number' || !Number.isFinite(context.startedAt)) return undefined;
  return Number((performance.now() - context.startedAt).toFixed(1));
}

function errorDetails(error: unknown): { errorName?: string; errorMessage?: string } {
  if (error instanceof Error) {
    return {
      errorName: error.name || undefined,
      errorMessage: error.message || undefined,
    };
  }
  if (typeof error === 'string' && error.trim()) {
    return { errorMessage: error.trim() };
  }
  return {};
}

function baseLogPayload(context: PortalServerLogContext, input: RouteLogInput) {
  const duration = durationMs(context);
  return {
    event: input.event ?? 'portal.route_error',
    requestId: context.requestId ?? null,
    route: context.route,
    method: context.method,
    status: input.status,
    durationMs: duration,
    message: input.message,
    ...errorDetails(input.error),
    ...(input.extra ?? {}),
  };
}

export function createRouteDiagnostics(request: Request | null | undefined, route: string, method?: string): RouteDiagnostics {
  return {
    requestId: normalizeRequestId(request),
    route,
    method: method ?? request?.method ?? 'GET',
    startedAt: performance.now(),
  };
}

export function applyRouteDiagnostics<T extends Response>(response: T, diagnostics?: RouteDiagnostics | null): T {
  if (!diagnostics) return response;
  response.headers.set('x-portal-request-id', diagnostics.requestId);
  response.headers.set('server-timing', `total;dur=${(durationMs(diagnostics) ?? 0).toFixed(1)}`);
  return response;
}

export function logPortalServerError(context: PortalServerLogContext, input: RouteLogInput) {
  console.error('[portal]', baseLogPayload(context, input));
}

export function logPortalServerWarn(context: PortalServerLogContext, input: RouteLogInput) {
  console.warn('[portal]', baseLogPayload(context, input));
}
