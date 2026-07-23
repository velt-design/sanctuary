'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  CalculatorFlashingBand,
  CalculatorFlashingPurpose,
  CalculatorFlashingsState,
} from '@/lib/types/calculator';
import styles from './CalculatorGrid.module.css';
import {
  FLASHING_BAND_OPTIONS,
  FLASHING_PURPOSE_OPTIONS,
  calculateFlashingTotalLength,
  calculateFlashingTotalsByBand,
  isDuplicatePrimaryFlashingRow,
  selectVisibleFlashingBands,
} from './calculatorFlashingUi';
import { normalizeFlashingPurpose, toNumber } from './calculatorInputs';

type FlashingRow = CalculatorFlashingsState['rows'][number];

function formatLength(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '—';
}

export default function CalculatorFlashingsEditor({
  state,
  primaryRow,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
}: {
  state: CalculatorFlashingsState;
  primaryRow: FlashingRow;
  onAddRow: () => string;
  onUpdateRow: (
    id: string,
    patch: Partial<{
      band: CalculatorFlashingBand;
      lengthM: string;
      purpose: CalculatorFlashingPurpose;
    }>,
  ) => void;
  onRemoveRow: (id: string) => void;
}) {
  const [showAllBands, setShowAllBands] = useState(false);
  const [pendingLengthFocusId, setPendingLengthFocusId] = useState<string | null>(null);
  const lengthInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const extraRows = useMemo(() => state.rows.filter((row) => row.kind === 'extra'), [state.rows]);
  const totalsByBand = useMemo(() => calculateFlashingTotalsByBand(state.rows), [state.rows]);
  const totalLength = useMemo(() => calculateFlashingTotalLength(totalsByBand), [totalsByBand]);
  const visibleBands = useMemo(
    () => selectVisibleFlashingBands(totalsByBand, showAllBands),
    [showAllBands, totalsByBand],
  );

  useEffect(() => {
    if (!pendingLengthFocusId) return;
    const target = lengthInputRefs.current[pendingLengthFocusId];
    if (!target) return;
    target.focus();
    target.select();
    setPendingLengthFocusId(null);
  }, [pendingLengthFocusId, state.rows]);

  const addRow = () => {
    setPendingLengthFocusId(onAddRow());
  };

  return (
    <div className={styles.flashingsTileContent}>
      <div className={styles.flashingsHeader}>
        <strong>Flashings</strong>
        <span className={styles.helper}>Defaults auto-apply by roof type; override each row or add extras.</span>
      </div>

      <div className={styles.flashingsTable}>
        <div className={styles.flashingsGridHeader}>
          <div>Item</div>
          <div title="This sets the flashing girth band.">Girth (mm)</div>
          <div>Length (m)</div>
          <div>Purpose</div>
          <div>Remove</div>
        </div>

        {state.rows.map((row) => {
          const isPrimary = row.kind === 'primary';
          const extraIndex = isPrimary ? -1 : extraRows.findIndex((extra) => extra.id === row.id) + 1;
          const parsedLength = toNumber(row.lengthM);
          const invalidLength = !Number.isFinite(parsedLength) || parsedLength < 0;
          const zeroLength = Number.isFinite(parsedLength) && parsedLength === 0;
          const duplicatePrimary = isDuplicatePrimaryFlashingRow(row, primaryRow);

          return (
            <div key={row.id} className={isPrimary ? styles.flashingsRowPrimary : styles.flashingsRow}>
              <div className={styles.flashingsCellItem}>
                <div className={styles.flashingsItemBadge}>{isPrimary ? 'Primary' : `Extra ${extraIndex}`}</div>
                {isPrimary ? <div className={styles.flashingsItemMeta}>Default from roof type; editable.</div> : null}
                {invalidLength ? <div className={styles.flashingsWarning}>Enter a length &gt; 0.</div> : null}
                {!invalidLength && zeroLength ? <div className={styles.flashingsWarning}>0 length will be ignored.</div> : null}
                {duplicatePrimary ? <div className={styles.flashingsWarning}>May double-count primary flashing.</div> : null}
              </div>

              <select
                id={`flashing-row-band-${row.id}`}
                className={styles.control}
                value={row.band}
                onChange={(event) => onUpdateRow(row.id, { band: event.target.value as CalculatorFlashingBand })}
              >
                {FLASHING_BAND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className={styles.flashingsLengthCell}>
                <input
                  id={`flashing-row-length-${row.id}`}
                  className={styles.control}
                  type="number"
                  min={0}
                  step="0.1"
                  value={row.lengthM}
                  ref={(node) => {
                    if (node) lengthInputRefs.current[row.id] = node;
                    else delete lengthInputRefs.current[row.id];
                  }}
                  onChange={(event) => onUpdateRow(row.id, { lengthM: event.target.value })}
                />
                <span className={styles.flashingsLengthSuffix}>m</span>
              </div>

              <select
                id={`flashing-row-purpose-${row.id}`}
                className={styles.control}
                value={normalizeFlashingPurpose(row.purpose)}
                onChange={(event) => onUpdateRow(row.id, { purpose: event.target.value as CalculatorFlashingPurpose })}
              >
                {FLASHING_PURPOSE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {isPrimary ? (
                <div className={styles.flashingsRemovePlaceholder} />
              ) : (
                <button
                  type="button"
                  className={styles.flashingsRemoveButton}
                  title="Remove row"
                  aria-label="Remove row"
                  onClick={() => onRemoveRow(row.id)}
                >
                  x
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className={styles.flashingsAddButton} onClick={addRow}>
        + Add flashing row
      </button>

      <div className={styles.flashingsTotalsCard}>
        <div className={styles.flashingsTotalsTitle}>Totals</div>
        <div className={styles.flashingsTotalsRow}>
          <span>Total</span>
          <span>{`${formatLength(totalLength)} m`}</span>
        </div>
        {visibleBands.map((band) => (
          <div key={band} className={styles.flashingsTotalsRow}>
            <span>{band}</span>
            <span>{`${formatLength(totalsByBand[band])} m`}</span>
          </div>
        ))}
        <button type="button" className={styles.flashingsTotalsToggle} onClick={() => setShowAllBands((current) => !current)}>
          {showAllBands ? 'Show non-zero bands only' : 'Show all bands'}
        </button>
      </div>
    </div>
  );
}
