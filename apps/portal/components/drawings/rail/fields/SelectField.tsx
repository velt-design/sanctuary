'use client';

import type { RailFieldDefinition } from './RailFieldTypes';
import styles from '../WorkbenchRail.module.css';

export function SelectField(field: Extract<RailFieldDefinition, { kind: 'select' }>) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{field.label}</span>
      <select
        id={field.id}
        className={styles.select}
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
