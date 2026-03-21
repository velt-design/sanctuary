'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HOUSE_FOOTPRINT_PRESET_OPTIONS } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPreset,
  supportsHouseFootprints,
} from '@/lib/types/calculator';
import type {
  EstimateDrawingField,
  EstimateDrawingFootprintEdit,
  EstimateDrawingModuleFieldEdit,
} from '@/lib/estimates/drawingEdits';
import styles from './ConfiguratorRail.module.css';

type CommitResult = { ok: boolean; error?: string };

export type ConfiguratorRailMode = 'full' | 'compact';

type ConfiguratorRailProps = {
  moduleLabel: string;
  moduleInput?: CalculatorModuleInputs | null;
  view: ModuleViewsTab;
  mode: ConfiguratorRailMode;
  editableFields?: EstimateDrawingField[];
  onCommitField?: (field: EstimateDrawingField, nextValue: string) => Promise<CommitResult> | CommitResult;
  onCommitFootprintEdit?: (edit: EstimateDrawingFootprintEdit) => Promise<CommitResult> | CommitResult;
  onCommitModuleField?: (edit: EstimateDrawingModuleFieldEdit) => Promise<CommitResult> | CommitResult;
  onOpenFullCalculator?: () => void;
  onSwitchToModelSpace?: () => void;
  disabled?: boolean;
};

type SelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type SummaryItem = {
  label: string;
  value: string;
  helperText?: string;
};

type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
  pending?: boolean;
  disabled?: boolean;
  onCommit: (value: string) => Promise<unknown> | void;
};

type NumberFieldProps = {
  id: string;
  label: string;
  value: string;
  helperText?: string;
  error?: string;
  pending?: boolean;
  disabled?: boolean;
  onCommit: (value: string) => Promise<unknown> | void;
};

const PERGOLA_STYLE_OPTIONS: SelectOption[] = [
  { label: 'Pitched', value: 'pitched' },
  { label: 'Gable', value: 'gable' },
  { label: 'Hip', value: 'hip' },
];

const ROOF_MATERIAL_OPTIONS: SelectOption[] = [
  { label: 'Acrylic', value: 'acrylic' },
  { label: 'Timber', value: 'timber' },
];

const HOUSE_CONNECTION_OPTIONS: SelectOption[] = [
  { label: 'Soffit', value: 'soffit' },
  { label: 'Fascia', value: 'fascia' },
  { label: 'Facade', value: 'facade' },
  { label: 'None', value: 'none' },
];

const ATTACHMENT_SIDE_OPTIONS: SelectOption[] = [
  { label: 'Rear', value: 'rear' },
  { label: 'Front', value: 'front' },
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
];

const POST_CONNECTION_OPTIONS: SelectOption[] = [
  { label: 'Pile (1m)', value: 'pile_1m' },
  { label: 'Pile (1.5m)', value: 'pile_1_5m' },
  { label: 'Deck bracket', value: 'deck_bracket' },
  { label: 'Slab anchors', value: 'slab_anchors' },
];

const GROUND_OPTIONS: SelectOption[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Hard', value: 'hard' },
];

function withCurrentOption(options: SelectOption[], current: string | undefined, fallbackLabel: string): SelectOption[] {
  if (!current || options.some((option) => option.value === current)) return options;
  return [{ label: fallbackLabel, value: current, disabled: true }, ...options];
}

