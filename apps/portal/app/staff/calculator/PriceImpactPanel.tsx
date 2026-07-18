import styles from './CalculatorGrid.module.css';
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
    <section className={styles.previewCard} aria-label="Price impact">
      <div className={styles.impactHeader}>
        <h2 className={styles.previewCardTitle} style={{ margin: 0 }}>
          True cost change
        </h2>
        <button type="button" className={styles.impactReset} onClick={onResetBaseline}>
          Reset baseline
        </button>
      </div>

      {!diff ? (
        <p className={styles.previewMuted}>No baseline yet. Make a change to see deltas.</p>
      ) : (
        <>
          <div className={styles.impactGrid}>
            <div className={styles.impactStat}>
              <span>True cost (inc)</span>
              <strong>{fmtMoney(diff.delta.total_inc)}</strong>
            </div>
            <div className={styles.impactStat}>
              <span>True cost (ex)</span>
              <strong>{fmtMoney(diff.delta.total_ex)}</strong>
            </div>
            <div className={styles.impactStat}>
              <span>Materials</span>
              <strong>{fmtMoney(diff.delta.materials_ex)}</strong>
            </div>
            <div className={styles.impactStat}>
              <span>Install</span>
              <strong>{fmtMoney(diff.delta.install_ex)}</strong>
            </div>
            <div className={styles.impactStat}>
              <span>Overhead</span>
              <strong>{fmtMoney(diff.delta.overhead_ex)}</strong>
            </div>
            <div className={styles.impactStat}>
              <span>Crew hrs</span>
              <strong>{fmtNumber(diff.delta.crew_hours, 'h')}</strong>
            </div>
            <div className={styles.impactStat}>
              <span>Install days</span>
              <strong>{fmtNumber(diff.delta.install_days, 'd')}</strong>
            </div>
          </div>

          {isAdvancedUi ? (
            <div className={styles.impactDrivers}>
              <div>
                <div className={styles.impactDriversTitle}>Top materials changes</div>
                {diff.materialsDrivers.length ? (
                  <ul className={styles.impactList}>
                    {diff.materialsDrivers.map((driver) => (
                      <li key={driver.id} className={styles.impactRow}>
                        <span className={styles.impactRowLabel}>{driver.label}</span>
                        <span className={styles.impactRowDelta}>{fmtMoney(driver.delta)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.previewMuted}>No material deltas.</p>
                )}
              </div>

              <div>
                <div className={styles.impactDriversTitle}>Top labour changes</div>
                {diff.installDrivers.length ? (
                  <ul className={styles.impactList}>
                    {diff.installDrivers.map((driver) => (
                      <li key={driver.id} className={styles.impactRow}>
                        <span className={styles.impactRowLabel}>{driver.label}</span>
                        <span className={styles.impactRowDelta}>{fmtNumber(driver.delta, 'min')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.previewMuted}>No labour deltas.</p>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
