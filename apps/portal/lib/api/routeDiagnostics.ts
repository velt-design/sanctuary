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
  timings: Map<string, number>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function errorDetails(error: unknown): { errorName?: string; errorMessage?: string; errorCode?: string; errorDetails?: string; errorHint?: string } {
  if (error instanceof Error) {
    return {
      errorName: error.name || undefined,
      errorMessage: error.message || undefined,
    };
  }
  if (typeof error === 'string' && error.trim()) {
    return { errorMessage: error.trim() };
  }
  if (isRecord(error)) {
    const name = typeof error.name === 'string' && error.name.trim() ? error.name.trim() : undefined;
    const message = typeof error.message === 'string' && error.message.trim() ? error.message.trim() : undefined;
    const code = typeof error.code === 'string' && error.code.trim() ? error.code.trim() : undefined;
    const details = typeof error.details === 'string' && error.details.trim() ? error.details.trim() : undefined;
    const hint = typeof error.hint === 'string' && error.hint.trim() ? error.hint.trim() : undefined;
    return {
      errorName: name,
      errorMessage: message,
      errorCode: code,
      errorDetails: details,
      errorHint: hint,
    };
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
    timings: new Map(),
  };
}

function validTimingName(name: string): boolean {
  return /^[a-z][a-z0-9_-]{0,39}$/i.test(name);
}

function recordRouteTiming(
  diagnostics: PortalServerLogContext | null | undefined,
  name: string,
  duration: number,
): void {
  if (!diagnostics || !validTimingName(name) || !Number.isFinite(duration) || duration < 0) return;
  const timings = 'timings' in diagnostics && diagnostics.timings instanceof Map
    ? diagnostics.timings as Map<string, number>
    : null;
  if (!timings || timings.size >= 12 && !timings.has(name)) return;
  timings.set(name, Number(((timings.get(name) ?? 0) + duration).toFixed(1)));
}

export async function measureRouteStep<T>(
  diagnostics: PortalServerLogContext | null | undefined,
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    recordRouteTiming(diagnostics, name, performance.now() - startedAt);
  }
}

export function applyRouteDiagnostics<T extends Response>(response: T, diagnostics?: RouteDiagnostics | null): T {
  if (!diagnostics) return response;
  response.headers.set('x-portal-request-id', diagnostics.requestId);
  const metrics = [
    `total;dur=${(durationMs(diagnostics) ?? 0).toFixed(1)}`,
    ...Array.from(diagnostics.timings, ([name, duration]) => `${name};dur=${duration.toFixed(1)}`),
  ];
  response.headers.set('server-timing', metrics.join(', '));
  return response;
}

export function logPortalServerError(context: PortalServerLogContext, input: RouteLogInput) {
  console.error('[portal]', baseLogPayload(context, input));
}

export function logPortalServerWarn(context: PortalServerLogContext, input: RouteLogInput) {
  console.warn('[portal]', baseLogPayload(context, input));
}
