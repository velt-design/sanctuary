import styles from './CalculatorGrid.module.css';
import type { InputHTMLAttributes, ReactNode } from 'react';

export type FieldOption = { label: string; value: string };

export type FieldTileType =
  | 'number'
  | 'text'
  | 'select'
  | 'toggle'
  | 'readOnly'
  | 'action'
  | 'custom';

type FieldTileProps = {
  id: string;
  label: string;
  type: FieldTileType;
  value?: string | boolean;
  content?: ReactNode;
  onChange?: (next: string | boolean) => void;
  onBlur?: (next: string) => void;
  onEnter?: (next: string) => void;
  options?: FieldOption[];
  disabled?: boolean;
  helperText?: string;
  error?: string;
  onAction?: () => void;
  actionLabel?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  step?: number | string;
};

export default function FieldTile({
  id,
  label,
  type,
  value,
  content,
  onChange,
  onBlur,
  onEnter,
  options,
  disabled,
  helperText,
  error,
  onAction,
  actionLabel,
  inputMode,
  step,
}: FieldTileProps) {
  const helperId = helperText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;
  const isChecked = value === true;

  return (
    <div className={styles.tile}>
      {type === 'custom' ? (
        <div className={styles.label}>{label}</div>
      ) : (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}

      {type === 'custom' ? (
        <div id={id} className={styles.customContent} aria-describedby={describedBy}>
          {content}
        </div>
      ) : type === 'select' ? (
        <select
          id={id}
          className={styles.control}
          value={String(value ?? '')}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        >
          {(options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'toggle' ? (
        <div className={styles.toggleRow}>
          <input
            id={id}
            className={styles.toggleBox}
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onChange?.(e.target.checked)}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
          />
          <span className={styles.toggleText}>{isChecked ? 'On' : 'Off'}</span>
        </div>
      ) : type === 'readOnly' ? (
        <output id={id} className={styles.readOnlyValue} aria-describedby={describedBy}>
          {String(value ?? '')}
        </output>
      ) : type === 'action' ? (
        <button
          id={id}
          type="button"
          className={styles.actionButton}
          onClick={onAction}
          disabled={disabled}
          aria-describedby={describedBy}
        >
          {actionLabel ?? 'Action'}
        </button>
      ) : (
        <input
          id={id}
          className={styles.control}
          type={type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={(e) => onBlur?.(e.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !onEnter) return;
            event.preventDefault();
            onEnter(event.currentTarget.value);
          }}
          onWheel={(e) => {
            if (type !== 'number') return;
            if (typeof document !== 'undefined' && document.activeElement === e.currentTarget) {
              e.currentTarget.blur();
            }
          }}
          disabled={disabled}
          inputMode={inputMode}
          step={type === 'number' ? step : undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
      )}

      {error ? (
        <div id={errorId} className={styles.error}>
          {error}
        </div>
      ) : helperText ? (
        <div id={helperId} className={styles.helper}>
          {helperText}
        </div>
      ) : null}
    </div>
  );
}
