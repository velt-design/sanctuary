'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { HOUSE_FOOTPRINT_PRESET_OPTIONS, type ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPreset,
  supportsHouseFootprints,
} from '@/lib/types/calculator';
import type { EstimateDrawingFootprintEdit, EstimateDrawingModuleFieldEdit } from '@/lib/estimates/drawingEdits';
import styles from './ConfiguratorRail.module.css';

type CommitResult = { ok: boolean; error?: string };

type SelectOption = { label: string; value: string };

type RailFieldDefinition =
  | {
      id: string;
      kind: 'select';
      label: string;
      value: string;
      options: SelectOption[];
      helperText?: string;
      error?: string;
      disabled?: boolean;
      pending?: boolean;
      onCommit: (value: string) => Promise<unknown> | void;
    }
  | {
      id: string;
      kind: 'number';
      label: string;
      value: string;
      helperText?: string;
      error?: string;
      disabled?: boolean;
      pending?: boolean;
      onCommit: (value: string) => Promise<unknown> | void;
    }
  | {
      id: string;
      kind: 'toggle';
      label: string;
      value: boolean;
      helperText?: string;
      error?: string;
      disabled?: boolean;
      pending?: boolean;
      onCommit: (value: boolean) => Promise<unknown> | void;
    };

export type SanctuaryPergolaFamily = 'mono' | 'gable' | 'box';

type SanctuaryWorkbenchRailProps = {
  moduleLabel: string;
  moduleInput?: CalculatorModuleInputs | null;
  view: ModuleViewsTab;
  disabled?: boolean;
  onCommitFamily?: (family: SanctuaryPergolaFamily) => Promise<CommitResult> | CommitResult;
  onCommitFootprintEdit?: (edit: EstimateDrawingFootprintEdit) => Promise<CommitResult> | CommitResult;
  onCommitModuleField?: (edit: EstimateDrawingModuleFieldEdit) => Promise<CommitResult> | CommitResult;
};

const FAMILY_OPTIONS: SelectOption[] = [
  { label: 'Mono', value: 'mono' },
  { label: 'Gable', value: 'gable' },
  { label: 'Box', value: 'box' },
];
const ROOF_MATERIAL_OPTIONS: SelectOption[] = [
  { label: 'Acrylic', value: 'acrylic' },
  { label: 'Timber', value: 'timber' },
  { label: 'Mixed', value: 'mixed' },
];
const HOUSE_CONNECTION_OPTIONS: SelectOption[] = [
  { label: 'Soffit', value: 'soffit' },
  { label: 'Fascia', value: 'fascia' },
  { label: 'Wall', value: 'wall' },
  { label: 'Freestanding', value: 'freestanding' },
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
const DRAWING_ROTATION_OPTIONS: SelectOption[] = [
  { label: '0 deg', value: '0' },
  { label: '90 deg', value: '1' },
  { label: '180 deg', value: '2' },
  { label: '270 deg', value: '3' },
];
const FOOTPRINT_OPTIONS: SelectOption[] = HOUSE_FOOTPRINT_PRESET_OPTIONS.map((option) => ({
  label: option.label,
  value: option.id,
}));

function renderField(field: RailFieldDefinition) {
  if (field.kind === 'toggle') {
    return <ToggleField key={field.id} {...field} />;
  }

  if (field.kind === 'select') {
    return <SelectField key={field.id} {...field} />;
  }

  return <NumberField key={field.id} {...field} />;
}

function SelectField(field: Extract<RailFieldDefinition, { kind: 'select' }>) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{field.label}</span>
      <select
        id={field.id}
        className={styles.select}
        aria-label={field.label}
        value={field.value}
        disabled={field.disabled || field.pending}
        onChange={(event) => void field.onCommit(event.target.value)}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {field.error ? <span className={styles.fieldError}>{field.error}</span> : field.helperText ? <span className={styles.fieldHint}>{field.helperText}</span> : null}
    </label>
  );
}

