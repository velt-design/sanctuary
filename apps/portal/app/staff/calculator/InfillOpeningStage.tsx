import type { ReactNode } from 'react';

import type {
  InfillLineItem,
  InfillMonoSlopeAnchorInput,
  InfillMonoSlopeModeInput,
  InfillResolvedAcrylicSourceInput,
} from '@/lib/types/calculator';
import FieldTile from './FieldTile';
import InfillShapeTemplatePicker from './InfillShapeTemplatePicker';
import styles from './CalculatorGrid.module.css';
import { resolveMonoSlopeShape, type InfillDraftFieldKey } from './infillCompute';
import {
  getTriangleHighSide,
  inferInfillOpeningTemplate,
  type InfillOpeningTemplate,
  type InfillTriangleHighSide,
} from './infillOpeningTemplates';

type OpeningErrors = Partial<Record<
  'acrylicSource' | 'qty' | 'widthM' | 'heightM' | 'heightLowM' | 'heightHighM' | 'slopeDeg' | 'bottomOffsetM',
  string
>>;

type InfillOpeningStageProps = {
  item: InfillLineItem;
  domIdBase: string;
  errors: OpeningErrors;
  automaticChoicesOpen: boolean;
  automaticSwitchHint?: string | null;
  runConstraintLine?: string;
  acrylicAutoSwitched: boolean;
  resolvedAcrylicSource: InfillResolvedAcrylicSourceInput;
  resolvedAcrylicLabel: string;
  preview: ReactNode;
  getDraftValue: (field: InfillDraftFieldKey) => string;
  onAutomaticChoicesToggle: (open: boolean) => void;
  onItemChange: (patch: Partial<InfillLineItem>) => void;
  onLocationChange: (location: InfillLineItem['location']) => void;
  onAcrylicPreferenceChange: (source: InfillLineItem['acrylicSource']) => void;
  onShapeTemplateChange: (template: InfillOpeningTemplate) => void;
  onTriangleHighSideChange: (side: InfillTriangleHighSide) => void;
  onDraftChange: (field: InfillDraftFieldKey, value: string) => void;
  onDraftCommit: (field: InfillDraftFieldKey, value: string) => void;
  onMonoModeChange: (mode: InfillMonoSlopeModeInput) => void;
  onMonoAnchorChange: (anchor: InfillMonoSlopeAnchorInput) => void;
  onMonoSlopeChange: (value: string) => void;
  onBottomOffsetChange: (value: string) => void;
};

function formatMaybeNumber(value: number | null, digits = 3): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits).replace(/\.?0+$/, '');
}

