'use client';

import {
  sanitizeScheduleClientTelemetryEvent,
  type ScheduleClientTelemetryEvent,
  type ScheduleTelemetryView,
} from '@/lib/scheduling/scheduleTelemetry';

const TELEMETRY_URL = '/api/staff/v1/schedule/telemetry';
const recentEvents: ScheduleClientTelemetryEvent[] = [];

function remember(event: ScheduleClientTelemetryEvent): void {
  recentEvents.unshift(event);
  recentEvents.splice(20);
}

function postTelemetry(event: ScheduleClientTelemetryEvent): void {
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([JSON.stringify(event)], { type: 'application/json' });
    if (navigator.sendBeacon(TELEMETRY_URL, blob)) return;
  }

  if (typeof fetch !== 'function') return;
  void fetch(TELEMETRY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => {});
}

export function sendScheduleTelemetry(input: {
  event: string;
  view?: ScheduleTelemetryView;
  reason?: string;
  requestId?: string | null;
  timings?: Record<string, number>;
  counts?: Record<string, number>;
  meta?: Record<string, string | number | boolean | null>;
}): ScheduleClientTelemetryEvent | null {
  const event = sanitizeScheduleClientTelemetryEvent(input);
  if (!event) return null;
  remember(event);
  postTelemetry(event);
  return event;
}

export function recentScheduleTelemetryEvents(): ScheduleClientTelemetryEvent[] {
  return recentEvents.slice(0, 10);
}