function NumberField(field: Extract<RailFieldDefinition, { kind: 'number' }>) {
  const [draft, setDraft] = useState(field.value);

  useEffect(() => {
    setDraft(field.value);
  }, [field.value]);

  const commit = useCallback(async () => {
    if (draft === field.value) return;
    await field.onCommit(draft);
  }, [draft, field]);

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{field.label}</span>
      <input
        id={field.id}
        className={styles.input}
        aria-label={field.label}
        inputMode="decimal"
        value={draft}
        disabled={field.disabled || field.pending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(field.value);
          }
        }}
      />
      {field.error ? <span className={styles.fieldError}>{field.error}</span> : field.helperText ? <span className={styles.fieldHint}>{field.helperText}</span> : null}
    </label>
  );
}

function ToggleField(field: Extract<RailFieldDefinition, { kind: 'toggle' }>) {
  return (
    <label className={`${styles.field} ${styles.toggleField}`}>
      <div className={styles.toggleHeader}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <button
          id={field.id}
          type="button"
          aria-label={field.label}
          className={`${styles.toggleButton} ${field.value ? styles.toggleButtonActive : ''}`}
          aria-pressed={field.value}
          disabled={field.disabled || field.pending}
          onClick={() => void field.onCommit(!field.value)}
        >
          {field.value ? 'On' : 'Off'}
        </button>
      </div>
      {field.error ? <span className={styles.fieldError}>{field.error}</span> : field.helperText ? <span className={styles.fieldHint}>{field.helperText}</span> : null}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      <div className={styles.fieldStack}>{children}</div>
    </section>
  );
}

function resolveHouseConnectionValue(moduleInput: CalculatorModuleInputs): string {
  if (moduleInput.houseConnectionType === 'facade') return 'wall';
  if (moduleInput.houseConnectionType === 'none') return 'freestanding';
  return moduleInput.houseConnectionType;
}

function toHouseConnectionType(value: string): CalculatorModuleInputs['houseConnectionType'] {
  if (value === 'wall') return 'facade';
  if (value === 'freestanding') return 'none';
  return value as CalculatorModuleInputs['houseConnectionType'];
}

export function resolveSanctuaryPergolaFamily(moduleInput?: CalculatorModuleInputs | null): SanctuaryPergolaFamily | null {
  if (!moduleInput) return null;
  if (moduleInput.pergolaStyle === 'gable') return 'gable';
  if (moduleInput.pergolaStyle === 'pitched') return moduleInput.boxPerimeterEnabled ? 'box' : 'mono';
  return null;
}

export function isSanctuarySupportedModuleInput(moduleInput?: CalculatorModuleInputs | null): boolean {
  return resolveSanctuaryPergolaFamily(moduleInput) !== null;
}

