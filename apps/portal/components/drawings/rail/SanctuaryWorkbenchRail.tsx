'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { HOUSE_FOOTPRINT_PRESET_OPTIONS, type ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import {
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPreset,
} from '@/lib/types/calculator';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { GeometryEditIntent, GeometryEditState, SanctuaryPergolaFamily } from '@/lib/drawings/geometry/geometryEditAdapter';
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

type SanctuaryWorkbenchRailProps = {
  moduleLabel: string;
  geometryState?: GeometryEditState | null;
  view: ModuleViewsTab;
  disabled?: boolean;
  onCommitGeometryEdit?: (intent: GeometryEditIntent) => Promise<CommitResult> | CommitResult;
};

const FAMILY_OPTIONS: SelectOption[] = [
  { label: 'Mono', value: 'mono' },
  { label: 'Gable', value: 'gable' },
  { label: 'Box', value: 'box' },
];
const ROOF_MATERIAL_OPTIONS: SelectOption[] = [
  { label: 'Acrylic', value: 'acrylic' },
  { label: 'Insulated', value: 'insulated' },
  { label: 'Louvre', value: 'louvre' },
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

export default function SanctuaryWorkbenchRail({
  moduleLabel,
  geometryState,
  view,
  disabled = false,
  onCommitGeometryEdit,
}: SanctuaryWorkbenchRailProps) {
  const [pendingFieldId, setPendingFieldId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const family = geometryState?.family ?? null;
  const footprintPreset = geometryState ? normalizeHouseFootprintPreset(geometryState.houseContext.footprintPreset) : 'straight';
  const footprintParams = geometryState ? normalizeHouseFootprintParams(geometryState.houseContext.footprintParams) : normalizeHouseFootprintParams(undefined);
  const drawingRotation = geometryState ? String(normalizeDrawingRotationQuarterTurns(geometryState.houseContext.drawingRotationQuarterTurns)) : '0';
  const boxToggleDisabled = disabled || !geometryState || family === 'gable' || !onCommitGeometryEdit;
  const canEditHouseContext =
    !disabled &&
    Boolean(geometryState) &&
    Boolean(onCommitGeometryEdit) &&
    Boolean(geometryState?.houseContext.canEditFootprint);
  const showGround =
    geometryState?.supports.postConnectionType === 'pile_1m' || geometryState?.supports.postConnectionType === 'pile_1_5m';

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

  const commitGeometryEdit = useCallback(
    async (fieldId: string, intent: GeometryEditIntent) => {
      if (!onCommitGeometryEdit) {
        return { ok: false, error: 'Sanctuary controls are not available right now.' } satisfies CommitResult;
      }
      return await runCommit(fieldId, onCommitGeometryEdit(intent));
    },
    [onCommitGeometryEdit, runCommit],
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
        const result = await commitGeometryEdit('drawing-rotation', { type: 'drawing_rotation', delta });
        if (!result.ok) return result;
        current = (current + delta + 4) % 4;
      }

      return { ok: true } satisfies CommitResult;
    },
    [commitGeometryEdit, drawingRotation],
  );

  const geometryFields = useMemo(() => {
    if (!geometryState || !family) return [];
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
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('pergola-family', {
            type: 'family',
            value: value as SanctuaryPergolaFamily,
          }),
      },
      {
        id: 'box-perimeter-enabled',
        kind: 'toggle',
        label: 'Box perimeter',
        value: geometryState.roof.boxPerimeterEnabled,
        helperText: family === 'gable' ? 'Box perimeter is only available for mono/box layouts.' : 'Keep this on for box-family layouts.',
        pending: pendingFieldId === 'box-perimeter-enabled',
        error: fieldErrors['box-perimeter-enabled'],
        disabled: boxToggleDisabled,
        onCommit: (value: boolean) =>
          commitGeometryEdit('box-perimeter-enabled', {
            type: 'family',
            value: value ? 'box' : 'mono',
          }),
      },
      {
        id: 'lengthM',
        kind: 'number',
        label: 'Roof length (m)',
        value: geometryState.dimensions.lengthM,
        pending: pendingFieldId === 'lengthM',
        error: fieldErrors.lengthM,
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('lengthM', {
            type: 'dimension',
            field: 'lengthM',
            value,
          }),
      },
      {
        id: 'projectionM',
        kind: 'number',
        label: 'Roof span (m)',
        value: geometryState.dimensions.projectionM,
        pending: pendingFieldId === 'projectionM',
        error: fieldErrors.projectionM,
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('projectionM', {
            type: 'dimension',
            field: 'projectionM',
            value,
          }),
      },
    ] satisfies RailFieldDefinition[];
  }, [boxToggleDisabled, commitGeometryEdit, disabled, family, fieldErrors, geometryState, onCommitGeometryEdit, pendingFieldId, view]);

  const roofFields = useMemo(() => {
    if (!geometryState) return [];
    return [
      {
        id: 'roof-material',
        kind: 'select',
        label: 'Roof material',
        value: geometryState.roof.material,
        options: ROOF_MATERIAL_OPTIONS,
        pending: pendingFieldId === 'roof-material',
        error: fieldErrors['roof-material'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('roof-material', {
            type: 'roof_material',
            value: value as CalculatorModuleInputs['roofMaterial'],
          }),
      },
      {
        id: 'roof-pitch',
        kind: 'number',
        label: 'Roof pitch (deg)',
        value: geometryState.roof.pitchDeg,
        helperText: geometryState.roof.boxPerimeterEnabled ? 'Auto-computed for box perimeter.' : 'Blank uses the module default pitch.',
        pending: pendingFieldId === 'roof-pitch',
        error: fieldErrors['roof-pitch'],
        disabled: disabled || !onCommitGeometryEdit || Boolean(geometryState.roof.boxPerimeterEnabled),
        onCommit: (value: string) =>
          commitGeometryEdit('roof-pitch', {
            type: 'roof_pitch',
            value,
          }),
      },
    ] satisfies RailFieldDefinition[];
  }, [commitGeometryEdit, disabled, fieldErrors, geometryState, onCommitGeometryEdit, pendingFieldId]);

  const houseFields = useMemo(() => {
    if (!geometryState) return [];

    const footprintFields: RailFieldDefinition[] = [
      {
        id: 'house-connection',
        kind: 'select',
        label: 'House connection',
        value: geometryState.connection.type,
        options: HOUSE_CONNECTION_OPTIONS,
        pending: pendingFieldId === 'house-connection',
        error: fieldErrors['house-connection'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('house-connection', {
            type: 'house_connection',
            value: value as GeometryEditState['connection']['type'],
          }),
      },
      {
        id: 'attachment-side',
        kind: 'select',
        label: 'Attachment side',
        value: geometryState.connection.attachmentSide ?? 'rear',
        options: ATTACHMENT_SIDE_OPTIONS,
        helperText: canEditHouseContext ? undefined : 'Available when the pergola is attached to the house.',
        pending: pendingFieldId === 'attachment-side',
        error: fieldErrors['attachment-side'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) =>
          commitGeometryEdit('attachment-side', {
            type: 'attachment_side',
            value: value as CalculatorModuleInputs['attachmentSide'],
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
          commitGeometryEdit('house-footprint-preset', {
            type: 'footprint_preset',
            value: value as CalculatorModuleInputs['houseFootprintPreset'],
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
          commitGeometryEdit('house-footprint-band-depth', {
            type: 'footprint_param',
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
          commitGeometryEdit('house-footprint-return-run', {
            type: 'footprint_param',
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
            commitGeometryEdit('house-footprint-recess-width', {
              type: 'footprint_param',
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
            commitGeometryEdit('house-footprint-recess-depth', {
              type: 'footprint_param',
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
            commitGeometryEdit('house-footprint-left-leg', {
              type: 'footprint_param',
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
            commitGeometryEdit('house-footprint-right-leg', {
              type: 'footprint_param',
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
          commitGeometryEdit('house-footprint-side-run', {
            type: 'footprint_param',
            key: 'sideRunM',
            value,
          }),
      });
    }

    return footprintFields;
  }, [canEditHouseContext, commitGeometryEdit, commitRotation, disabled, drawingRotation, fieldErrors, footprintParams, footprintPreset, geometryState, onCommitGeometryEdit, pendingFieldId]);

  const supportFields = useMemo(() => {
    if (!geometryState) return [];
    const fields: RailFieldDefinition[] = [
      {
        id: 'post-connection',
        kind: 'select',
        label: 'Post connection',
        value: geometryState.supports.postConnectionType,
        options: POST_CONNECTION_OPTIONS,
        pending: pendingFieldId === 'post-connection',
        error: fieldErrors['post-connection'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('post-connection', {
            type: 'post_connection',
            value: value as CalculatorModuleInputs['postConnectionType'],
          }),
      },
    ];

    if (showGround) {
      fields.push({
        id: 'ground-condition',
        kind: 'select',
        label: 'Ground',
        value: geometryState.supports.ground,
        options: GROUND_OPTIONS,
        pending: pendingFieldId === 'ground-condition',
        error: fieldErrors['ground-condition'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('ground-condition', {
            type: 'ground',
            value: value as CalculatorModuleInputs['ground'],
          }),
      });
    }

    fields.push(
      {
        id: 'post-count',
        kind: 'number',
        label: 'Post count',
        value: geometryState.supports.postCount,
        pending: pendingFieldId === 'post-count',
        error: fieldErrors['post-count'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('post-count', {
            type: 'post_count',
            value,
          }),
      },
      {
        id: 'post-cut-height',
        kind: 'number',
        label: 'Base height (m)',
        value: geometryState.supports.postCutHeightM,
        helperText: 'Clear height to the underside of the ledger/base line.',
        pending: pendingFieldId === 'post-cut-height',
        error: fieldErrors['post-cut-height'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('post-cut-height', {
            type: 'post_cut_height',
            value,
          }),
      },
    );

    return fields;
  }, [commitGeometryEdit, disabled, fieldErrors, geometryState, onCommitGeometryEdit, pendingFieldId, showGround]);

  if (!geometryState || !family) {
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
