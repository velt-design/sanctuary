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

  // PR-T6 (2026-05-26): when `unit` is set the input renders inside a
  // wrapper that pins the unit suffix to the right. Avoids forcing the
  // label to carry `(m)`/`(mm)`/`(deg)` (item #2 in the visual tightening
  // batch) and lets the value read naturally — "7.04 m" rather than
  // "Roof span (m) 7.04".
  const inputElement = (
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
  );
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{field.label}</span>
      {field.unit ? (
        <span className={styles.inputWithUnit}>
          {inputElement}
          <span className={styles.inputUnit} aria-hidden="true">{field.unit}</span>
        </span>
      ) : (
        inputElement
      )}
      {field.error ? <span className={styles.fieldError}>{field.error}</span> : field.helperText ? <span className={styles.fieldHint}>{field.helperText}</span> : null}
    </label>
  );
}
