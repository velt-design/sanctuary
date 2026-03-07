'use client';

export type WarningItem = { level: 'critical' | 'info'; message: string };

export default function EstimateWarnings({ warnings }: { warnings: WarningItem[] }) {
  const critical = warnings.filter((w) => w.level === 'critical');
  const info = warnings.filter((w) => w.level === 'info');

  if (!warnings.length) return <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--portal-text-rgb), 0.75)' }}>No warnings.</p>;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {critical.length ? (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgb(185, 28, 28)' }}>
            Critical
          </div>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
            {critical.map((w, idx) => (
              <li key={`c-${idx}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {info.length ? (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(var(--portal-text-rgb), 0.8)' }}>
            Info
          </div>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
            {info.map((w, idx) => (
              <li key={`i-${idx}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
