'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { HOUSE_ROOF_FORM_ORDER } from '@sp/geometry';
import { normalizeHouseFootprintParams, type CalculatorHouseRoofMaterial } from '@/lib/types/calculator';
import type {
  DeckObjectModel,
  HouseFormModel,
  HouseFormRoofIntentModel,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchDeckInspectorModel } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type { CommitResult } from './objectWorkbenchRailTypes';
import styles from './WorkbenchRail.module.css';

type RoofFieldSourceValue =
  | 'object_first_draft'
  | 'house_first_draft'
  | 'legacy_estimate_snapshot'
  | 'legacy_shared_value'
  | 'legacy_pergola_inference'
  | 'default_fallback'
  | string;

export type SelectOption = { label: string; value: string };

// PR-COMP-PHASE3.3 (2026-06-18): `Draw outline` retired as an
// authoring affordance. Composition-first authoring (PR-COMP-PHASE3.1
// / 3.2) means every new house form is a rectangle the designer
// resizes; freeform polygon authoring is no longer an option.
// Legacy forms persisted with `mode: 'custom_polygon'` continue to
// render their stored polygon (read-only) via the legacy pipeline.
export const FOOTPRINT_MODE_OPTIONS: SelectOption[] = [
  { label: 'Preset', value: 'preset' },
];

export const FOOTPRINT_OPTIONS: SelectOption[] = [
  { label: 'Straight', value: 'straight' },
  { label: 'L left', value: 'l_left' },
  { label: 'L right', value: 'l_right' },
  { label: 'Recess left', value: 'recess_left' },
  { label: 'Recess right', value: 'recess_right' },
  { label: 'U shape', value: 'u_shape' },
  { label: 'Wrap left', value: 'wrap_left' },
  { label: 'Wrap right', value: 'wrap_right' },
];

export const ATTACHMENT_SIDE_OPTIONS: SelectOption[] = [
  { label: 'Rear', value: 'rear' },
  { label: 'Front', value: 'front' },
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
];

export const HOUSE_ROOF_FORM_OPTIONS: Array<SelectOption & { value: HouseFormRoofIntentModel['form'] }> =
  HOUSE_ROOF_FORM_ORDER.map((value) => ({
    label: labelForRoofForm(value),
    value,
  }));

export const ROOF_MATERIAL_OPTIONS: Array<SelectOption & { value: CalculatorHouseRoofMaterial }> = [
  { label: 'Corrugated iron', value: 'corrugated_iron' },
  { label: 'Trapezoidal 5 rib', value: 'trapezoidal_5_rib' },
  { label: 'Eurotray 300', value: 'eurotray_300' },
  { label: 'Eurotray 500', value: 'eurotray_500' },
  { label: 'Shingles', value: 'shingles' },
];

export const ROOF_FALL_DIRECTION_OPTIONS: Array<SelectOption & { value: HouseFormRoofIntentModel['primaryFallDirection'] }> = [
  { label: 'Fall +Y', value: 'positive_y' },
  { label: 'Fall -Y', value: 'negative_y' },
  { label: 'Fall +X', value: 'positive_x' },
  { label: 'Fall -X', value: 'negative_x' },
];

// PR-T9 (2026-05-29): `DECK_KIND_OPTIONS` and `DECK_ELEVATION_OPTIONS`
// removed with the deck inspector cull.

export const DECK_SHAPE_OPTIONS: Array<SelectOption & { value: DeckObjectModel['shape'] }> = [
  { label: 'Rectangular preset', value: 'preset' },
  { label: 'Custom outline', value: 'custom' },
];

export const DECK_SURFACE_OPTIONS: Array<SelectOption & { value: DeckObjectModel['surfaceMaterial'] }> = [
  { label: 'Timber decking', value: 'timber_decking' },
  { label: 'Composite', value: 'composite' },
  { label: 'Concrete', value: 'concrete' },
];

export function labelForPreset(value: string | null | undefined): string {
  return FOOTPRINT_OPTIONS.find((option) => option.value === value)?.label ?? 'Straight';
}

