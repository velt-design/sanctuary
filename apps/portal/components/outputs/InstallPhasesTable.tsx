'use client';

import styles from '@/components/ui/surface/PortalSurface.module.css';
import type { InstallPhase } from '@/lib/outputs/types';

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

export default function InstallPhasesTable({ phases }: { phases: InstallPhase[] }) {
  return (
    <section className={styles.section} aria-label="Install phases">
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Install phases</h3>
      </div>
      <div className={styles.sectionBody}>
        {phases.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Minutes</th>
                  <th>Cost ex‑GST</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {phases.map((p) => (
                  <tr key={p.phaseId}>
                    <td>{p.label}</td>
                    <td>{p.minutes}</td>
                    <td>{formatMoney(p.costExGst)}</td>
                    <td className={styles.muted}>{p.actions.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.note}>No install actions.</p>
        )}
      </div>
    </section>
  );
}
