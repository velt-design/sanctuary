'use client';

import type {
  BlindFabric,
  BlindLineItem,
  BlindRollCover,
  BlindSystemType,
} from '@/lib/types/calculator';
import FieldTile from './FieldTile';
import styles from './CalculatorGrid.module.css';
import {
  BLIND_FABRIC_OPTIONS,
  BLIND_ROLL_COVER_OPTIONS,
  BLIND_SYSTEM_OPTIONS,
  type CalculatorBlindsUi,
} from './calculatorBlindUi';

export type BlindDimensionField = 'widthMm' | 'coverLengthMm';

export default function CalculatorBlindsEditor({
  ui,
  fieldPrefix,
  displayDimensionInput,
  onDimensionChange,
  onDimensionCommit,
  onItemChange,
  onDuplicate,
  onRemove,
  onAdd,
}: {
  ui: CalculatorBlindsUi;
  fieldPrefix: string;
  displayDimensionInput: (item: BlindLineItem, field: BlindDimensionField) => string;
  onDimensionChange: (id: string, field: BlindDimensionField, value: string) => void;
  onDimensionCommit: (id: string, field: BlindDimensionField) => void;
  onItemChange: (id: string, patch: Partial<BlindLineItem>) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className={styles.blindsEditor}>
      {ui.rows.map((row, index) => {
        const item = row.item;
        const statusClassName = row.statusTone === 'error' ? styles.error : styles.helper;
        const domIdBase = `${fieldPrefix}-blind-${index + 1}`;
        return (
          <div key={item.id} className={`${styles.previewCard} ${styles.blindCard}`}>
            <div className={styles.blindCardHeader}>
              <strong>Blind {index + 1}</strong>
              <div className={styles.blindCardActions}>
                <button
                  type="button"
                  className={styles.infillSecondaryButton}
                  onClick={() => onDuplicate(item.id)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className={styles.infillSecondaryButton}
                  onClick={() => onRemove(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
            <div className={styles.blindFieldGrid}>
              <FieldTile
                id={`${domIdBase}-label`}
                label="Label"
                type="text"
                value={item.label ?? ''}
                onChange={(value) => onItemChange(item.id, { label: String(value) })}
              />
              <FieldTile
                id={`${domIdBase}-system`}
                label="System"
                type="select"
                value={item.system}
                onChange={(value) => onItemChange(item.id, { system: value as BlindSystemType })}
                options={BLIND_SYSTEM_OPTIONS}
              />
              <FieldTile
                id={`${domIdBase}-width`}
                label="Width (m)"
                type="number"
                value={displayDimensionInput(item, 'widthMm')}
                inputMode="decimal"
                step="0.001"
                onChange={(value) => onDimensionChange(item.id, 'widthMm', String(value))}
                onBlur={() => onDimensionCommit(item.id, 'widthMm')}
                onEnter={() => onDimensionCommit(item.id, 'widthMm')}
              />
              <FieldTile
                id={`${domIdBase}-cover`}
                label="Blind drop (m)"
                type="number"
                value={displayDimensionInput(item, 'coverLengthMm')}
                inputMode="decimal"
                step="0.001"
                onChange={(value) => onDimensionChange(item.id, 'coverLengthMm', String(value))}
                onBlur={() => onDimensionCommit(item.id, 'coverLengthMm')}
                onEnter={() => onDimensionCommit(item.id, 'coverLengthMm')}
              />
              <FieldTile
                id={`${domIdBase}-fabric`}
                label="Fabric"
                type="select"
                value={item.fabric}
                onChange={(value) => onItemChange(item.id, { fabric: value as BlindFabric })}
                options={BLIND_FABRIC_OPTIONS}
              />
              <FieldTile
                id={`${domIdBase}-motor`}
                label="Motorised"
                type="toggle"
                value={item.motorised === 'YES'}
                onChange={(value) => onItemChange(item.id, { motorised: value ? 'YES' : 'NONE' })}
              />
              <FieldTile
                id={`${domIdBase}-roll-cover`}
                label="Blind roll cover"
                type="select"
                value={item.rollCover ?? 'NONE'}
                onChange={(value) => onItemChange(item.id, { rollCover: value as BlindRollCover })}
                options={BLIND_ROLL_COVER_OPTIONS}
              />
              <FieldTile
                id={`${domIdBase}-total-ex`}
                label="Blind total (ex‑GST)"
                type="readOnly"
                value={row.totalExLabel}
              />
              <FieldTile
                id={`${domIdBase}-total-inc`}
                label="Blind total (inc‑GST)"
                type="readOnly"
                value={row.totalIncLabel}
              />
            </div>
            {row.showStatus ? <div className={statusClassName}>{row.statusMessage}</div> : null}
          </div>
        );
      })}

      <div className={styles.blindAddAction}>
        <button
          type="button"
          className={`${styles.infillSecondaryButton} ${styles.blindAddButton}`}
          onClick={() => onAdd()}
        >
          Add blind
        </button>
      </div>

      <div className={`${styles.previewCard} ${styles.blindTotalsCard}`}>
        <div className={styles.blindTotalRow}>
          <span>Blinds total (ex‑GST)</span>
          <span>{ui.totalExLabel}</span>
        </div>
        <div className={styles.blindTotalRow}>
          <span>Blinds total (inc‑GST)</span>
          <span>{ui.totalIncLabel}</span>
        </div>
        <div className={styles.helper}>Totals round to cents; pricing uses banded size lookup.</div>
      </div>
    </div>
  );
}