export function labelForRoofForm(value: HouseFormRoofIntentModel['form'] | null | undefined): string {
  switch (value) {
    case 'flat':
      return 'Flat';
    case 'hipped':
      return 'Hipped';
    case 'mono':
    default:
      return 'Mono';
  }
}

export function labelForRoofReviewStatus(
  value: 'valid' | 'approximate' | 'invalid' | 'none' | null | undefined,
): string {
  switch (value) {
    case 'invalid':
      return 'Blocked';
    case 'approximate':
      return 'Approximate';
    case 'valid':
      return 'Ready';
    default:
      return 'None';
  }
}

export function labelForRoofFieldSource(value: RoofFieldSourceValue | null | undefined): string {
  switch (value) {
    case 'object_first_draft':
      return 'Explicit object draft';
    case 'house_first_draft':
      return 'Imported house draft';
    case 'legacy_estimate_snapshot':
      return 'Imported estimate snapshot';
    case 'legacy_shared_value':
      return 'Imported shared value';
    case 'legacy_pergola_inference':
      return 'Imported pergola inference';
    case 'default_fallback':
      return 'Default fallback';
    default:
      return 'Unknown';
  }
}

export function labelForRoofApproximationReason(value: string): string {
  switch (value) {
    case 'inferred_form':
      return 'Roof form inferred from imported pergola data';
    case 'inferred_fall_direction':
      return 'Mono fall direction inferred from imported pergola data';
    case 'inferred_ridge_axis':
      return 'Ridge axis inferred from imported pergola data';
    case 'ambiguous_ridge_axis':
      return 'Near-square rectangular footprint keeps a best-guess ridge axis';
    default:
      return value;
  }
}

export function labelForRoofGeometryKind(value: string | null | undefined): string {
  switch (value) {
    case 'footprint_flat':
      return 'Footprint flat';
    case 'footprint_mono':
      return 'Footprint mono';
    case 'rectangular_gable':
      return 'Rectangular gable';
    case 'bent_spine_joined_gable':
      return 'Bent-spine joined gable';
    case 'rectangular_hipped':
      return 'Rectangular hipped';
    case 'rectilinear_joined_hipped':
      return 'Rectilinear joined hipped';
    default:
      return 'None';
  }
}

export function labelForAttachmentSide(value: string | null | undefined): string {
  return ATTACHMENT_SIDE_OPTIONS.find((option) => option.value === value)?.label ?? 'Rear';
}

export function labelForAttachmentSideList(values: Array<string> | null | undefined): string {
  if (!values?.length) return 'None';
  return values.map((value) => labelForAttachmentSide(value)).join(', ');
}

export function formatRotation(value: number | null | undefined): string {
  return `${((value ?? 0) % 4) * 90} deg`;
}

export function resolveDeckValidationSummary(deck: ObjectWorkbenchDeckInspectorModel): string | null {
  if (deck.validation.status !== 'invalid') return null;
  const codes = new Set(deck.validation.codes);

  if (codes.has('outline_inside_house')) {
    return 'This deck is cutting into the house. Reduce depth, width, or center offset, or switch to a host edge with more clear frontage.';
  }
  if (codes.has('overlapping_decks')) {
    return 'This deck overlaps another deck. Pull the rectangles apart by reducing width/depth or shifting the center offset.';
  }
  if (codes.has('attached_missing_host_edge')) {
    return 'Preset decks snapped to the house need a host edge before the rectangle can rebuild cleanly.';
  }
  if (codes.has('detached_threshold_alignment')) {
    return 'Floating decks cannot stay threshold aligned. Use ground or stepped elevation instead.';
  }
  if (codes.has('self_intersecting_outline')) {
    return 'This custom outline folds back through itself. Redraw the outline or switch back to a rectangular preset.';
  }
  if (codes.has('unsupported_house_intersection')) {
    return 'This deck outline crosses unsupported house geometry zones. Pull it back outside the house footprint or redraw it.';
  }

  return deck.validation.message ?? 'Deck geometry is blocked.';
}

