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
      className={styles.diagnostics}
    >
      <div className={styles.diagnosticsHeader}>
        <div className={styles.diagnosticsHeading}>
          <strong className={styles.diagnosticsTitle}>Diagnostics (dev only)</strong>
          <span className={styles.diagnosticsDescription}>
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
        <div className={styles.diagnosticsBody}>
          <button
            type="button"
            className={styles.buttonSecondary}
            disabled={busy}
            onClick={onRun}
          >
            {busy ? 'Checking…' : 'Run diagnostics'}
          </button>

          {diagnostics ? (
            <div className={`${styles.note} ${styles.diagnosticsResult}`}>
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
            <p className={`${styles.note} ${styles.diagnosticsResult}`}>
              Click “Run diagnostics” to test PostgREST access.
            </p>
          )}

          <div className={`${styles.note} ${styles.diagnosticsTelemetry}`}>
            <strong>Recent schedule telemetry</strong>
            {recentTelemetryEvents.length ? (
              <ul className={styles.diagnosticsList}>
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
              <div className={styles.diagnosticsEmpty}>
                No client schedule telemetry yet.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
