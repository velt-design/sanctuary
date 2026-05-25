'use client';

import type { RailFieldDefinition } from './RailFieldTypes';
import styles from '../WorkbenchRail.module.css';

export function ToggleField(field: Extract<RailFieldDefinition, { kind: 'toggle' }>) {
  return (
    <label className={`${styles.field} ${styles.toggleField}`}>
      <div className={styles.toggleHeader}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <button
          id={field.id}
          type="button"
          aria-label={field.label}
          className={`${styles.toggleButton} ${field.value ? styles.toggleButtonActive : ''}`}
          aria-pressed={field.value}
          disabled={field.disabled || field.pending}
          onClick={() => void field.onCommit(!field.value)}
        >
          {field.value ? 'On' : 'Off'}
        </button>
      </div>
      {field.error ? <span className={styles.fieldError}>{field.error}</span> : field.helperText ? <span className={styles.fieldHint}>{field.helperText}</span> : null}
    </label>
  );
}
