import gridStyles from './CalculatorGrid.module.css';
import styles from './PriceImpactPanel.module.css';
import type { ImpactDiff } from './diff';

function fmtMoney(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.005) return '$0.00';
  const sign = value > 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function fmtNumber(value?: number, suffix = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.005) return suffix ? `0 ${suffix}` : '0';
  const sign = value > 0 ? '+' : '-';
  const body = Math.abs(value).toFixed(suffix ? 0 : 2);
  return suffix ? `${sign}${body} ${suffix}` : `${sign}${body}`;
}

export default function PriceImpactPanel({
  diff,
  isAdvancedUi,
  onResetBaseline,
}: {
  diff: ImpactDiff | null;
  isAdvancedUi: boolean;
  onResetBaseline: () => void;
}) {
  return (
    <section className={gridStyles.previewCard} aria-label="Price impact">
      <div className={styles.header}>
        <h2 className={`${gridStyles.previewCardTitle} ${styles.title}`}>True cost change</h2>
        <button type="button" className={styles.reset} onClick={onResetBaseline}>
          Reset baseline
        </button>
      </div>

      {!diff ? (
        <p className={gridStyles.previewMuted}>No baseline yet. Make a change to see deltas.</p>
      ) : (
        <>
          <div className={styles.grid}>
            <div className={styles.stat}>
              <span>True cost (inc)</span>
              <strong>{fmtMoney(diff.delta.total_inc)}</strong>
            </div>
            <div className={styles.stat}>
              <span>True cost (ex)</span>
              <strong>{fmtMoney(diff.delta.total_ex)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Materials</span>
              <strong>{fmtMoney(diff.delta.materials_ex)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Install</span>
              <strong>{fmtMoney(diff.delta.install_ex)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Overhead</span>
              <strong>{fmtMoney(diff.delta.overhead_ex)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Crew hrs</span>
              <strong>{fmtNumber(diff.delta.crew_hours, 'h')}</strong>
            </div>
            <div className={styles.stat}>
              <span>Install days</span>
              <strong>{fmtNumber(diff.delta.install_days, 'd')}</strong>
            </div>
          </div>

          {isAdvancedUi ? (
            <div className={styles.drivers}>
              <div>
                <div className={styles.driversTitle}>Top materials changes</div>
                {diff.materialsDrivers.length ? (
                  <ul className={styles.list}>
                    {diff.materialsDrivers.map((driver) => (
                      <li key={driver.id} className={styles.row}>
                        <span className={styles.rowLabel}>{driver.label}</span>
                        <span className={styles.rowDelta}>{fmtMoney(driver.delta)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={gridStyles.previewMuted}>No material deltas.</p>
                )}
              </div>

              <div>
                <div className={styles.driversTitle}>Top labour changes</div>
                {diff.installDrivers.length ? (
                  <ul className={styles.list}>
                    {diff.installDrivers.map((driver) => (
                      <li key={driver.id} className={styles.row}>
                        <span className={styles.rowLabel}>{driver.label}</span>
                        <span className={styles.rowDelta}>{fmtNumber(driver.delta, 'min')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={gridStyles.previewMuted}>No labour deltas.</p>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
