export type ScheduleTelemetryView = 'board' | 'gantt' | 'site_visits' | 'legacy' | 'unknown';

export type ScheduleClientTelemetryEvent = {
  event: string;
  view?: ScheduleTelemetryView;
  reason?: string;
  requestId?: string | null;
  timings?: Record<string, number>;
  counts?: Record<string, number>;
  meta?: Record<string, string | number | boolean | null>;
  createdAt?: string;
};

const SCHEDULE_ENDPOINT_BUDGETS = {
  board: {
    totalMs: 1_500,
    payloadBytes: 450_000,
  },
  gantt: {
    totalMs: 1_200,
    payloadBytes: 350_000,
  },
} as const;

export const SCHEDULE_CLIENT_TELEMETRY_MAX_BYTES = 4_096;
const SAFE_META_KEYS = new Set(['errorType', 'generatedAt', 'initialReason', 'initialSeedKind', 'loadSource', 'source', 'status', 'table']);

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  return value.length;
}

export function estimateJsonPayloadBytes(payload: unknown): number {
  try {
    return byteLength(JSON.stringify(payload));
  } catch {
    return 0;
  }
}

function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function cleanEventName(value: unknown): string | undefined {
  const raw = cleanString(value, 80);
  if (!raw) return undefined;
  return raw.replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 80);
}

function cleanView(value: unknown): ScheduleTelemetryView {
  if (value === 'board' || value === 'gantt' || value === 'site_visits' || value === 'legacy') return value;
  return 'unknown';
}

function cleanNumberRecord(value: unknown, maxKeys = 12): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value).slice(0, maxKeys)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    const cleanKey = cleanString(key, 40);
    if (!cleanKey) continue;
    out[cleanKey] = Number(raw.toFixed(1));
  }
  return Object.keys(out).length ? out : undefined;
}

function cleanMeta(value: unknown, maxKeys = 12): Record<string, string | number | boolean | null> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(value).slice(0, maxKeys)) {
    const cleanKey = cleanString(key, 40);
    if (!cleanKey) continue;
    if (!SAFE_META_KEYS.has(cleanKey)) continue;
    if (typeof raw === 'string') {
      const cleanValue = cleanString(raw, 80);
      if (cleanValue && /^[a-zA-Z0-9_.:-]+$/.test(cleanValue)) out[cleanKey] = cleanValue;
    }
    else if (typeof raw === 'number' && Number.isFinite(raw)) out[cleanKey] = Number(raw.toFixed(1));
    else if (typeof raw === 'boolean' || raw === null) out[cleanKey] = raw;
  }
  return Object.keys(out).length ? out : undefined;
}

export function sanitizeScheduleClientTelemetryEvent(input: unknown): ScheduleClientTelemetryEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const event = cleanEventName(record.event);
  if (!event) return null;

  const sanitized: ScheduleClientTelemetryEvent = {
    event,
    view: cleanView(record.view),
    createdAt: new Date().toISOString(),
  };
  const reason = cleanString(record.reason, 80);
  if (reason) sanitized.reason = reason;
  const requestId = cleanString(record.requestId, 120);
  if (requestId) sanitized.requestId = requestId;
  const timings = cleanNumberRecord(record.timings);
  if (timings) sanitized.timings = timings;
  const counts = cleanNumberRecord(record.counts);
  if (counts) sanitized.counts = counts;
  const meta = cleanMeta(record.meta);
  if (meta) sanitized.meta = meta;

  return estimateJsonPayloadBytes(sanitized) <= SCHEDULE_CLIENT_TELEMETRY_MAX_BYTES ? sanitized : {
    event,
    view: sanitized.view,
    reason: 'payload_trimmed',
    createdAt: sanitized.createdAt,
  };
}

export function scheduleEndpointBudget(view: 'board' | 'gantt') {
  return SCHEDULE_ENDPOINT_BUDGETS[view];
}
