'use client';

import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import {
  CALCULATOR_JOB_TEMPLATES,
  type CalculatorJobTemplateKey,
} from './calculatorJobTemplates';
import styles from './CalculatorJobTemplates.module.css';

export default function CalculatorJobTemplatePicker({
  activeModuleLabel,
  onApply,
}: {
  activeModuleLabel: string;
  onApply: (templateKey: CalculatorJobTemplateKey) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<CalculatorJobTemplateKey>('attached_pitched_acrylic');
  const [confirmOpen, setConfirmOpen] = useState(false);
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
        <button type="button" onClick={() => setConfirmOpen(true)}>Apply to active module</button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Apply starting template?"
        body={`Replace the current configuration for ${activeModuleLabel} with “${selected.label}”? Pergola name and site-level allowances stay unchanged.`}
        confirmLabel="Apply template"
        onConfirm={() => {
          onApply(selectedKey);
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}
