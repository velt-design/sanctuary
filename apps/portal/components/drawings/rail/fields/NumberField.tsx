'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RailFieldDefinition } from './RailFieldTypes';
import styles from '../WorkbenchRail.module.css';

export function NumberField(field: Extract<RailFieldDefinition, { kind: 'number' }>) {
  const [draft, setDraft] = useState(field.value);

  useEffect(() => {
    setDraft(field.value);
  }, [field.value]);

  const commit = useCallback(async () => {
    if (draft === field.value) return;
    await field.onCommit(draft);
  }, [draft, field]);

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{field.label}</span>
      <input
        id={field.id}
        className={styles.input}
        aria-label={field.label}
        inputMode="decimal"
        value={draft}
        disabled={field.disabled || field.pending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(field.value);
          }
        }}
      />
      {field.error ? <span className={styles.fieldError}>{field.error}</span> : field.helperText ? <span className={styles.fieldHint}>{field.helperText}</span> : null}
    </label>
  );
}
