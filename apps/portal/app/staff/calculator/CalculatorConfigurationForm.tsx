import FieldTile from './FieldTile';
import {
  buildCalculatorConfigurationSections,
  type CalculatorConfigurationField,
  type CalculatorConfigurationFieldLayout,
} from './calculatorConfigurationSections';
import styles from './CalculatorConfigurationForm.module.css';

type CalculatorConfigurationFormProps = {
  fields: readonly CalculatorConfigurationField[];
  isAdvancedUi: boolean;
};

const layoutClassNames: Record<CalculatorConfigurationFieldLayout, string> = {
  standard: styles.fieldSlot,
  wide: `${styles.fieldSlot} ${styles.fieldSlotWide}`,
  full: `${styles.fieldSlot} ${styles.fieldSlotFull}`,
};

export default function CalculatorConfigurationForm({
  fields,
  isAdvancedUi,
}: CalculatorConfigurationFormProps) {
  const sections = buildCalculatorConfigurationSections(fields, isAdvancedUi);
  const surfaces = sections.reduce<
    Array<
      | { type: 'sheet'; key: string; sections: typeof sections }
      | { type: 'card'; key: string; section: (typeof sections)[number] }
    >
  >((groups, section) => {
    if (section.surface === 'card') {
      groups.push({ type: 'card', key: section.id, section });
      return groups;
    }

    const previous = groups.at(-1);
    if (previous?.type === 'sheet') {
      previous.sections.push(section);
    } else {
      groups.push({ type: 'sheet', key: `sheet-${section.id}`, sections: [section] });
    }
    return groups;
  }, []);

  const renderSection = (section: (typeof sections)[number], surface: 'quiet' | 'card') => (
    <section
      key={section.id}
      className={`${styles.section} ${surface === 'card' ? styles.sectionCard : styles.sectionQuiet}${section.density === 'compact' ? ` ${styles.sectionCompact}` : ''}`}
      aria-label={section.title}
      data-calculator-configuration-section={section.id}
      data-section-density={section.density ?? 'default'}
      data-section-surface={surface}
    >
      {section.fieldLabelAsTitle ? null : <h2 className={styles.sectionTitle}>{section.title}</h2>}
      <div className={styles.fieldGrid} data-calculator-field-grid>
        {section.fields.map((field) => (
          <div
            key={field.id}
            className={layoutClassNames[field.layout]}
            data-calculator-field={field.id}
            data-field-layout={field.layout}
          >
            <FieldTile
              appearance="configuration"
              id={field.id}
              label={field.label}
              type={field.type}
              value={field.value}
              content={field.content}
              onChange={field.onChange}
              options={field.options}
              disabled={field.disabled}
              helperText={field.helperText}
              error={field.error}
              onAction={field.onAction}
              actionLabel={field.actionLabel}
            />
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className={styles.form} data-calculator-configuration-form>
      {surfaces.map((surface) =>
        surface.type === 'card' ? (
          renderSection(surface.section, 'card')
        ) : (
          <div key={surface.key} className={styles.sectionSheet} data-calculator-configuration-sheet>
            {surface.sections.map((section) => renderSection(section, 'quiet'))}
          </div>
        ),
      )}
    </div>
  );
}
