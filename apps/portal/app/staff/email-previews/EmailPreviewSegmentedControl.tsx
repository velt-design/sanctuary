import styles from './email-previews.module.css';

type SegmentedOption<T extends string | number> = Readonly<{
  value: T;
  label: string;
  description?: string;
}>;

export function EmailPreviewSegmentedControl<T extends string | number>({
  label,
  options,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.segmentedField}>
      <legend>{label}</legend>
      <div className={styles.segmented}>
        {options.map((option) => (
          <button
            type="button"
            className={styles.segment}
            key={String(option.value)}
            data-segment-value={String(option.value)}
            aria-pressed={option.value === value}
            title={option.description}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            <span>{option.label}</span>
            {option.description ? <small>{option.description}</small> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
