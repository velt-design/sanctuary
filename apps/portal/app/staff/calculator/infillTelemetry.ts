type InfillTelemetryEventName =
  | 'infill_modal_open'
  | 'infill_add'
  | 'infill_select'
  | 'infill_duplicate'
  | 'infill_duplicate_bulk'
  | 'infill_reorder'
  | 'infill_copy_geometry'
  | 'infill_paste_geometry'
  | 'infill_delete'
  | 'infill_undo_delete'
  | 'infill_auto_switch_triggered'
  | 'infill_warning_clicked'
  | 'infill_resolve_mode_open'
  | 'infill_resolve_apply_fix'
  | 'infill_done';

type InfillTelemetryPayload = Record<string, unknown>;

type BrowserWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

function sanitizePayload(payload: InfillTelemetryPayload): InfillTelemetryPayload {
  const out: InfillTelemetryPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      // Keep payload enum-like and avoid leaking free-form text.
      if (value.length > 80) continue;
      out[key] = value;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value
        .filter((entry) => typeof entry === 'string' || typeof entry === 'number')
        .slice(0, 20);
    }
  }
  return out;
}

export function trackInfillEvent(name: InfillTelemetryEventName, payload: InfillTelemetryPayload = {}): void {
  if (typeof window === 'undefined') return;
  const safePayload = sanitizePayload(payload);
  const detail = { name, payload: safePayload, ts: Date.now() };

  try {
    window.dispatchEvent(new CustomEvent('portal.infill.telemetry', { detail }));
  } catch {
    // Ignore instrumentation failures.
  }

  try {
    const w = window as BrowserWindow;
    if (typeof w.gtag === 'function') {
      w.gtag('event', name, safePayload);
    } else if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event: name, ...safePayload });
    }
  } catch {
    // Analytics should never break the workflow.
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[infill telemetry]', name, safePayload);
  }
}
