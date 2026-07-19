import type { ReactNode } from 'react';

import type { InfillEdge, InfillLineItem, InfillResolvedAcrylicSourceInput } from '@/lib/types/calculator';
import FieldTile from './FieldTile';
import styles from './CalculatorGrid.module.css';
import { getTrianglePointSide } from './infillOpeningTemplates';
import {
  INFILL_EDGES,
  type InfillEdgeAnswer,
  type InfillResolvedPanelOrientation,
  normalizeEdgeConfirmations,
  updateEdgeConfirmation,
} from './infillSupportPresentation';

const edgeLabels: Record<InfillEdge, string> = {
  top: 'Top edge',
  bottom: 'Bottom edge',
  left: 'Left edge',
  right: 'Right edge',
};

const confirmationOptions: Array<{ value: InfillEdgeAnswer; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No — add a support' },
];

type InfillSupportsStageProps = {
  item: InfillLineItem;
  domIdBase: string;
  canOfferRafterMatching: boolean;
  internalPositionsError?: string;
  acrylicSourceError?: string;
  additionalSupportSummary: string;
  acrylicSource: InfillResolvedAcrylicSourceInput;
  panelOrientation: InfillResolvedPanelOrientation;
  preview: ReactNode;
  onAcrylicSourceChange: (source: InfillResolvedAcrylicSourceInput) => void;
  onPanelOrientationChange: (orientation: InfillResolvedPanelOrientation) => void;
  onSupportChange: (support: InfillLineItem['support']) => void;
  onInternalModeChange: (mode: NonNullable<InfillLineItem['support']['internalSupportMode']>) => void;
  onCustomPositionsChange: (positions: string[]) => void;
};

export default function InfillSupportsStage({
  item,
  domIdBase,
  canOfferRafterMatching,
  internalPositionsError,
  acrylicSourceError,
  additionalSupportSummary,
  acrylicSource,
  panelOrientation,
  preview,
  onAcrylicSourceChange,
  onPanelOrientationChange,
  onSupportChange,
  onInternalModeChange,
  onCustomPositionsChange,
}: InfillSupportsStageProps) {
  const confirmations = normalizeEdgeConfirmations(item.support.edgeConfirmations, item.support);
  const trianglePointSide = getTrianglePointSide(item.shape);
  const internalMode = item.support.internalSupportMode ?? 'none';

  return (
    <div className={styles.infillGuidedStageGrid}>
      <section className={`${styles.infillSection} ${styles.infillSectionSecondary}`} aria-labelledby="infill-supports-heading">
        <div className={styles.infillStageHeading}>
          <h3 id="infill-supports-heading">Choose the system and confirm supports</h3>
          <p>Select the panel material and joiner direction, then answer Yes or No for each labelled edge.</p>
        </div>

        <div className={styles.infillSupportSystemGrid}>
          <FieldTile
            id={`${domIdBase}-acrylic`}
            label="Panel material"
            type="select"
            value={acrylicSource}
            onChange={(value) => onAcrylicSourceChange(value as InfillResolvedAcrylicSourceInput)}
            options={[
              { label: 'Sheet panels', value: 'sheet_panels' },
              { label: '620 strips', value: 'strip_620' },
            ]}
            error={acrylicSourceError}
          />
          <FieldTile
            id={`${domIdBase}-joiner-direction`}
            label="Joiner direction"
            type="select"
            value={panelOrientation}
            onChange={(value) => onPanelOrientationChange(value as InfillResolvedPanelOrientation)}
            options={[
              { label: 'Vertical joiners', value: 'vertical' },
              { label: 'Horizontal joiners', value: 'horizontal' },
            ]}
          />
        </div>

        <p className={styles.infillSupportPrompt}>Does an existing fixing member run along each edge?</p>

        <div className={styles.infillEdgeConfirmationGrid}>
          {INFILL_EDGES.map((edge) => edge === trianglePointSide ? (
            <div key={edge} id={`${domIdBase}-support-${edge}`} className={styles.infillTrianglePointNotice} role="note">
              <strong>{edgeLabels[edge]}</strong>
              <span>Triangle point — there is no fixing edge or support required here.</span>
            </div>
          ) : (
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

        <p className={styles.infillSupportResult} aria-live="polite">{additionalSupportSummary}</p>
      </section>
      <aside className={styles.infillGuidedPreview} aria-label="Support preview">{preview}</aside>
    </div>
  );
}
