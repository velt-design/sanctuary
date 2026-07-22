'use client';

import { useState } from 'react';
import {
  CALCULATOR_JOB_TEMPLATES,
  type CalculatorJobTemplateKey,
} from './calculatorJobTemplates';
import styles from './CalculatorJobTemplates.module.css';

export default function CalculatorJobTemplatePicker({
  onApply,
}: {
  onApply: (templateKey: CalculatorJobTemplateKey) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<CalculatorJobTemplateKey>('attached_pitched_acrylic');
  const selected = CALCULATOR_JOB_TEMPLATES.find((template) => template.key === selectedKey)
    ?? CALCULATOR_JOB_TEMPLATES[0];

  return (
    <section className={styles.card} aria-label="Common job templates">
      <div className={styles.copy}>
        <strong>Common starting template</strong>
        <span>{selected.description}</span>
      </div>
      <div className={styles.actions}>
        <select
          aria-label="Common job template"
          value={selectedKey}
          onChange={(event) => setSelectedKey(event.target.value as CalculatorJobTemplateKey)}
        >
          {CALCULATOR_JOB_TEMPLATES.map((template) => (
            <option key={template.key} value={template.key}>{template.label}</option>
          ))}
        </select>
        <button type="button" onClick={() => onApply(selectedKey)}>Apply to active module</button>
      </div>
    </section>
  );
}
