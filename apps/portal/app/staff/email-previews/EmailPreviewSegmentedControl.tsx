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
  showDescriptions = false,
  controls,
  onChange,
}: {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  disabled?: boolean;
  showDescriptions?: boolean;
  controls?: string;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset
      className={styles.segmentedField}
      data-segmented-control={label.toLowerCase().replace(/\s+/g, '-')}
    >
      <legend>{label}</legend>
      <div className={styles.segmented}>
        {options.map((option) => (
          <button
            type="button"
            className={styles.segment}
            key={String(option.value)}
            data-segment-value={String(option.value)}
            aria-pressed={option.value === value}
            aria-controls={controls}
            aria-label={
              option.description
                ? `${label}: ${option.label}. ${option.description}`
                : `${label}: ${option.label}`
            }
            title={option.description}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            <span>{option.label}</span>
            {showDescriptions && option.description ? (
              <small aria-hidden="true">{option.description}</small>
            ) : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
