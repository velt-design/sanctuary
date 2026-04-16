import 'server-only';

import type { PortalServerLogContext } from '@/lib/api/routeDiagnostics';
import { estimateJsonPayloadBytes, scheduleEndpointBudget, type ScheduleTelemetryView } from '@/lib/scheduling/scheduleTelemetry';

type EndpointTelemetryInput = {
  view: 'board' | 'gantt';
  status: number;
  payload: unknown;
  meta?: Record<string, string | number | boolean | null>;
};

function durationMs(context: PortalServerLogContext): number {
  if (typeof context.startedAt !== 'number' || !Number.isFinite(context.startedAt)) return 0;
  return Number((performance.now() - context.startedAt).toFixed(1));
}

function shouldLog(input: { status: number; overDurationBudget: boolean; overPayloadBudget: boolean }): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (input.status >= 400 || input.overDurationBudget || input.overPayloadBudget) return true;
  return Math.random() < 0.05;
}

export function logScheduleEndpointTelemetry(context: PortalServerLogContext, input: EndpointTelemetryInput): void {
  const budget = scheduleEndpointBudget(input.view);
  const duration = durationMs(context);
  const payloadBytes = estimateJsonPayloadBytes(input.payload);
  const overDurationBudget = duration > budget.totalMs;
  const overPayloadBudget = payloadBytes > budget.payloadBytes;
  if (!shouldLog({ status: input.status, overDurationBudget, overPayloadBudget })) return;

  console.info('[portal]', {
    event: 'schedule.endpoint',
    requestId: context.requestId ?? null,
    route: context.route,
    method: context.method,
    status: input.status,
    view: input.view,
    durationMs: duration,
    payloadBytes,
    durationBudgetMs: budget.totalMs,
    payloadBudgetBytes: budget.payloadBytes,
    overDurationBudget,
    overPayloadBudget,
    ...(input.meta ?? {}),
  });
}

export function logScheduleClientTelemetry(context: PortalServerLogContext, event: {
  event: string;
  view?: ScheduleTelemetryView;
  reason?: string;
  requestId?: string | null;
  timings?: Record<string, number>;
  counts?: Record<string, number>;
  meta?: Record<string, string | number | boolean | null>;
  createdAt?: string;
}): void {
  console.info('[portal]', {
    event: `schedule.client.${event.event}`,
    requestId: context.requestId ?? null,
    route: context.route,
    method: context.method,
    view: event.view ?? 'unknown',
    reason: event.reason,
    clientRequestId: event.requestId ?? null,
    clientCreatedAt: event.createdAt,
    ...(event.timings ? { timings: event.timings } : null),
    ...(event.counts ? { counts: event.counts } : null),
    ...(event.meta ? { meta: event.meta } : null),
  });
}
