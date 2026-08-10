'use client';

import type { CalculatorLightingInput } from '@/lib/types/calculator';
import FieldTile from './FieldTile';
import type { CalculatorLightingUi } from './calculatorLightingUi';
import styles from './CalculatorGrid.module.css';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default function CalculatorLightingEditor({
  ui,
  onChange,
}: {
  ui: CalculatorLightingUi;
  onChange: (patch: Partial<CalculatorLightingInput>) => void;
}) {
  const { pricing } = ui;
  return (
    <div className={styles.lightingEditor} data-calculator-lighting-editor>
      <div className={styles.lightingContext}>
        <div>
          <strong>{ui.pergolaLabel}</strong>
          <span>Rafter lighting · customer pricing includes GST</span>
        </div>
        <span>{ui.summaryText}</span>
      </div>

      {!ui.eligible ? (
        <div className={styles.lightingError} role="alert">
          Rafter lighting is currently available only for pergolas with an acrylic-roof module. Set the light quantity to 0 or restore the acrylic roof selection.
        </div>
      ) : null}

      <div className={styles.lightingFieldGrid}>
        <FieldTile
          id={`lighting-${pricing.pergolaId}-quantity`}
          label="Rafter lights"
          type="number"
          value={ui.input.lightCount}
          min={0}
          step={1}
          inputMode="numeric"
          error={pricing.errors[0]}
          onChange={(value) => onChange({ lightCount: String(value) })}
        />
        <FieldTile
          id={`lighting-${pricing.pergolaId}-dimmer`}
          label="Dimmer"
          type="toggle"
          value={ui.input.dimmer}
          onChange={(value) => onChange({ dimmer: value === true })}
        />
      </div>

      <div className={styles.lightingBreakdown} aria-label={`${ui.pergolaLabel} lighting price breakdown`}>
        <div><span>Startup labour + first driver</span><strong>{formatMoney(pricing.startupIncCents)}</strong></div>
        <div><span>{pricing.lightCount} × rafter lights</span><strong>{formatMoney(pricing.lightsIncCents)}</strong></div>
        <div><span>Dimmer</span><strong>{formatMoney(pricing.dimmerIncCents)}</strong></div>
        <div>
          <span>{pricing.additionalDriverCount} × additional drivers</span>
          <strong>{formatMoney(pricing.additionalDriversIncCents)}</strong>
        </div>
        <div className={styles.lightingTotal}>
          <span>Total including GST</span>
          <strong>{pricing.errors.length ? 'Unpriced' : formatMoney(pricing.lightingSellIncCents)}</strong>
        </div>
      </div>

      <p className={styles.helper}>
        {ui.input.dimmer
          ? 'One dimmer per pergola. Each driver supports up to 12 lights.'
          : 'Each driver supports up to 16 lights.'}
      </p>
    </div>
  );
}
