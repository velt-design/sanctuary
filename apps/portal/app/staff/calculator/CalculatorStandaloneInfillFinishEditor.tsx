'use client';

import type { CalculatorStandaloneInfillsState } from '@/lib/types/calculator';
import FieldTile from './FieldTile';
import { POWDERCOAT_STANDARD_COLOURS } from './calculatorConfigurationFieldOptions';
import styles from './CalculatorGrid.module.css';

export default function CalculatorStandaloneInfillFinishEditor({
  state,
  onChange,
}: {
  state: CalculatorStandaloneInfillsState;
  onChange: (patch: Partial<CalculatorStandaloneInfillsState>) => void;
}) {
  return (
    <div className={styles.standaloneInfillFinish}>
      <div className={styles.standaloneInfillFinishIntro}>
        These infills are fitted to an existing pergola and do not create another pergola in this estimate.
      </div>
      <div className={styles.standaloneInfillFinishFields}>
        <FieldTile
          id="standalone-infill-finish"
          label="Aluminium finish"
          type="select"
          value={state.extrusionColour}
          options={[
            { label: 'Black', value: 'Black' },
            { label: 'White', value: 'White' },
            { label: 'Powdercoat', value: 'Mill' },
          ]}
          onChange={(value) => {
            const extrusionColour = value as CalculatorStandaloneInfillsState['extrusionColour'];
            onChange({
              extrusionColour,
              ...(extrusionColour === 'Mill' && !state.powdercoatStandardColour
                ? { powdercoatStandardColour: POWDERCOAT_STANDARD_COLOURS[0] }
                : null),
            });
          }}
        />
        {state.extrusionColour === 'Mill' ? (
          <>
            <FieldTile
              id="standalone-infill-powdercoat-colour"
              label="Powdercoat colour"
              type="select"
              value={state.powdercoatStandardColour ?? ''}
              disabled={state.powdercoatIsCustom === true}
              options={POWDERCOAT_STANDARD_COLOURS.map((colour) => ({ label: colour, value: colour }))}
              onChange={(value) => onChange({ powdercoatStandardColour: String(value) })}
            />
            <FieldTile
              id="standalone-infill-custom-powdercoat"
              label="Custom colour"
              type="toggle"
              value={state.powdercoatIsCustom === true}
              onChange={(value) => onChange({ powdercoatIsCustom: value === true })}
            />
            {state.powdercoatIsCustom ? (
              <FieldTile
                id="standalone-infill-custom-powdercoat-name"
                label="Custom colour name"
                type="text"
              value={state.powdercoatCustomColour ?? ''}
              onChange={(value) => onChange({ powdercoatCustomColour: String(value) })}
              error={state.powdercoatCustomColour?.trim() ? undefined : 'Enter the custom powdercoat colour.'}
            />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