export function resolveDeckWarningSummaries(deck: ObjectWorkbenchDeckInspectorModel): string[] {
  const resolved: Array<string | null> = deck.supportWarnings.codes.map((code) => {
    switch (code) {
      case 'insufficient_host_edge_contact':
        return 'The deck barely contacts the selected host edge. Widen it or reduce the center offset to keep the snapped placement legible.';
      case 'detached_too_close_to_house':
        return 'This floating deck is sitting too close to the house. Increase the reference edge gap or pull it farther out into space.';
      case 'threshold_alignment_offset':
        return 'Threshold-aligned decks should stay close to the house datum. Reduce the level offset if this is meant to read as a snapped landing.';
      case 'unsupported_house_intersection':
        return 'Part of this outline is running through unsupported house geometry zones.';
      default:
        return null;
    }
  });

  const fallback = deck.supportWarnings.messages.filter(Boolean);
  return Array.from(new Set([...resolved.filter((value): value is string => value !== null), ...fallback]));
}

export function resolveDeckPresetRectDraft(deck: ObjectWorkbenchDeckInspectorModel): NonNullable<DeckObjectModel['presetRect']> {
  return {
    widthM: deck.presetRect?.widthM ?? '',
    depthM: deck.presetRect?.depthM ?? '',
    centerOffsetM: deck.presetRect?.centerOffsetM ?? '',
    detachedGapM: deck.presetRect?.detachedGapM ?? null,
  };
}

export function resolveCommitResult(
  action: Promise<CommitResult> | CommitResult | undefined,
): Promise<CommitResult> {
  return Promise.resolve(action ?? { ok: false, error: 'Editing is not available right now.' });
}

export function resolveFootprintParams(houseForm: HouseFormModel | null) {
  return normalizeHouseFootprintParams(houseForm?.footprint.params);
}

export function SummarySection({
  title,
  items,
  hint,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
  hint?: string;
}) {
  return (
    <section className={styles.summary}>
      <p className={styles.eyebrow}>{title}</p>
      <div className={styles.summaryList}>
        {items.map((item) => (
          <div key={`${title}-${item.label}`} className={styles.summaryRow}>
            <span className={styles.summaryLabel}>{item.label}</span>
            <span className={styles.summaryValue}>{item.value}</span>
          </div>
        ))}
      </div>
      {hint ? <p className={styles.summaryHint}>{hint}</p> : null}
    </section>
  );
}

export function SelectField({
  label,
  value,
  options,
  disabled,
  error,
  helperText,
  onCommit,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  error?: string;
  helperText?: string;
  onCommit: (value: string) => Promise<unknown> | void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        className={styles.select}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => void onCommit(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className={styles.fieldError}>{error}</span> : null}
      {!error && helperText ? <span className={styles.fieldHint}>{helperText}</span> : null}
    </label>
  );
}

export function NumberField({
  label,
  value,
  disabled,
  error,
  helperText,
  normalizeOnCommit,
  onCommit,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  normalizeOnCommit?: (value: string) => string;
  onCommit: (value: string) => Promise<unknown> | void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(async (rawValue?: string) => {
    const sourceValue = rawValue ?? draft;
    const nextDraft = normalizeOnCommit ? normalizeOnCommit(sourceValue) : sourceValue;
    if (nextDraft !== sourceValue || nextDraft !== draft) {
      setDraft(nextDraft);
    }
    if (nextDraft === value) return;
    await onCommit(nextDraft);
  }, [draft, normalizeOnCommit, onCommit, value]);

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        aria-label={label}
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => void commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit(event.currentTarget.value);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(value);
          }
        }}
      />
      {error ? <span className={styles.fieldError}>{error}</span> : null}
      {!error && helperText ? <span className={styles.fieldHint}>{helperText}</span> : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  disabled,
  error,
  helperText,
  onCommit,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  onCommit: (value: string) => Promise<unknown> | void;
}) {
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
        className={styles.input}
        aria-label={label}
        value={draft}
        disabled={disabled}
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
      {error ? <span className={styles.fieldError}>{error}</span> : null}
      {!error && helperText ? <span className={styles.fieldHint}>{helperText}</span> : null}
    </label>
  );
}

export function ActionButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.buttonPrimary} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