export default function SanctuaryWorkbenchRail({
  moduleLabel,
  moduleInput,
  view,
  disabled = false,
  onCommitFamily,
  onCommitFootprintEdit,
  onCommitModuleField,
}: SanctuaryWorkbenchRailProps) {
  const [pendingFieldId, setPendingFieldId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const family = resolveSanctuaryPergolaFamily(moduleInput);
  const footprintPreset = moduleInput ? normalizeHouseFootprintPreset(moduleInput.houseFootprintPreset) : 'straight';
  const footprintParams = moduleInput ? normalizeHouseFootprintParams(moduleInput.houseFootprintParams) : normalizeHouseFootprintParams(undefined);
  const drawingRotation = moduleInput ? String(normalizeDrawingRotationQuarterTurns(moduleInput.drawingRotationQuarterTurns)) : '0';
  const boxToggleDisabled = disabled || !moduleInput || family === 'gable' || !onCommitModuleField;
  const canEditHouseContext =
    !disabled &&
    Boolean(moduleInput) &&
    Boolean(onCommitFootprintEdit) &&
    moduleInput.houseConnectionType !== 'none' &&
    supportsHouseFootprints(moduleInput.pergolaStyle);
  const showGround =
    moduleInput?.postConnectionType === 'pile_1m' || moduleInput?.postConnectionType === 'pile_1_5m';

  const runCommit = useCallback(async (fieldId: string, action: Promise<CommitResult> | CommitResult) => {
    setPendingFieldId(fieldId);
    const result = await Promise.resolve(action);
    setPendingFieldId((current) => (current === fieldId ? null : current));
    setFieldErrors((current) => {
      const next = { ...current };
      if (result.ok) delete next[fieldId];
      else next[fieldId] = result.error ?? 'Unable to update the local drawing draft.';
      return next;
    });
    return result;
  }, []);

  const commitFamily = useCallback(
    async (nextFamily: SanctuaryPergolaFamily) => {
      if (!onCommitFamily) {
        return { ok: false, error: 'Pergola family controls are not available right now.' } satisfies CommitResult;
      }
      return await runCommit('pergola-family', onCommitFamily(nextFamily));
    },
    [onCommitFamily, runCommit],
  );

  const commitModuleField = useCallback(
    async (fieldId: string, edit: EstimateDrawingModuleFieldEdit) => {
      if (!onCommitModuleField) {
        return { ok: false, error: 'Sanctuary controls are not available right now.' } satisfies CommitResult;
      }
      return await runCommit(fieldId, onCommitModuleField(edit));
    },
    [onCommitModuleField, runCommit],
  );

  const commitFootprintEdit = useCallback(
    async (fieldId: string, edit: EstimateDrawingFootprintEdit) => {
      if (!onCommitFootprintEdit) {
        return { ok: false, error: 'House/context controls are not available right now.' } satisfies CommitResult;
      }
      return await runCommit(fieldId, onCommitFootprintEdit(edit));
    },
    [onCommitFootprintEdit, runCommit],
  );

  const commitRotation = useCallback(
    async (nextValue: string) => {
      const target = Number.parseInt(nextValue, 10);
      if (!Number.isInteger(target) || target < 0 || target > 3) {
        return { ok: false, error: 'Choose a supported drawing rotation.' } satisfies CommitResult;
      }

      let current = Number.parseInt(drawingRotation, 10);
      while (current !== target) {
        const forward = (target - current + 4) % 4;
        const delta: -1 | 1 = forward <= 2 ? 1 : -1;
        const result = await commitFootprintEdit('drawing-rotation', { type: 'rotate', delta });
        if (!result.ok) return result;
        current = (current + delta + 4) % 4;
      }

      return { ok: true } satisfies CommitResult;
    },
    [commitFootprintEdit, drawingRotation],
  );

  const geometryFields = useMemo(() => {
    if (!moduleInput || !family) return [];
    return [
      {
        id: 'pergola-family',
        kind: 'select',
        label: 'Pergola family',
        value: family,
        options: FAMILY_OPTIONS,
        helperText: view === 'section' ? 'Family changes still update the shared draft from Section review.' : 'Switch between Sanctuary V1 families without leaving the workbench.',
        pending: pendingFieldId === 'pergola-family',
        error: fieldErrors['pergola-family'],
        disabled: disabled || !onCommitFamily,
        onCommit: (value: string) => commitFamily(value as SanctuaryPergolaFamily),
      },
      {
        id: 'box-perimeter-enabled',
        kind: 'toggle',
        label: 'Box perimeter',
        value: Boolean(moduleInput.boxPerimeterEnabled),
        helperText: family === 'gable' ? 'Box perimeter is only available for mono/box layouts.' : 'Keep this on for box-family layouts.',
        pending: pendingFieldId === 'box-perimeter-enabled',
        error: fieldErrors['box-perimeter-enabled'],
        disabled: boxToggleDisabled,
        onCommit: (value: boolean) =>
          commitModuleField('box-perimeter-enabled', {
            field: 'moduleValue',
            key: 'boxPerimeterEnabled',
            value,
          }),
      },
      {
        id: 'lengthM',
        kind: 'number',
        label: 'Roof length (m)',
        value: moduleInput.lengthM,
        pending: pendingFieldId === 'lengthM',
        error: fieldErrors.lengthM,
        disabled: disabled || !onCommitModuleField,
        onCommit: (value: string) =>
          commitModuleField('lengthM', {
            field: 'moduleValue',
            key: 'lengthM',
            value,
          }),
      },
      {
        id: 'projectionM',
        kind: 'number',
        label: 'Roof span (m)',
        value: moduleInput.projectionM,
        pending: pendingFieldId === 'projectionM',
        error: fieldErrors.projectionM,
        disabled: disabled || !onCommitModuleField,
        onCommit: (value: string) =>
          commitModuleField('projectionM', {
            field: 'moduleValue',
            key: 'projectionM',
            value,
          }),
      },
    ] satisfies RailFieldDefinition[];
  }, [boxToggleDisabled, commitFamily, commitModuleField, disabled, family, fieldErrors, moduleInput, onCommitFamily, onCommitModuleField, pendingFieldId, view]);

  const roofFields = useMemo(() => {
    if (!moduleInput) return [];
    return [
      {
        id: 'roof-material',
        kind: 'select',
        label: 'Roof material',
        value: moduleInput.roofMaterial,
        options: ROOF_MATERIAL_OPTIONS,
        pending: pendingFieldId === 'roof-material',
        error: fieldErrors['roof-material'],
        disabled: disabled || !onCommitModuleField,
        onCommit: (value: string) =>
          commitModuleField('roof-material', {
            field: 'roofMaterial',
            value: value as CalculatorModuleInputs['roofMaterial'],
          }),
      },
      {
        id: 'roof-pitch',
        kind: 'number',
        label: 'Roof pitch (deg)',
        value: moduleInput.roofPitchDeg,
        helperText: moduleInput.boxPerimeterEnabled ? 'Auto-computed for box perimeter.' : 'Blank uses the module default pitch.',
        pending: pendingFieldId === 'roof-pitch',
        error: fieldErrors['roof-pitch'],
        disabled: disabled || !onCommitModuleField || Boolean(moduleInput.boxPerimeterEnabled),
        onCommit: (value: string) =>
          commitModuleField('roof-pitch', {
            field: 'moduleValue',
            key: 'roofPitchDeg',
            value,
          }),
      },
    ] satisfies RailFieldDefinition[];
  }, [commitModuleField, disabled, fieldErrors, moduleInput, onCommitModuleField, pendingFieldId]);

  const houseFields = useMemo(() => {
    if (!moduleInput) return [];

    const footprintFields: RailFieldDefinition[] = [
      {
        id: 'house-connection',
        kind: 'select',
        label: 'House connection',
        value: resolveHouseConnectionValue(moduleInput),
        options: HOUSE_CONNECTION_OPTIONS,
        pending: pendingFieldId === 'house-connection',
        error: fieldErrors['house-connection'],
        disabled: disabled || !onCommitModuleField,
        onCommit: (value: string) =>
          commitModuleField('house-connection', {
            field: 'houseConnectionType',
            value: toHouseConnectionType(value),
          }),
      },
      {
        id: 'attachment-side',
        kind: 'select',
        label: 'Attachment side',
        value: moduleInput.attachmentSide ?? 'rear',
        options: ATTACHMENT_SIDE_OPTIONS,
        helperText: canEditHouseContext ? undefined : 'Available when the pergola is attached to the house.',
        pending: pendingFieldId === 'attachment-side',
        error: fieldErrors['attachment-side'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) =>
          commitFootprintEdit('attachment-side', {
            type: 'attachment_side',
            side: value as CalculatorModuleInputs['attachmentSide'],
          }),
      },
      {
        id: 'house-footprint-preset',
        kind: 'select',
        label: 'House footprint',
        value: footprintPreset,
        options: FOOTPRINT_OPTIONS,
        helperText: canEditHouseContext ? undefined : 'Available when the pergola is attached to the house.',
        pending: pendingFieldId === 'house-footprint-preset',
        error: fieldErrors['house-footprint-preset'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) =>
          commitFootprintEdit('house-footprint-preset', {
            type: 'preset',
            preset: value as CalculatorModuleInputs['houseFootprintPreset'],
          }),
      },
      {
        id: 'drawing-rotation',
        kind: 'select',
        label: 'Drawing rotation',
        value: drawingRotation,
        options: DRAWING_ROTATION_OPTIONS,
        helperText: canEditHouseContext ? undefined : 'Available when the pergola is attached to the house.',
        pending: pendingFieldId === 'drawing-rotation',
        error: fieldErrors['drawing-rotation'],
        disabled: !canEditHouseContext,
        onCommit: commitRotation,
      },
      {
        id: 'house-footprint-band-depth',
        kind: 'number',
        label: 'Footprint band depth (m)',
        value: footprintParams.bandDepthM,
        pending: pendingFieldId === 'house-footprint-band-depth',
        error: fieldErrors['house-footprint-band-depth'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) =>
          commitFootprintEdit('house-footprint-band-depth', {
            type: 'param',
            key: 'bandDepthM',
            value,
          }),
      },
    ];

    if (footprintPreset === 'l_left' || footprintPreset === 'l_right') {
      footprintFields.push({
        id: 'house-footprint-return-run',
        kind: 'number',
        label: 'Return run (m)',
        value: footprintParams.returnRunM,
        pending: pendingFieldId === 'house-footprint-return-run',
        error: fieldErrors['house-footprint-return-run'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) =>
          commitFootprintEdit('house-footprint-return-run', {
            type: 'param',
            key: 'returnRunM',
            value,
          }),
      });
    }

    if (footprintPreset === 'recess_left' || footprintPreset === 'recess_right') {
      footprintFields.push(
        {
          id: 'house-footprint-recess-width',
          kind: 'number',
          label: 'Recess width (m)',
          value: footprintParams.recessWidthM,
          pending: pendingFieldId === 'house-footprint-recess-width',
          error: fieldErrors['house-footprint-recess-width'],
          disabled: !canEditHouseContext,
          onCommit: (value: string) =>
            commitFootprintEdit('house-footprint-recess-width', {
              type: 'param',
              key: 'recessWidthM',
              value,
            }),
        },
        {
          id: 'house-footprint-recess-depth',
          kind: 'number',
          label: 'Recess depth (m)',
          value: footprintParams.recessDepthM,
          pending: pendingFieldId === 'house-footprint-recess-depth',
          error: fieldErrors['house-footprint-recess-depth'],
          disabled: !canEditHouseContext,
          onCommit: (value: string) =>
            commitFootprintEdit('house-footprint-recess-depth', {
              type: 'param',
              key: 'recessDepthM',
              value,
            }),
        },
      );
    }

    if (footprintPreset === 'u_shape') {
      footprintFields.push(
        {
          id: 'house-footprint-left-leg',
          kind: 'number',
          label: 'Left leg run (m)',
          value: footprintParams.leftLegRunM,
          pending: pendingFieldId === 'house-footprint-left-leg',
          error: fieldErrors['house-footprint-left-leg'],
          disabled: !canEditHouseContext,
          onCommit: (value: string) =>
            commitFootprintEdit('house-footprint-left-leg', {
              type: 'param',
              key: 'leftLegRunM',
              value,
            }),
        },
        {
          id: 'house-footprint-right-leg',
          kind: 'number',
          label: 'Right leg run (m)',
          value: footprintParams.rightLegRunM,
          pending: pendingFieldId === 'house-footprint-right-leg',
          error: fieldErrors['house-footprint-right-leg'],
          disabled: !canEditHouseContext,
          onCommit: (value: string) =>
            commitFootprintEdit('house-footprint-right-leg', {
              type: 'param',
              key: 'rightLegRunM',
              value,
            }),
        },
      );
    }

    if (footprintPreset === 'wrap_left' || footprintPreset === 'wrap_right') {
      footprintFields.push({
        id: 'house-footprint-side-run',
        kind: 'number',
        label: 'Side run (m)',
        value: footprintParams.sideRunM,
        pending: pendingFieldId === 'house-footprint-side-run',
        error: fieldErrors['house-footprint-side-run'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) =>
          commitFootprintEdit('house-footprint-side-run', {
            type: 'param',
            key: 'sideRunM',
            value,
          }),
      });
    }

    return footprintFields;
  }, [canEditHouseContext, commitFootprintEdit, commitModuleField, commitRotation, disabled, drawingRotation, fieldErrors, footprintParams, footprintPreset, moduleInput, onCommitModuleField, pendingFieldId]);

  const supportFields = useMemo(() => {
    if (!moduleInput) return [];
    const fields: RailFieldDefinition[] = [
      {
        id: 'post-connection',
        kind: 'select',
        label: 'Post connection',
        value: moduleInput.postConnectionType,
        options: POST_CONNECTION_OPTIONS,
        pending: pendingFieldId === 'post-connection',
        error: fieldErrors['post-connection'],
        disabled: disabled || !onCommitModuleField,
        onCommit: (value: string) =>
          commitModuleField('post-connection', {
            field: 'postConnectionType',
            value: value as CalculatorModuleInputs['postConnectionType'],
          }),
      },
    ];

    if (showGround) {
      fields.push({
        id: 'ground-condition',
        kind: 'select',
        label: 'Ground',
        value: moduleInput.ground,
        options: GROUND_OPTIONS,
        pending: pendingFieldId === 'ground-condition',
        error: fieldErrors['ground-condition'],
        disabled: disabled || !onCommitModuleField,
        onCommit: (value: string) =>
          commitModuleField('ground-condition', {
            field: 'ground',
            value: value as CalculatorModuleInputs['ground'],
          }),
      });
    }

    fields.push(
      {
        id: 'post-count',
        kind: 'number',
        label: 'Post count',
        value: moduleInput.postCount,
        pending: pendingFieldId === 'post-count',
        error: fieldErrors['post-count'],
        disabled: disabled || !onCommitModuleField,
        onCommit: (value: string) =>
          commitModuleField('post-count', {
            field: 'moduleValue',
            key: 'postCount',
            value,
          }),
      },
      {
        id: 'post-cut-height',
        kind: 'number',
        label: 'Base height (m)',
        value: moduleInput.postCutHeightM,
        helperText: 'Clear height to the underside of the ledger/base line.',
        pending: pendingFieldId === 'post-cut-height',
        error: fieldErrors['post-cut-height'],
        disabled: disabled || !onCommitModuleField,
        onCommit: (value: string) =>
          commitModuleField('post-cut-height', {
            field: 'moduleValue',
            key: 'postCutHeightM',
            value,
          }),
      },
    );

    return fields;
  }, [commitModuleField, disabled, fieldErrors, moduleInput, onCommitModuleField, pendingFieldId, showGround]);

  if (!moduleInput || !family) {
    return (
      <section className={styles.summary}>
        <p className={styles.eyebrow}>Sanctuary Controls</p>
        <h3 className={styles.title}>{moduleLabel}</h3>
        <p className={styles.empty}>No Sanctuary controls are available for this module.</p>
      </section>
    );
  }

  return (
    <aside className={styles.rail} aria-label="Sanctuary workbench rail">
      <section className={styles.summary}>
        <p className={styles.eyebrow}>Sanctuary Controls</p>
        <h3 className={styles.title}>{moduleLabel}</h3>
        <p className={styles.summaryText}>
          Local draft edits only. {view === 'section' ? 'Section stays review-first while these controls update the shared design.' : 'Model Space remains the primary editing surface.'}
        </p>
        {disabled ? <p className={styles.empty}>Editing is currently disabled for this estimate.</p> : null}
      </section>

      <Section title="Geometry">{geometryFields.map(renderField)}</Section>
      <Section title="Roof">{roofFields.map(renderField)}</Section>
      <Section title="House / Context">{houseFields.map(renderField)}</Section>
      <Section title="Supports">{supportFields.map(renderField)}</Section>
    </aside>
  );
}
