type ScheduleDebugPayload = Record<string, unknown>;

function isBrowserDebugEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('sp_schedule_debug') === '1';
  } catch {
    return false;
  }
}

export function logScheduleDebug(event: string, payload: ScheduleDebugPayload = {}): void {
  if (!isBrowserDebugEnabled()) return;
  if (typeof console === 'undefined' || typeof console.debug !== 'function') return;
  console.debug('[schedule]', { event, ...payload });
}