function labelForOption(options: SelectOption[], value: string | undefined, fallback = '—'): string {
  if (!value) return fallback;
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function formatSummaryValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

async function resolveCommitResult(action: Promise<CommitResult> | CommitResult): Promise<CommitResult> {
  return await action;
}

function ConfiguratorSelectField({
  id,
  label,
  value,
  options,
  helperText,
  error,
  pending,
  disabled,
  onCommit,
}: SelectFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        id={id}
        className={styles.select}
        aria-label={label}
        value={value}
        disabled={disabled || pending}
        onChange={(event) => void onCommit(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className={styles.fieldError}>{error}</span> : helperText ? <span className={styles.fieldHint}>{helperText}</span> : null}
    </label>
  );
}

function ConfiguratorNumberField({
  id,
  label,
  value,
  helperText,
  error,
  pending,
  disabled,
  onCommit,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(async () => {
    if (draft === value) return;
    await onCommit(draft);
  }, [draft, onCommit, value]);

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        id={id}
        className={styles.input}
        aria-label={label}
        inputMode="decimal"
        value={draft}
        disabled={disabled || pending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(value);
          }
        }}
      />
      {error ? <span className={styles.fieldError}>{error}</span> : helperText ? <span className={styles.fieldHint}>{helperText}</span> : null}
    </label>
  );
}

