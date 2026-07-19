import styles from './CalculatorGrid.module.css';
import type { InfillOpeningTemplate } from './infillOpeningTemplates';

type InfillShapeTemplatePickerProps = {
  domIdBase: string;
  value: InfillOpeningTemplate;
  onChange: (template: InfillOpeningTemplate) => void;
};

const templates: Array<{
  value: InfillOpeningTemplate;
  label: string;
  description: string;
  points: string;
}> = [
  {
    value: 'rectangle',
    label: 'Rectangle',
    description: 'Same height on both sides',
    points: '15,45 81,45 81,13 15,13',
  },
  {
    value: 'sloping_top',
    label: 'Sloping top',
    description: 'One side higher than the other',
    points: '15,45 81,45 81,12 15,25',
  },
  {
    value: 'triangle',
    label: 'Triangle',
    description: 'Tapers to a point on one side',
    points: '15,45 81,45 81,12',
  },
];

export default function InfillShapeTemplatePicker({
  domIdBase,
  value,
  onChange,
}: InfillShapeTemplatePickerProps) {
  const helpId = `${domIdBase}-shape-template-help`;
  return (
    <fieldset className={styles.infillShapeTemplateFieldset} aria-describedby={helpId}>
      <legend>Opening shape</legend>
      <p id={helpId}>Choose the outline that matches the finished opening.</p>
      <div className={styles.infillShapeTemplateGrid}>
        {templates.map((template) => {
          const id = `${domIdBase}-shape-template-${template.value}`;
          const selected = value === template.value;
          return (
            <label key={template.value} htmlFor={id} className={styles.infillShapeTemplateCard}>
              <input
                id={id}
                type="radio"
                name={`${domIdBase}-shape-template`}
                value={template.value}
                checked={selected}
                onChange={() => onChange(template.value)}
              />
              {selected ? (
                <span className={styles.infillShapeTemplateSelected} aria-hidden="true">
                  <span>✓</span> Selected
                </span>
              ) : null}
              <svg viewBox="0 0 96 56" aria-hidden="true" className={styles.infillShapeTemplateIcon}>
                <polygon points={template.points} />
                <line x1="10" y1="45" x2="86" y2="45" />
              </svg>
              <span className={styles.infillShapeTemplateCopy}>
                <strong>{template.label}</strong>
                <small>{template.description}</small>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
