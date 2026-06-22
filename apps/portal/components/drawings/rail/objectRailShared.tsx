'use client';

import { useCallback, useEffect, useState } from 'react';
import { HOUSE_ROOF_FORM_ORDER } from '@sp/geometry';
import type {
  DeckObjectModel,
  HouseFormRoofIntentModel,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchDeckInspectorModel } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type { CommitResult } from './objectWorkbenchRailTypes';
import styles from './WorkbenchRail.module.css';

type SelectOption = { label: string; value: string };

// Composition-authored house forms have no preset/mode picker. They start as
// a single rectangle and are edited in Plan through drag, Join, and Detach.

const ATTACHMENT_SIDE_OPTIONS: SelectOption[] = [
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

export const ROOF_FALL_DIRECTION_OPTIONS: Array<SelectOption & { value: HouseFormRoofIntentModel['primaryFallDirection'] }> = [
  { label: 'Fall +Y', value: 'positive_y' },
  { label: 'Fall -Y', value: 'negative_y' },
  { label: 'Fall +X', value: 'positive_x' },
  { label: 'Fall -X', value: 'negative_x' },
];

export const DECK_SHAPE_OPTIONS: Array<SelectOption & { value: DeckObjectModel['shape'] }> = [
  { label: 'Rectangular preset', value: 'preset' },
  { label: 'Custom outline', value: 'custom' },
];

export const DECK_SURFACE_OPTIONS: Array<SelectOption & { value: DeckObjectModel['surfaceMaterial'] }> = [
  { label: 'Timber decking', value: 'timber_decking' },
  { label: 'Composite', value: 'composite' },
  { label: 'Concrete', value: 'concrete' },
];

function labelForRoofForm(value: HouseFormRoofIntentModel['form'] | null | undefined): string {
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

function labelForAttachmentSide(value: string | null | undefined): string {
  return ATTACHMENT_SIDE_OPTIONS.find((option) => option.value === value)?.label ?? 'Rear';
}

export function labelForAttachmentSideList(values: Array<string> | null | undefined): string {
  if (!values?.length) return 'None';
  return values.map((value) => labelForAttachmentSide(value)).join(', ');
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
    return 'This custom outline folds back through itself. Switch back to a rectangular preset to keep editing.';
  }
  if (codes.has('unsupported_house_intersection')) {
    return 'This deck outline crosses unsupported house geometry zones. Pull it back outside the house footprint or switch to a rectangular preset.';
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
