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

  return (
    <div className={styles.form} data-calculator-configuration-form>
      {sections.map((section) => (
        <section
          key={section.id}
          className={styles.section}
          aria-label={section.title}
          data-calculator-configuration-section={section.id}
        >
          <h2 className={styles.sectionTitle}>{section.title}</h2>
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
      ))}
    </div>
  );
}