function SummarySection({ title, items, hint }: { title: string; items: SummaryItem[]; hint?: string }) {
  if (!items.length && !hint) return null;

  return (
    <section className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {items.length ? (
        <div className={styles.summaryList}>
          {items.map((item) => (
            <div key={`${title}-${item.label}`} className={styles.summaryRow}>
              <span className={styles.summaryLabel}>{item.label}</span>
              <span className={styles.summaryValue}>{item.value}</span>
              {item.helperText ? <span className={styles.summaryHint}>{item.helperText}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      {hint ? <p className={styles.empty}>{hint}</p> : null}
    </section>
  );
}

export default function ConfiguratorRail({
  moduleLabel,
  moduleInput,
  view,
  mode,
  editableFields = [],
  onCommitField,
  onCommitFootprintEdit,
  onCommitModuleField,
  onOpenFullCalculator,
  onSwitchToModelSpace,
  disabled = false,
}: ConfiguratorRailProps) {
  const [pendingFieldId, setPendingFieldId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const editableFieldsById = useMemo(() => new Map(editableFields.map((field) => [field.id, field])), [editableFields]);
  const footprintParams = useMemo(
    () => normalizeHouseFootprintParams(moduleInput?.houseFootprintParams),
    [moduleInput?.houseFootprintParams],
  );
  const footprintPreset = normalizeHouseFootprintPreset(moduleInput?.houseFootprintPreset);
  const rotationQuarterTurns = normalizeDrawingRotationQuarterTurns(moduleInput?.drawingRotationQuarterTurns);
  const canEdit = !disabled && Boolean(moduleInput);
  const canEditHouseContext =
    canEdit &&
    Boolean(onCommitFootprintEdit) &&
    moduleInput?.houseConnectionType !== 'none' &&
    supportsHouseFootprints(moduleInput?.pergolaStyle ?? 'pitched');
  const showPlanContextControls = view === 'plan' && canEditHouseContext;

  const runCommit = useCallback(async (fieldId: string, action: Promise<CommitResult> | CommitResult) => {
    setPendingFieldId(fieldId);
    const result = await resolveCommitResult(action);
    setPendingFieldId((current) => (current === fieldId ? null : current));
    setFieldErrors((current) => {
      const next = { ...current };
      if (result.ok) {
        delete next[fieldId];
      } else {
        next[fieldId] = result.error ?? 'Unable to update the drawing draft.';
      }
      return next;
    });
    return result;
  }, []);

  const commitEditableField = useCallback(
    async (fieldId: string, nextValue: string) => {
      const field = editableFieldsById.get(fieldId);
      if (!field || !onCommitField) {
        return { ok: false, error: 'This drawing control is not available for the current view.' } satisfies CommitResult;
      }
      return await runCommit(fieldId, onCommitField(field, nextValue));
    },
    [editableFieldsById, onCommitField, runCommit],
  );

  const commitModuleField = useCallback(
    async (fieldId: string, edit: EstimateDrawingModuleFieldEdit) => {
      if (!onCommitModuleField) {
        return { ok: false, error: 'This configurator control is not available right now.' } satisfies CommitResult;
      }
      return await runCommit(fieldId, onCommitModuleField(edit));
    },
    [onCommitModuleField, runCommit],
  );

  const commitFootprintEdit = useCallback(
    async (fieldId: string, edit: EstimateDrawingFootprintEdit) => {
      if (!onCommitFootprintEdit) {
        return { ok: false, error: 'House context controls are not available right now.' } satisfies CommitResult;
      }
      return await runCommit(fieldId, onCommitFootprintEdit(edit));
    },
    [onCommitFootprintEdit, runCommit],
  );

  const geometryFieldIds =
    view === 'plan'
      ? ['plan:lengthA', 'plan:spanA', 'plan:lengthB', 'plan:spanB']
      : ['section:spanA', 'section:heightLeft', 'section:heightRight'];
  const roofFieldIds = view === 'section' ? ['section:pitch'] : [];
  const geometryFields = geometryFieldIds
    .map((fieldId) => editableFieldsById.get(fieldId))
    .filter((field): field is EstimateDrawingField => Boolean(field));
  const roofEditableFields = roofFieldIds
    .map((fieldId) => editableFieldsById.get(fieldId))
    .filter((field): field is EstimateDrawingField => Boolean(field));

  const styleOptions = useMemo(
    () => withCurrentOption(PERGOLA_STYLE_OPTIONS, moduleInput?.pergolaStyle, 'Hip corner (use full calculator)'),
    [moduleInput?.pergolaStyle],
  );
  const roofMaterialOptions = useMemo(
    () => withCurrentOption(ROOF_MATERIAL_OPTIONS, moduleInput?.roofMaterial, 'Mixed (use full calculator)'),
    [moduleInput?.roofMaterial],
  );

  const geometrySummaryItems = useMemo<SummaryItem[]>(
    () => geometryFields.map((field) => ({ label: field.label, value: field.displayValue })),
    [geometryFields],
  );
  const roofSummaryItems = useMemo<SummaryItem[]>(
    () => [
      { label: 'Pergola style', value: labelForOption(PERGOLA_STYLE_OPTIONS, moduleInput?.pergolaStyle) },
      { label: 'Roof material', value: labelForOption(ROOF_MATERIAL_OPTIONS, moduleInput?.roofMaterial) },
      ...roofEditableFields.map((field) => ({ label: field.label, value: field.displayValue })),
    ],
    [moduleInput?.pergolaStyle, moduleInput?.roofMaterial, roofEditableFields],
  );
  const contextSummaryItems = useMemo<SummaryItem[]>(
    () => {
      const items: SummaryItem[] = [
        {
          label: 'House connection',
          value: labelForOption(HOUSE_CONNECTION_OPTIONS, moduleInput?.houseConnectionType),
        },
      ];

      if (view === 'plan' && moduleInput?.houseConnectionType !== 'none') {
        items.push(
          {
            label: 'Attachment side',
            value: labelForOption(ATTACHMENT_SIDE_OPTIONS, moduleInput?.attachmentSide ?? 'rear'),
          },
          {
            label: 'House footprint',
            value: labelForOption(
              HOUSE_FOOTPRINT_PRESET_OPTIONS.map((option) => ({ label: option.label, value: option.id ?? 'straight' })),
              footprintPreset,
            ),
          },
          {
            label: 'Drawing rotation',
            value: `${rotationQuarterTurns * 90} deg`,
          },
        );
      }

      return items;
    },
    [footprintPreset, moduleInput?.attachmentSide, moduleInput?.houseConnectionType, rotationQuarterTurns, view],
  );
  const supportsSummaryItems = useMemo<SummaryItem[]>(
    () => {
      const items: SummaryItem[] = [
        {
          label: 'Post connection',
          value: labelForOption(POST_CONNECTION_OPTIONS, moduleInput?.postConnectionType),
        },
      ];
      if (moduleInput?.postConnectionType === 'pile_1m' || moduleInput?.postConnectionType === 'pile_1_5m') {
        items.push({
          label: 'Ground',
          value: labelForOption(GROUND_OPTIONS, moduleInput?.ground),
        });
      }
      return items;
    },
    [moduleInput?.ground, moduleInput?.postConnectionType],
  );

  if (mode === 'compact') {
    return (
      <div className={`${styles.rail} ${styles.railCompact}`} aria-label={`Configurator summary for ${moduleLabel}`}>
        <div className={`${styles.summary} ${styles.summaryCompact}`}>
          <p className={styles.eyebrow}>Sheet Preview</p>
          <p className={styles.summaryText}>This rail stays in summary mode while you review the generated sheet.</p>
        </div>

        <SummarySection title="Geometry" items={geometrySummaryItems} />
        <SummarySection title="Roof" items={roofSummaryItems} />
        <SummarySection
          title="House & Context"
          items={contextSummaryItems}
          hint={view === 'section' ? 'Plan-only house footprint controls are available in plan view and model space.' : undefined}
        />
        <SummarySection title="Supports" items={supportsSummaryItems} />

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Actions</h4>
          <div className={styles.actionStack}>
            {onSwitchToModelSpace ? (
              <button type="button" className={styles.buttonPrimary} onClick={onSwitchToModelSpace}>
                Switch to model space
              </button>
            ) : null}
            <button type="button" className={styles.secondaryButton} disabled={!onOpenFullCalculator} onClick={onOpenFullCalculator}>
              Open full calculator
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`${styles.rail} ${styles.railFull}`} aria-label={`Configurator rail for ${moduleLabel}`}>
      <div className={styles.summary}>
        <p className={styles.eyebrow}>Model Configurator</p>
        <p className={styles.summaryText}>This is the edit-first surface. Changes here update the live draft and the sheet preview together.</p>
      </div>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Geometry</h4>
        <div className={styles.fieldStack}>
          {geometryFields.length ? (
            geometryFields.map((field) => (
              <ConfiguratorNumberField
                key={field.id}
                id={field.id}
                label={field.label}
                value={field.rawValue}
                pending={pendingFieldId === field.id}
                error={fieldErrors[field.id]}
                disabled={!canEdit}
                onCommit={(nextValue) => commitEditableField(field.id, nextValue)}
              />
            ))
          ) : (
            <p className={styles.empty}>Geometry controls appear here for the active view.</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Roof</h4>
        <div className={styles.fieldStack}>
          <ConfiguratorSelectField
            id="pergola-style"
            label="Pergola style"
            value={moduleInput?.pergolaStyle ?? 'pitched'}
            options={styleOptions}
            helperText="Portal rail supports the common plan families. Use the full calculator for hip-corner edits."
            pending={pendingFieldId === 'pergola-style'}
            error={fieldErrors['pergola-style']}
            disabled={!canEdit}
            onCommit={(value) => commitModuleField('pergola-style', { field: 'pergolaStyle', value: value as CalculatorModuleInputs['pergolaStyle'] })}
          />

          <ConfiguratorSelectField
            id="roof-material"
            label="Roof material"
            value={moduleInput?.roofMaterial ?? 'acrylic'}
            options={roofMaterialOptions}
            helperText="Mixed roofs stay in the full calculator for now."
            pending={pendingFieldId === 'roof-material'}
            error={fieldErrors['roof-material']}
            disabled={!canEdit}
            onCommit={(value) => commitModuleField('roof-material', { field: 'roofMaterial', value: value as CalculatorModuleInputs['roofMaterial'] })}
          />

          {roofEditableFields.map((field) => (
            <ConfiguratorNumberField
              key={field.id}
              id={field.id}
              label={field.label}
              value={field.rawValue}
              pending={pendingFieldId === field.id}
              error={fieldErrors[field.id]}
              disabled={!canEdit}
              onCommit={(nextValue) => commitEditableField(field.id, nextValue)}
            />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>House &amp; Context</h4>
        <div className={styles.fieldStack}>
          <ConfiguratorSelectField
            id="house-connection"
            label="House connection"
            value={moduleInput?.houseConnectionType ?? 'none'}
            options={HOUSE_CONNECTION_OPTIONS}
            pending={pendingFieldId === 'house-connection'}
            error={fieldErrors['house-connection']}
            disabled={!canEdit}
            onCommit={(value) =>
              commitModuleField('house-connection', {
                field: 'houseConnectionType',
                value: value as CalculatorModuleInputs['houseConnectionType'],
              })
            }
          />

          {showPlanContextControls ? (
            <>
              <ConfiguratorSelectField
                id="attachment-side"
                label="Attachment side"
                value={moduleInput?.attachmentSide ?? 'rear'}
                options={ATTACHMENT_SIDE_OPTIONS}
                pending={pendingFieldId === 'attachment-side'}
                error={fieldErrors['attachment-side']}
                disabled={!showPlanContextControls}
                onCommit={(value) =>
                  commitFootprintEdit('attachment-side', {
                    type: 'attachment_side',
                    side: value as CalculatorModuleInputs['attachmentSide'],
                  })
                }
              />

              <ConfiguratorSelectField
                id="house-footprint"
                label="House footprint"
                value={footprintPreset}
                options={HOUSE_FOOTPRINT_PRESET_OPTIONS.map((option) => ({ label: option.label, value: option.id ?? 'straight' }))}
                pending={pendingFieldId === 'house-footprint'}
                error={fieldErrors['house-footprint']}
                disabled={!showPlanContextControls}
                onCommit={(value) =>
                  commitFootprintEdit('house-footprint', {
                    type: 'preset',
                    preset: value as CalculatorModuleInputs['houseFootprintPreset'],
                  })
                }
              />

              <div className={styles.inlineMeta}>
                <span className={styles.inlineLabel}>Drawing rotation</span>
                <span className={styles.inlineValue}>{rotationQuarterTurns * 90} deg</span>
              </div>
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.button}
                  disabled={!showPlanContextControls || pendingFieldId === 'rotate-minus'}
                  onClick={() => void commitFootprintEdit('rotate-minus', { type: 'rotate', delta: -1 })}
                >
                  Rotate -90
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={!showPlanContextControls || pendingFieldId === 'rotate-plus'}
                  onClick={() => void commitFootprintEdit('rotate-plus', { type: 'rotate', delta: 1 })}
                >
                  Rotate +90
                </button>
              </div>
              {fieldErrors['rotate-minus'] || fieldErrors['rotate-plus'] ? (
                <p className={styles.fieldError}>{fieldErrors['rotate-minus'] ?? fieldErrors['rotate-plus']}</p>
              ) : null}

              <ConfiguratorNumberField
                id="house-band-depth"
                label="Band depth (m)"
                value={footprintParams.bandDepthM}
                pending={pendingFieldId === 'house-band-depth'}
                error={fieldErrors['house-band-depth']}
                disabled={!showPlanContextControls}
                onCommit={(value) =>
                  commitFootprintEdit('house-band-depth', {
                    type: 'param',
                    key: 'bandDepthM',
                    value,
                  })
                }
              />

              {(footprintPreset === 'l_left' || footprintPreset === 'l_right') && (
                <ConfiguratorNumberField
                  id="house-return-run"
                  label="Return run (m)"
                  value={footprintParams.returnRunM}
                  pending={pendingFieldId === 'house-return-run'}
                  error={fieldErrors['house-return-run']}
                  disabled={!showPlanContextControls}
                  onCommit={(value) =>
                    commitFootprintEdit('house-return-run', {
                      type: 'param',
                      key: 'returnRunM',
                      value,
                    })
                  }
                />
              )}

              {(footprintPreset === 'recess_left' || footprintPreset === 'recess_right') && (
                <>
                  <ConfiguratorNumberField
                    id="house-recess-width"
                    label="Recess width (m)"
                    value={footprintParams.recessWidthM}
                    pending={pendingFieldId === 'house-recess-width'}
                    error={fieldErrors['house-recess-width']}
                    disabled={!showPlanContextControls}
                    onCommit={(value) =>
                      commitFootprintEdit('house-recess-width', {
                        type: 'param',
                        key: 'recessWidthM',
                        value,
                      })
                    }
                  />
                  <ConfiguratorNumberField
                    id="house-recess-depth"
                    label="Recess depth (m)"
                    value={footprintParams.recessDepthM}
                    pending={pendingFieldId === 'house-recess-depth'}
                    error={fieldErrors['house-recess-depth']}
                    disabled={!showPlanContextControls}
                    onCommit={(value) =>
                      commitFootprintEdit('house-recess-depth', {
                        type: 'param',
                        key: 'recessDepthM',
                        value,
                      })
                    }
                  />
                </>
              )}

              {footprintPreset === 'u_shape' && (
                <>
                  <ConfiguratorNumberField
                    id="house-left-leg"
                    label="Left leg run (m)"
                    value={footprintParams.leftLegRunM}
                    pending={pendingFieldId === 'house-left-leg'}
                    error={fieldErrors['house-left-leg']}
                    disabled={!showPlanContextControls}
                    onCommit={(value) =>
                      commitFootprintEdit('house-left-leg', {
                        type: 'param',
                        key: 'leftLegRunM',
                        value,
                      })
                    }
                  />
                  <ConfiguratorNumberField
                    id="house-right-leg"
                    label="Right leg run (m)"
                    value={footprintParams.rightLegRunM}
                    pending={pendingFieldId === 'house-right-leg'}
                    error={fieldErrors['house-right-leg']}
                    disabled={!showPlanContextControls}
                    onCommit={(value) =>
                      commitFootprintEdit('house-right-leg', {
                        type: 'param',
                        key: 'rightLegRunM',
                        value,
                      })
                    }
                  />
                </>
              )}

              {(footprintPreset === 'wrap_left' || footprintPreset === 'wrap_right') && (
                <ConfiguratorNumberField
                  id="house-side-run"
                  label="Side run (m)"
                  value={footprintParams.sideRunM}
                  pending={pendingFieldId === 'house-side-run'}
                  error={fieldErrors['house-side-run']}
                  disabled={!showPlanContextControls}
                  onCommit={(value) =>
                    commitFootprintEdit('house-side-run', {
                      type: 'param',
                      key: 'sideRunM',
                      value,
                    })
                  }
                />
              )}
            </>
          ) : (
            <p className={styles.empty}>
              {view === 'section'
                ? 'Plan-only house footprint controls live in plan view. The connection type still flows through to section and sheet output.'
                : 'House context controls appear when the module is attached to the house and the style supports footprints.'}
            </p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Supports</h4>
        <div className={styles.fieldStack}>
          <ConfiguratorSelectField
            id="post-connection"
            label="Post connection"
            value={moduleInput?.postConnectionType ?? 'deck_bracket'}
            options={POST_CONNECTION_OPTIONS}
            pending={pendingFieldId === 'post-connection'}
            error={fieldErrors['post-connection']}
            disabled={!canEdit}
            onCommit={(value) =>
              commitModuleField('post-connection', {
                field: 'postConnectionType',
                value: value as CalculatorModuleInputs['postConnectionType'],
              })
            }
          />

          {(moduleInput?.postConnectionType === 'pile_1m' || moduleInput?.postConnectionType === 'pile_1_5m') && (
            <ConfiguratorSelectField
              id="ground-condition"
              label="Ground"
              value={moduleInput?.ground ?? 'easy'}
              options={GROUND_OPTIONS}
              helperText="Used for pile-based post connections."
              pending={pendingFieldId === 'ground-condition'}
              error={fieldErrors['ground-condition']}
              disabled={!canEdit}
              onCommit={(value) => commitModuleField('ground-condition', { field: 'ground', value: value as CalculatorModuleInputs['ground'] })}
            />
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Actions</h4>
        <div className={styles.actionStack}>
          <button type="button" className={styles.secondaryButton} disabled={!onOpenFullCalculator} onClick={onOpenFullCalculator}>
            Open full calculator
          </button>
        </div>
      </section>
    </div>
  );
}
