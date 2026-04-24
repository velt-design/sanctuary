'use client';

import styles from './schedule.module.css';
import type { ScheduleClientTelemetryEvent } from '@/lib/scheduling/scheduleTelemetry';

export type ScheduleDiagnosticsResult = {
  host: string | null;
  crewsOk: boolean;
  crewsError?: string;
  itemsOk: boolean;
  itemsError?: string;
  projectsOk: boolean;
  projectsError?: string;
  estimatesOk: boolean;
  estimatesError?: string;
};

export default function ScheduleDiagnosticsPanel({
  open,
  busy,
  diagnostics,
  recentTelemetryEvents = [],
  onToggle,
  onRun,
}: {
  open: boolean;
  busy: boolean;
  diagnostics: ScheduleDiagnosticsResult | null;
  recentTelemetryEvents?: ScheduleClientTelemetryEvent[];
  onToggle: () => void;
  onRun: () => void;
}) {
  return (
    <div
      aria-label="Schedule diagnostics"
      style={{
        marginTop: 12,
        border: '1px solid rgba(var(--portal-text-rgb), 0.14)',
        borderRadius: 14,
        background: 'rgba(var(--portal-bg-surface-rgb), 0.92)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <strong style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Diagnostics (dev only)</strong>
          <span className={styles.muted} style={{ fontSize: 12 }}>
            Checks projects + estimates + schedule tables
          </span>
        </div>
        <button
          type="button"
          className={styles.buttonSecondary}
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open ? (
        <div style={{ padding: 12, borderTop: '1px solid rgba(var(--portal-text-rgb), 0.08)' }}>
          <button
            type="button"
            className={styles.buttonSecondary}
            disabled={busy}
            onClick={onRun}
          >
            {busy ? 'Checking…' : 'Run diagnostics'}
          </button>

          {diagnostics ? (
            <div className={styles.note} style={{ marginTop: 12 }}>
              <div>
                Host: <strong>{diagnostics.host || '—'}</strong>
              </div>
              <div>
                schedule_crews: <strong>{diagnostics.crewsOk ? 'OK' : 'FAIL'}</strong>
                {!diagnostics.crewsOk && diagnostics.crewsError ? <div className={styles.muted}>{diagnostics.crewsError}</div> : null}
              </div>
              <div>
                schedule_items: <strong>{diagnostics.itemsOk ? 'OK' : 'FAIL'}</strong>
                {!diagnostics.itemsOk && diagnostics.itemsError ? <div className={styles.muted}>{diagnostics.itemsError}</div> : null}
              </div>
              <div>
                projects: <strong>{diagnostics.projectsOk ? 'OK' : 'FAIL'}</strong>
                {!diagnostics.projectsOk && diagnostics.projectsError ? <div className={styles.muted}>{diagnostics.projectsError}</div> : null}
              </div>
              <div>
                estimates: <strong>{diagnostics.estimatesOk ? 'OK' : 'FAIL'}</strong>
                {!diagnostics.estimatesOk && diagnostics.estimatesError ? <div className={styles.muted}>{diagnostics.estimatesError}</div> : null}
              </div>
            </div>
          ) : (
            <p className={styles.note} style={{ marginTop: 12 }}>
              Click “Run diagnostics” to test PostgREST access.
            </p>
          )}

          <div className={styles.note} style={{ marginTop: 12 }}>
            <strong>Recent schedule telemetry</strong>
            {recentTelemetryEvents.length ? (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {recentTelemetryEvents.map((event, index) => (
                  <li key={`${event.createdAt ?? 'event'}-${event.event}-${index}`}>
                    <code>{event.event}</code>
                    {event.view ? <> / {event.view}</> : null}
                    {event.reason ? <> / {event.reason}</> : null}
                    {event.requestId ? <> / {event.requestId}</> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.muted} style={{ marginTop: 8 }}>
                No client schedule telemetry yet.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
