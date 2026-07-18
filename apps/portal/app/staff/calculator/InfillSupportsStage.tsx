import type { ReactNode } from 'react';

import type { InfillEdge, InfillEdgeConfirmation, InfillLineItem } from '@/lib/types/calculator';
import FieldTile from './FieldTile';
import styles from './CalculatorGrid.module.css';
import {
  INFILL_EDGES,
  normalizeEdgeConfirmations,
  supportConfirmationSummary,
  updateEdgeConfirmation,
} from './infillSupportPresentation';

const edgeLabels: Record<InfillEdge, string> = {
  top: 'Top edge',
  bottom: 'Bottom edge',
  left: 'Left edge',
  right: 'Right edge',
};

const confirmationOptions: Array<{ value: InfillEdgeConfirmation; label: string }> = [
  { value: 'yes', label: 'Yes, a fixing member exists' },
  { value: 'no', label: 'No, add a support' },
  { value: 'unsure', label: 'Not sure — include a support' },
];

type InfillSupportsStageProps = {
  item: InfillLineItem;
  domIdBase: string;
  canOfferRafterMatching: boolean;
  internalPositionsError?: string;
  additionalSupportSummary: string;
  preview: ReactNode;
  onSupportChange: (support: InfillLineItem['support']) => void;
  onInternalModeChange: (mode: NonNullable<InfillLineItem['support']['internalSupportMode']>) => void;
  onCustomPositionsChange: (positions: string[]) => void;
};

export default function InfillSupportsStage({
  item,
  domIdBase,
  canOfferRafterMatching,
  internalPositionsError,
  additionalSupportSummary,
  preview,
  onSupportChange,
  onInternalModeChange,
  onCustomPositionsChange,
}: InfillSupportsStageProps) {
  const confirmations = normalizeEdgeConfirmations(item.support.edgeConfirmations, item.support);
  const uncertainSummary = supportConfirmationSummary(item.support);
  const internalMode = item.support.internalSupportMode ?? 'none';

  return (
    <div className={styles.infillGuidedStageGrid}>
      <section className={`${styles.infillSection} ${styles.infillSectionSecondary}`} aria-labelledby="infill-supports-heading">
        <div className={styles.infillStageHeading}>
          <h3 id="infill-supports-heading">Confirm existing fixing members</h3>
          <p>Check each labelled edge. If a member is missing or uncertain, the purchase list safely includes a new 50×50 support.</p>
        </div>

        <div className={styles.infillEdgeConfirmationGrid}>
          {INFILL_EDGES.map((edge) => (
            <fieldset key={edge} id={`${domIdBase}-support-${edge}`} className={styles.infillEdgeConfirmationGroup}>
              <legend>{edgeLabels[edge]}</legend>
              {confirmationOptions.map((option) => (
                <label key={option.value} className={styles.infillEdgeConfirmationOption}>
                  <input
                    type="radio"
                    name={`${domIdBase}-support-${edge}-choice`}
                    value={option.value}
                    checked={confirmations[edge] === option.value}
                    onChange={() => onSupportChange(updateEdgeConfirmation(item.support, edge, option.value))}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              {edge === 'bottom' ? <p>Do not count the slab as a fixing member.</p> : null}
            </fieldset>
          ))}
        </div>

        <div className={styles.infillFieldGrid}>
          <FieldTile
            id={`${domIdBase}-support-internal-mode`}
            label="Existing internal supports"
            type="select"
            value={internalMode}
            onChange={(value) => onInternalModeChange(String(value) as NonNullable<InfillLineItem['support']['internalSupportMode']>)}
            options={[
              { label: 'No existing internal supports', value: 'none' },
              ...(canOfferRafterMatching
                ? [{ label: 'Match roof rafters', value: 'match_roof_rafters' }]
                : internalMode === 'match_roof_rafters'
                  ? [{ label: 'Match roof rafters (not valid for this opening)', value: 'match_roof_rafters', disabled: true }]
                  : []),
              { label: 'One at centre', value: 'center' },
              { label: 'Enter positions', value: 'custom' },
            ]}
            helperText={
              internalMode === 'match_roof_rafters' && !canOfferRafterMatching
                ? 'Roof-rafter matching only works on a full front or house edge. Choose explicit positions.'
                : undefined
            }
          />
          {internalMode === 'custom' ? (
            <FieldTile
              id={`${domIdBase}-support-internal-pos`}
              label="Internal support positions (m)"
              type="text"
              value={(item.support.internalSupportPositionsM ?? []).join(', ')}
              onChange={(value) => onCustomPositionsChange(String(value).split(',').map((token) => token.trim()).filter(Boolean))}
              helperText="Measure from the left or bottom edge. Example: 0.8, 1.6"
              error={internalPositionsError}
            />
          ) : null}
        </div>

        {uncertainSummary ? <p className={styles.infillSupportUncertainResult}>{uncertainSummary}</p> : null}
        <p className={styles.infillSupportResult}>{additionalSupportSummary}</p>
      </section>
      <aside className={styles.infillGuidedPreview} aria-label="Support preview">{preview}</aside>
    </div>
  );
}
