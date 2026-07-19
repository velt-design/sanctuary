import gridStyles from './CalculatorGrid.module.css';
import styles from './PriceImpactPanel.module.css';
import type { ImpactDiff } from './diff';
import {
  buildPriceImpactPresentation,
  formatImpactMoney,
  formatImpactNumber,
} from './priceImpactPresentation';

export default function PriceImpactPanel({
  diff,
  isAdvancedUi,
  onResetBaseline,
}: {
  diff: ImpactDiff | null;
  isAdvancedUi: boolean;
  onResetBaseline: () => void;
}) {
  const presentation = diff ? buildPriceImpactPresentation(diff) : null;

  return (
    <section className={gridStyles.previewCard} aria-label="Price impact">
      <div className={styles.header}>
        <h2 className={`${gridStyles.previewCardTitle} ${styles.title}`}>True cost change</h2>
        <button type="button" className={styles.reset} onClick={onResetBaseline}>
          Reset baseline
        </button>
      </div>

      {!diff || !presentation ? (
        <p className={gridStyles.previewMuted}>No baseline yet. Make a change to see deltas.</p>
      ) : (
        <>
          <div className={styles.hero}>
            <span>True cost change (inc GST)</span>
            <strong>{formatImpactMoney(presentation.totalInc)}</strong>
            <small>Ex GST {formatImpactMoney(presentation.totalEx)}</small>
          </div>

          {presentation.categories.length ? (
            <dl className={styles.categoryGrid} aria-label="Largest cost changes">
              {presentation.categories.map((category) => (
                <div key={category.id} className={styles.category}>
                  <dt>{category.label}</dt>
                  <dd>{formatImpactMoney(category.value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className={styles.noChange}>No cost change from baseline.</p>
          )}

          <dl className={styles.operations} aria-label="Operational changes">
            <div>
              <dt>Crew hours</dt>
              <dd>{formatImpactNumber(presentation.crewHours, 'h')}</dd>
            </div>
            <div>
              <dt>Install days</dt>
              <dd>{formatImpactNumber(presentation.installDays, 'd')}</dd>
            </div>
          </dl>

          {isAdvancedUi ? (
            <div className={styles.drivers}>
              <div>
                <div className={styles.driversTitle}>Top materials changes</div>
                {diff.materialsDrivers.length ? (
                  <ul className={styles.list}>
                    {diff.materialsDrivers.map((driver) => (
                      <li key={driver.id} className={styles.row}>
                        <span className={styles.rowLabel}>{driver.label}</span>
                        <span className={styles.rowDelta}>{formatImpactMoney(driver.delta)}</span>
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
                        <span className={styles.rowDelta}>{formatImpactNumber(driver.delta, 'min')}</span>
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
