'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { HOUSE_FOOTPRINT_PRESET_OPTIONS } from '@/app/staff/calculator/ModuleViewsCard';
import { normalizeHouseFootprintParams, type CalculatorHouseRoofMaterial } from '@/lib/types/calculator';
import type {
  DeckElevationMode,
  DeckPresetRect,
  DeckShape,
  DeckSurfaceMaterial,
  HouseFirstDeckDraft,
  HouseFirstRoofDraft,
  HouseModel,
  HouseRoofApproximationReason,
  HouseRoofFieldSource,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type { CommitResult } from './houseRailTypes';
import styles from './ConfiguratorRail.module.css';

export type SelectOption = { label: string; value: string };

export const FOOTPRINT_MODE_OPTIONS: SelectOption[] = [
  { label: 'Preset', value: 'preset' },
  { label: 'Draw outline', value: 'custom_polygon' },
];

export const FOOTPRINT_OPTIONS: SelectOption[] = HOUSE_FOOTPRINT_PRESET_OPTIONS.map((option) => ({
  label: option.label,
  value: option.id,
}));

export const ATTACHMENT_SIDE_OPTIONS: SelectOption[] = [
  { label: 'Rear', value: 'rear' },
  { label: 'Front', value: 'front' },
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
];

export const EDITABLE_ROOF_FORM_OPTIONS: SelectOption[] = [
  { label: 'Mono', value: 'mono' },
  { label: 'Gable', value: 'gable' },
];

export const ROOF_MATERIAL_OPTIONS: Array<SelectOption & { value: CalculatorHouseRoofMaterial }> = [
  { label: 'Corrugated iron', value: 'corrugated_iron' },
  { label: 'Trapezoidal 5 rib', value: 'trapezoidal_5_rib' },
  { label: 'Eurotray 300', value: 'eurotray_300' },
  { label: 'Eurotray 500', value: 'eurotray_500' },
  { label: 'Shingles', value: 'shingles' },
];

export const ROOF_FALL_DIRECTION_OPTIONS: Array<SelectOption & { value: HouseRoofPrimaryFallDirection }> = [
  { label: 'Fall +Y', value: 'positive_y' },
  { label: 'Fall -Y', value: 'negative_y' },
  { label: 'Fall +X', value: 'positive_x' },
  { label: 'Fall -X', value: 'negative_x' },
];

export const ROOF_RIDGE_AXIS_OPTIONS: Array<SelectOption & { value: HouseRoofRidgeAxis }> = [
  { label: 'Ridge X', value: 'x' },
  { label: 'Ridge Y', value: 'y' },
];

export const DECK_KIND_OPTIONS: SelectOption[] = [
  { label: 'Deck', value: 'deck' },
  { label: 'Landing', value: 'landing' },
];

export const DECK_SHAPE_OPTIONS: Array<SelectOption & { value: DeckShape }> = [
  { label: 'Rectangular preset', value: 'preset' },
  { label: 'Custom outline', value: 'custom' },
];

export const DECK_ELEVATION_OPTIONS: Array<SelectOption & { value: DeckElevationMode }> = [
  { label: 'Ground', value: 'ground' },
  { label: 'Stepped', value: 'stepped' },
  { label: 'Threshold aligned', value: 'aligned_to_threshold' },
];

export const DECK_SURFACE_OPTIONS: Array<SelectOption & { value: DeckSurfaceMaterial }> = [
  { label: 'Timber decking', value: 'timber_decking' },
  { label: 'Composite', value: 'composite' },
  { label: 'Concrete', value: 'concrete' },
];

export function labelForPreset(value: string | null | undefined): string {
  return FOOTPRINT_OPTIONS.find((option) => option.value === value)?.label ?? 'Straight';
}

export function labelForRoofForm(value: HouseModel['roof']['form'] | null | undefined): string {
  switch (value) {
    case 'flat':
      return 'Flat';
    case 'gable':
      return 'Gable';
    case 'hipped':
      return 'Hipped';
    case 'mono':
    default:
      return 'Mono';
  }
}

export function labelForRoofReviewStatus(
  value: HouseModel['roof']['validation']['status'] | 'none' | null | undefined,
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

export function labelForRoofFieldSource(value: HouseRoofFieldSource | null | undefined): string {
  switch (value) {
    case 'house_first_draft':
      return 'Explicit house draft';
    case 'legacy_shared_value':
      return 'Legacy shared value';
    case 'legacy_pergola_inference':
      return 'Legacy pergola inference';
    case 'default_fallback':
      return 'Default fallback';
    default:
      return 'Unknown';
  }
}

export function labelForRoofApproximationReason(
  value: HouseRoofApproximationReason,
): string {
  switch (value) {
    case 'inferred_form':
      return 'Roof form inferred from legacy pergola data';
    case 'inferred_fall_direction':
      return 'Mono fall direction inferred from legacy pergola data';
    case 'inferred_ridge_axis':
      return 'Ridge axis inferred from legacy pergola data';
    case 'ambiguous_ridge_axis':
      return 'Near-square rectangular footprint keeps a best-guess ridge axis';
    default:
      return value;
  }
}

export function labelForAttachmentSide(value: string | null | undefined): string {
  return ATTACHMENT_SIDE_OPTIONS.find((option) => option.value === value)?.label ?? 'Rear';
}

export function formatRotation(value: number | null | undefined): string {
  return `${((value ?? 0) % 4) * 90} deg`;
}

export function resolveDeckValidationSummary(deck: HouseModel['decks'][number]): string | null {
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

export function resolveDeckWarningSummaries(deck: HouseModel['decks'][number]): string[] {
  const resolved: Array<string | null> = deck.supportContext.warningCodes.map((code) => {
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

  const fallback = deck.supportContext.warningMessages.filter(Boolean);
  return Array.from(new Set([...resolved.filter((value): value is string => value !== null), ...fallback]));
}

export function resolveDeckPresetRectDraft(deck: HouseModel['decks'][number] | HouseFirstDeckDraft): DeckPresetRect {
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

export function buildRoofDraftFromHouse(house: HouseModel | null): HouseFirstRoofDraft {
  return {
    form: house?.roof.form ?? 'mono',
    material: house?.roof.material ?? 'corrugated_iron',
    primaryPitchDeg: house?.roof.primaryPitchDeg ?? house?.roof.pitchDeg ?? '',
    primaryFallDirection: house?.roof.primaryFallDirection ?? 'positive_y',
    ridgeAxis: house?.roof.ridgeAxis ?? 'x',
    openGableEndIds: house?.roof.openGableEndIds ?? [],
    appendage: {
      enabled: house?.roof.appendage.enabled ?? false,
      form: house?.roof.appendage.form ?? 'mono',
      hostEdge: house?.roof.appendage.hostEdge ?? 'rear',
      pitchDeg: house?.roof.appendage.pitchDeg ?? '',
      dropMm: house?.roof.appendage.dropMm ?? '450',
    },
  };
}

export function resolveFootprintParams(house: HouseModel | null) {
  return normalizeHouseFootprintParams(house?.footprint.params);
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
        inputMode="decimal"
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
