'use client';

import styles from './CalculatorGrid.module.css';
import type { CalculatorMaterialsDebugController } from './useCalculatorMaterialsDebug';

function formatMoney(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(2)}` : '—';
}

function formatNumber(value: number | undefined, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

export default function CalculatorMaterialsDebugPanel({
  controller,
}: {
  controller: CalculatorMaterialsDebugController;
}) {
  return (
    <section className={styles.previewCard} aria-label="Materials debug">
      <div className={styles.materialsDebugHeader}>
        <h2 className={`${styles.previewCardTitle} ${styles.previewCardTitleFlush}`}>Materials debug</h2>
        {!controller.available ? <span className={styles.previewMuted}>Disabled</span> : null}
      </div>
      {controller.available ? (
        <>
          <div className={styles.materialsDebugControls}>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                className={styles.toggleBox}
                checked={controller.enabled}
                onChange={(event) => controller.setEnabled(event.target.checked)}
              />
              <span className={styles.toggleText}>Materials Debug</span>
            </label>
            <label className={styles.materialsDebugDetail}>
              <span>Detail</span>
              <select
                className={styles.control}
                value={controller.detail}
                onChange={(event) => controller.setDetail(event.target.value === 'full' ? 'full' : 'summary')}
                disabled={!controller.enabled}
              >
                <option value="summary">summary</option>
                <option value="full">full</option>
              </select>
            </label>
          </div>

          {controller.enabled ? (
            <>
              {controller.loading ? <p className={styles.previewMuted}>Loading materials trace…</p> : null}
              {controller.error ? <p className={styles.previewError}>{controller.error}</p> : null}

              {controller.materialsLines.length ? (
                <div className={styles.materialsDebugList}>
                  {controller.materialsLines.map((line, index) => {
                    const isSelected = controller.focusLineIndex === index;
                    return (
                      <button
                        key={`${line.id}-${index}`}
                        type="button"
                        className={isSelected ? styles.materialsDebugRowActive : styles.materialsDebugRow}
                        onClick={() => controller.setFocusLineIndex(index)}
                      >
                        <span>{`${index}. ${line.label}`}</span>
                        <span>{`${formatNumber(line.qty)} ${line.unit}`}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.previewMuted}>No materials trace lines yet.</p>
              )}

              {controller.selectedExplainLine && controller.selectedMaterialLine ? (
                <div className={styles.materialsDebugExplain}>
                  <div className={styles.previewRow}>
                    <span className={styles.previewRowLabel}>
                      {`${controller.selectedExplainLine.line_index}. ${controller.selectedMaterialLine.label}`}
                    </span>
                    <span className={styles.previewRowValue}>
                      {formatMoney(controller.selectedMaterialLine.line_cost_ex_gst)}
                    </span>
                  </div>
                  <div className={styles.previewRowMeta}>
                    {formatNumber(controller.selectedMaterialLine.qty)} {controller.selectedMaterialLine.unit} @{' '}
                    {formatMoney(controller.selectedMaterialLine.unit_cost_ex_gst)}
                  </div>
                  {controller.selectedExplainLine.kind === 'extrusion_bar' ? (
                    <div className={styles.previewRowMeta}>
                      {`cut_group_key: ${controller.selectedExplainLine.cut_group_key}`}
                    </div>
                  ) : null}
                  {controller.selectedExplainLine.kind === 'rule_hardware' ? (
                    <div className={styles.previewRowMeta}>
                      {`rule: ${controller.selectedExplainLine.rule_id} | expr: ${controller.selectedExplainLine.expr}`}
                    </div>
                  ) : null}
                  <pre className={styles.materialsDebugJson}>{controller.selectedExplainJson}</pre>
                </div>
              ) : null}

              {controller.materialsExplain ? (
                <div className={styles.materialsDebugActions}>
                  <button type="button" className={styles.drawerClose} onClick={() => void controller.copyJson()}>
                    Copy JSON
                  </button>
                  <button type="button" className={styles.drawerClose} onClick={controller.downloadJson}>
                    Download JSON
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className={styles.previewMuted}>Enable to load line-by-line materials formulas and trace output.</p>
          )}
        </>
      ) : (
        <p className={styles.previewMuted}>Available only outside production (or with COSTING_DEBUG_ENABLED=1).</p>
      )}
    </section>
  );
}