export default function InfillOpeningStage({
  item,
  domIdBase,
  errors,
  automaticChoicesOpen,
  automaticSwitchHint,
  runConstraintLine,
  acrylicAutoSwitched,
  resolvedAcrylicSource,
  resolvedAcrylicLabel,
  preview,
  getDraftValue,
  onAutomaticChoicesToggle,
  onItemChange,
  onLocationChange,
  onAcrylicPreferenceChange,
  onShapeTemplateChange,
  onTriangleHighSideChange,
  onDraftChange,
  onDraftCommit,
  onMonoModeChange,
  onMonoAnchorChange,
  onMonoSlopeChange,
  onBottomOffsetChange,
}: InfillOpeningStageProps) {
  const monoShape = item.shape.type === 'mono_slope' ? item.shape : null;
  const monoResolved = monoShape ? resolveMonoSlopeShape(monoShape) : null;
  const openingTemplate = inferInfillOpeningTemplate(item.shape);
  const triangleHighSide = getTriangleHighSide(item.shape);
  const trianglePeakField: InfillDraftFieldKey = triangleHighSide === 'left' ? 'heightLowM' : 'heightHighM';
  const pitchMode = monoShape?.slopeMode === 'pitch';
  const anchorField: InfillDraftFieldKey = monoResolved?.slopeAnchor === 'right' ? 'heightHighM' : 'heightLowM';
  const derivedHeight = monoResolved
    ? monoResolved.slopeAnchor === 'right' ? monoResolved.leftHeightM : monoResolved.rightHeightM
    : null;

  const numberField = (field: InfillDraftFieldKey, label: string, error?: string) => (
    <div className={styles.span4}>
      <FieldTile
        id={`${domIdBase}-shape-${field === 'widthM' ? 'width' : field === 'heightM' ? 'height' : field === 'heightLowM' ? 'low' : 'high'}`}
        label={label}
        type="number"
        value={getDraftValue(field)}
        onChange={(value) => onDraftChange(field, String(value))}
        onBlur={(value) => onDraftCommit(field, String(value))}
        onEnter={(value) => onDraftCommit(field, String(value))}
        error={error}
      />
    </div>
  );

  return (
    <div className={styles.infillGuidedStageGrid}>
      <section className={styles.infillSection} aria-labelledby="infill-opening-heading">
        <div className={styles.infillStageHeading}>
          <h3 id="infill-opening-heading">Describe the opening</h3>
          <p>Enter the position, shape and finished opening measurements.</p>
        </div>
        <div className={styles.infillBasicGrid}>
          <div className={styles.span12}>
            <InfillShapeTemplatePicker
              domIdBase={domIdBase}
              value={openingTemplate}
              onChange={onShapeTemplateChange}
            />
          </div>
          <div className={styles.span4}>
            <FieldTile
              id={`${domIdBase}-location`}
              label="Location"
              type="select"
              value={item.location}
              onChange={(value) => onLocationChange(value as InfillLineItem['location'])}
              options={[
                { label: 'Front', value: 'front' },
                { label: 'House', value: 'house' },
                { label: 'Side', value: 'side' },
                { label: 'Gable end', value: 'gable_end' },
                { label: 'Wall', value: 'wall' },
                { label: 'Custom', value: 'custom' },
              ]}
            />
          </div>

          {openingTemplate === 'rectangle' && item.shape.type === 'rect' ? (
            <>
              {numberField('widthM', 'Width (m)', errors.widthM)}
              {numberField('heightM', 'Height (m)', errors.heightM)}
            </>
          ) : openingTemplate === 'triangle' && monoShape ? (
            <>
              {numberField('widthM', 'Width (m)', errors.widthM)}
              {numberField(
                trianglePeakField,
                'Peak height (m)',
                triangleHighSide === 'left' ? errors.heightLowM : errors.heightHighM,
              )}
              <div className={styles.span4}>
                <fieldset className={styles.infillTriangleSideFieldset}>
                  <legend>High side</legend>
                  <div>
                    {(['left', 'right'] as const).map((side) => (
                      <label key={side}>
                        <input
                          type="radio"
                          name={`${domIdBase}-triangle-high-side`}
                          value={side}
                          checked={triangleHighSide === side}
                          onChange={() => onTriangleHighSideChange(side)}
                        />
                        <span>{side === 'left' ? 'Left' : 'Right'}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </>
          ) : monoShape && monoResolved ? (
            <>
              {numberField('widthM', 'Width (m)', errors.widthM)}
              <div className={styles.span4}>
                <FieldTile
                  id={`${domIdBase}-shape-mode`}
                  label="Describe the sloping top"
                  type="select"
                  value={pitchMode ? 'pitch' : 'heights'}
                  onChange={(value) => onMonoModeChange(value as InfillMonoSlopeModeInput)}
                  options={[{ label: 'Heights', value: 'heights' }, { label: 'Slope (deg)', value: 'pitch' }]}
                />
              </div>
              {pitchMode ? (
                <>
                  <div className={styles.span4}>
                    <FieldTile
                      id={`${domIdBase}-shape-anchor`}
                      label="Lower side"
                      type="select"
                      value={monoResolved.slopeAnchor}
                      onChange={(value) => onMonoAnchorChange(value as InfillMonoSlopeAnchorInput)}
                      options={[{ label: 'Left edge', value: 'left' }, { label: 'Right edge', value: 'right' }]}
                    />
                  </div>
                  {numberField(
                    anchorField,
                    monoResolved.slopeAnchor === 'right' ? 'Right height (m)' : 'Left height (m)',
                    monoResolved.slopeAnchor === 'right' ? errors.heightHighM : errors.heightLowM,
                  )}
                  <div className={styles.span4}>
                    <FieldTile
                      id={`${domIdBase}-shape-slope`}
                      label="Slope (deg)"
                      type="number"
                      value={monoShape.slopeDeg ?? ''}
                      onChange={(value) => onMonoSlopeChange(String(value))}
                      error={errors.slopeDeg}
                      helperText="Positive degrees. The opposite edge height is calculated automatically."
                    />
                  </div>
                  <div className={styles.span4}>
                    <FieldTile
                      id={`${domIdBase}-${monoResolved.slopeAnchor === 'right' ? 'shape-low' : 'shape-high'}`}
                      label={monoResolved.slopeAnchor === 'right' ? 'Left height (calculated)' : 'Right height (calculated)'}
                      type="readOnly"
                      value={formatMaybeNumber(derivedHeight)}
                    />
                  </div>
                </>
              ) : (
                <>
                  {numberField('heightLowM', 'Left height (m)', errors.heightLowM)}
                  {numberField('heightHighM', 'Right height (m)', errors.heightHighM)}
                </>
              )}
            </>
          ) : null}

          <div className={styles.span4}>
            <FieldTile
              id={`${domIdBase}-shape-bottom`}
              label="Bottom installation height (m)"
              type="number"
              value={item.shape.bottomOffsetM ?? '0'}
              onChange={(value) => onBottomOffsetChange(String(value))}
              error={errors.bottomOffsetM}
              helperText="This positions the infill and does not change its cut size."
            />
          </div>

          <div className={styles.span6}>
            <FieldTile id={`${domIdBase}-label`} label="Label" type="text" value={item.label ?? ''} onChange={(value) => onItemChange({ label: String(value) })} />
          </div>
          <div className={styles.span2}>
            <FieldTile id={`${domIdBase}-qty`} label="Quantity" type="number" value={item.qty} onChange={(value) => onItemChange({ qty: String(value) })} error={errors.qty} />
          </div>

          <details
            className={`${styles.infillAutomaticChoices} ${styles.span12}`}
            open={automaticChoicesOpen}
            onToggle={(event) => onAutomaticChoicesToggle(event.currentTarget.open)}
          >
            <summary>Change automatic choices</summary>
            <p>The calculator chooses the option needing the fewest extra supports, then the least stock and waste.</p>
            <div className={styles.infillAutomaticChoicesGrid}>
              <div>
                <FieldTile
                  id={`${domIdBase}-acrylic`}
                  label="Panel material"
                  type="select"
                  value={item.acrylicSource}
                  onChange={(value) => onAcrylicPreferenceChange(value as InfillLineItem['acrylicSource'])}
                  options={[
                    { label: 'Automatic (recommended)', value: 'auto' },
                    { label: 'Sheet panels', value: 'sheet_panels' },
                    { label: '620 strips', value: 'strip_620' },
                  ]}
                  helperText={automaticSwitchHint ?? runConstraintLine}
                  error={errors.acrylicSource}
                />
                {acrylicAutoSwitched ? (
                  <button type="button" className={styles.infillInlineAction} onClick={() => onAcrylicPreferenceChange(resolvedAcrylicSource)}>
                    {`Use ${resolvedAcrylicLabel} as the preference`}
                  </button>
                ) : null}
              </div>
              <FieldTile
                id={`${domIdBase}-joiner-direction`}
                label="Joiner direction"
                type="select"
                value={item.panelOrientation}
                onChange={(value) => onItemChange({ panelOrientation: value as InfillLineItem['panelOrientation'] })}
                options={[
                  { label: 'Automatic (recommended)', value: 'auto' },
                  { label: 'Vertical joiners', value: 'vertical' },
                  { label: 'Horizontal joiners', value: 'horizontal' },
                ]}
                helperText="Automatic chooses the direction needing the fewest joiners and new supports."
              />
            </div>
          </details>
        </div>
      </section>
      <aside className={styles.infillGuidedPreview} aria-label="Opening preview">{preview}</aside>
    </div>
  );
}
