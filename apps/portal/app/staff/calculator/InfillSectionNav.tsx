import styles from './CalculatorGrid.module.css';

export type InfillEditorSectionId = 'basic' | 'supports' | 'advanced' | 'preview' | 'cut_list';

type InfillSectionNavProps = {
  value: InfillEditorSectionId;
  warningsCount: number;
  onChange: (next: InfillEditorSectionId) => void;
};

const NAV_ITEMS: Array<{ id: InfillEditorSectionId; label: string }> = [
  { id: 'basic', label: 'Basic' },
  { id: 'supports', label: 'Supports' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'preview', label: 'Preview' },
  { id: 'cut_list', label: 'Cut list' },
];

export default function InfillSectionNav({ value, warningsCount, onChange }: InfillSectionNavProps) {
  return (
    <div className={styles.infillSectionNav} role="tablist" aria-label="Infill sections">
      {NAV_ITEMS.map((item) => {
        const active = value === item.id;
        const label = item.id === 'preview' && warningsCount > 0 ? `Preview (${warningsCount})` : item.label;
        return (
          <button
            key={item.id}
            id={`infill-nav-${item.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? `${styles.infillSectionNavButton} ${styles.infillSectionNavButtonActive}` : styles.infillSectionNavButton}
            onClick={() => onChange(item.id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
