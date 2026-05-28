'use client';

import type { RailFieldDefinition } from './RailFieldTypes';
import styles from '../WorkbenchRail.module.css';

export function SelectField(field: Extract<RailFieldDefinition, { kind: 'select' }>) {
  // PR-T6 (2026-05-26): when `mutedWhenEmpty` is on and the current value
  // is '' (the override-system's "auto / system default" sentinel), apply
  // the muted-text class so the resolved-default value reads as visibly
  // softer than a manually picked override. Existing tokens only — no new
  // colors introduced.
  const isAutoResolved = Boolean(field.mutedWhenEmpty) && field.value === '';
  const selectClassName = isAutoResolved
    ? `${styles.select} ${styles.selectMuted}`
    : styles.select;
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{field.label}</span>
      <select
        id={field.id}
        className={selectClassName}
        aria-label={field.label}
        value={field.value}
        disabled={field.disabled || field.pending}
        onChange={(event) => void field.onCommit(event.target.value)}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {field.error ? <span className={styles.fieldError}>{field.error}</span> : field.helperText ? <span className={styles.fieldHint}>{field.helperText}</span> : null}
    </label>
  );
}
