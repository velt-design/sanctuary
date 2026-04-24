'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { HOUSE_FOOTPRINT_PRESET_OPTIONS } from '@/app/(portal)/staff/calculator/ModuleViewsCard';
import type { EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import {
  normalizeHouseFootprintParams,
  type CalculatorHouseRoofMaterial,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type {
  DeckElevationMode,
  DeckPresetRect,
  DeckShape,
  DeckSurfaceMaterial,
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  HouseFirstRoofDraft,
  HouseFirstMigrationWarning,
  HouseModel,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  PergolaModel,
  WallOpeningHostSide,
  WorkbenchMode,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import styles from './ConfiguratorRail.module.css';

type CommitResult = { ok: boolean; error?: string };
type SelectOption = { label: string; value: string };

type HouseFirstWorkbenchRailProps = {
  workbenchMode: WorkbenchMode;
  house: HouseModel | null;
  pergolas: PergolaModel[];
  warnings: HouseFirstMigrationWarning[];
  disabled?: boolean;
  activeDeckId?: string | null;
  activeOpeningId?: string | null;
  canEditFootprint?: boolean;
  canStartDrawOutline?: boolean;
  onStartDrawOutline?: () => Promise<CommitResult> | CommitResult;
  onCommitFootprintEdit?: (edit: EstimateDrawingFootprintEdit) => Promise<CommitResult> | CommitResult;
  onCommitRoofDraft?: (roof: HouseFirstRoofDraft) => Promise<CommitResult> | CommitResult;
  onSelectDeck?: (deckId: string | null) => void;
  onSelectOpening?: (openingId: string | null) => void;
  onAddDeck?: (
    mode: 'attached_preset' | 'detached_preset' | 'custom_outline',
  ) => Promise<CommitResult> | CommitResult;
  onAddOpening?: () => Promise<CommitResult> | CommitResult;
  onRemoveDeck?: (deckId: string) => Promise<CommitResult> | CommitResult;
  onRemoveOpening?: (openingId: string) => Promise<CommitResult> | CommitResult;
  onCommitDeckPatch?: (
    deckId: string,
    patch: Partial<HouseFirstDeckDraft>,
  ) => Promise<CommitResult> | CommitResult;
  onCommitOpeningPatch?: (
    openingId: string,
    patch: Partial<HouseFirstOpeningDraft>,
  ) => Promise<CommitResult> | CommitResult;
  onStartDeckOutline?: (deckId: string) => Promise<CommitResult> | CommitResult;
  pendingDeckCreationKind?: 'attached_preset' | null;
  onCancelPendingDeckCreation?: () => void;
  pergolaFallback: ReactNode;
};

const FOOTPRINT_MODE_OPTIONS: SelectOption[] = [
  { label: 'Preset', value: 'preset' },
  { label: 'Draw outline', value: 'custom_polygon' },
];
const FOOTPRINT_OPTIONS: SelectOption[] = HOUSE_FOOTPRINT_PRESET_OPTIONS.map((option) => ({
  label: option.label,
  value: option.id,
}));
const ATTACHMENT_SIDE_OPTIONS: SelectOption[] = [
  { label: 'Rear', value: 'rear' },
  { label: 'Front', value: 'front' },
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
];
const ROOF_FORM_OPTIONS: SelectOption[] = [
  { label: 'Flat', value: 'flat' },
  { label: 'Mono', value: 'mono' },
  { label: 'Gable', value: 'gable' },
  { label: 'Hipped', value: 'hipped' },
];
const ROOF_MATERIAL_OPTIONS: Array<SelectOption & { value: CalculatorHouseRoofMaterial }> = [
  { label: 'Corrugated iron', value: 'corrugated_iron' },
  { label: 'Trapezoidal 5 rib', value: 'trapezoidal_5_rib' },
  { label: 'Eurotray 300', value: 'eurotray_300' },
  { label: 'Eurotray 500', value: 'eurotray_500' },
  { label: 'Shingles', value: 'shingles' },
];
const ROOF_FALL_DIRECTION_OPTIONS: Array<SelectOption & { value: HouseRoofPrimaryFallDirection }> = [
  { label: 'Fall +Y', value: 'positive_y' },
  { label: 'Fall -Y', value: 'negative_y' },
  { label: 'Fall +X', value: 'positive_x' },
  { label: 'Fall -X', value: 'negative_x' },
];
const ROOF_RIDGE_AXIS_OPTIONS: Array<SelectOption & { value: HouseRoofRidgeAxis }> = [
  { label: 'Ridge X', value: 'x' },
  { label: 'Ridge Y', value: 'y' },
];
const DECK_KIND_OPTIONS: SelectOption[] = [
  { label: 'Deck', value: 'deck' },
  { label: 'Landing', value: 'landing' },
];
const DECK_SHAPE_OPTIONS: Array<SelectOption & { value: DeckShape }> = [
  { label: 'Rectangular preset', value: 'preset' },
  { label: 'Custom outline', value: 'custom' },
];
const DECK_ATTACHMENT_OPTIONS: SelectOption[] = [
  { label: 'Attached', value: 'attached' },
  { label: 'Detached', value: 'detached' },
];
const DECK_ELEVATION_OPTIONS: Array<SelectOption & { value: DeckElevationMode }> = [
  { label: 'Ground', value: 'ground' },
  { label: 'Stepped', value: 'stepped' },
  { label: 'Threshold aligned', value: 'aligned_to_threshold' },
];
const DECK_SURFACE_OPTIONS: Array<SelectOption & { value: DeckSurfaceMaterial }> = [
  { label: 'Timber decking', value: 'timber_decking' },
  { label: 'Composite', value: 'composite' },
  { label: 'Concrete', value: 'concrete' },
];

function labelForPreset(value: string | null | undefined): string {
  return FOOTPRINT_OPTIONS.find((option) => option.value === value)?.label ?? 'Straight';
}

function labelForRoofForm(value: HouseModel['roof']['form'] | null | undefined): string {
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

function labelForAttachmentSide(value: string | null | undefined): string {
  return ATTACHMENT_SIDE_OPTIONS.find((option) => option.value === value)?.label ?? 'Rear';
}

function formatRotation(value: number | null | undefined): string {
  return `${((value ?? 0) % 4) * 90} deg`;
}

function resolveDeckValidationSummary(deck: HouseModel['decks'][number]): string | null {
  if (deck.validation.status !== 'invalid') return null;
  const codes = new Set(deck.validation.codes);

  if (codes.has('outline_inside_house')) {
    return 'This deck is cutting into the house. Reduce depth, width, or center offset, or switch to a host edge with more clear frontage.';
  }
  if (codes.has('overlapping_decks')) {
    return 'This deck overlaps another deck. Pull the rectangles apart by reducing width/depth or shifting the center offset.';
  }
  if (codes.has('attached_missing_host_edge')) {
    return 'Attached decks need a host edge before the rectangle can rebuild cleanly.';
  }
  if (codes.has('detached_threshold_alignment')) {
    return 'Detached decks cannot stay threshold aligned. Use ground or stepped elevation instead.';
  }
  if (codes.has('self_intersecting_outline')) {
    return 'This custom outline folds back through itself. Redraw the outline or switch back to a rectangular preset.';
  }
  if (codes.has('unsupported_house_intersection')) {
    return 'This deck outline crosses unsupported house geometry zones. Pull it back outside the house footprint or redraw it.';
  }

  return deck.validation.message ?? 'Deck geometry is blocked.';
}

function resolveDeckWarningSummaries(deck: HouseModel['decks'][number]): string[] {
  const resolved: Array<string | null> = deck.supportContext.warningCodes.map((code) => {
    switch (code) {
      case 'insufficient_host_edge_contact':
        return 'The deck barely contacts the selected host edge. Widen it or reduce the center offset to keep the attachment legible.';
      case 'detached_too_close_to_house':
        return 'This detached deck is sitting too close to the house. Increase the detached gap or switch the placement back to attached.';
      case 'threshold_alignment_offset':
        return 'Threshold-aligned decks should stay close to the house datum. Reduce the level offset if this is meant to read as an attached landing.';
      case 'unsupported_house_intersection':
        return 'Part of this outline is running through unsupported house geometry zones.';
      default:
        return null;
    }
  });

  const fallback = deck.supportContext.warningMessages.filter(Boolean);
  return Array.from(new Set([...resolved.filter((value): value is string => value !== null), ...fallback]));
}

function resolveDeckPresetRectDraft(deck: HouseModel['decks'][number] | HouseFirstDeckDraft): DeckPresetRect {
  return {
    widthM: deck.presetRect?.widthM ?? '',
    depthM: deck.presetRect?.depthM ?? '',
    centerOffsetM: deck.presetRect?.centerOffsetM ?? '',
    detachedGapM: deck.presetRect?.detachedGapM ?? null,
  };
}

function resolveCommitResult(
  action: Promise<CommitResult> | CommitResult | undefined,
): Promise<CommitResult> {
  return Promise.resolve(action ?? { ok: false, error: 'Editing is not available right now.' });
}

function buildRoofDraftFromHouse(house: HouseModel | null): HouseFirstRoofDraft {
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

function SummarySection({
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

function SelectField({
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

function NumberField({
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

function TextField({
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

function ActionButton({
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

function placeholderSection(title: string, text: string) {
  return (
    <section key={title} className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      <p className={styles.empty}>{text}</p>
    </section>
  );
}

function HouseModeRail({
  house,
  activeDeckId,
  activeOpeningId,
  pergolas,
  warnings,
  disabled,
  canEditFootprint,
  canStartDrawOutline,
  onStartDrawOutline,
  onCommitFootprintEdit,
  onCommitRoofDraft,
  onSelectDeck,
  onSelectOpening,
  onAddDeck,
  onAddOpening,
  onRemoveDeck,
  onRemoveOpening,
  onCommitDeckPatch,
  onCommitOpeningPatch,
  onStartDeckOutline,
  pendingDeckCreationKind,
  onCancelPendingDeckCreation,
}: Omit<
  HouseFirstWorkbenchRailProps,
  'workbenchMode' | 'pergolaFallback'
>) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const runFootprintCommit = useCallback(
    async (fieldId: string, edit: EstimateDrawingFootprintEdit) => {
      const result = await resolveCommitResult(onCommitFootprintEdit?.(edit));
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? 'Unable to update the shared house footprint.',
      }));
    },
    [onCommitFootprintEdit],
  );

  const runStartOutline = useCallback(async () => {
    const result = await resolveCommitResult(onStartDrawOutline?.());
    setFieldErrors((current) => ({
      ...current,
      outline: result.ok ? '' : result.error ?? 'Unable to start outline drawing.',
    }));
  }, [onStartDrawOutline]);

  const runRoofCommit = useCallback(
    async (fieldId: string, nextRoof: HouseFirstRoofDraft) => {
      const result = await resolveCommitResult(onCommitRoofDraft?.(nextRoof));
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? 'Unable to update the shared house roof.',
      }));
    },
    [onCommitRoofDraft],
  );
  const runDeckAction = useCallback(
    async (
      fieldId: string,
      action: Promise<CommitResult> | CommitResult | undefined,
      fallbackMessage: string,
    ) => {
      const result = await resolveCommitResult(action);
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? fallbackMessage,
      }));
    },
    [],
  );

  const footprintParams = normalizeHouseFootprintParams(house?.footprint.params);
  const footprintMode = house?.footprint.mode ?? 'preset';
  const footprintPreset = house?.footprint.preset ?? 'straight';
  const roofDraft = buildRoofDraftFromHouse(house);
  const activeDeck = house?.decks.find((deck) => deck.id === activeDeckId) ?? house?.decks[0] ?? null;
  const activeOpening =
    house?.openings.find((opening) => opening.id === activeOpeningId) ?? house?.openings[0] ?? null;
  const sections = useMemo(() => {
    const fields: ReactNode[] = [
      <SelectField
        key="footprint-mode"
        label="House footprint mode"
        value={footprintMode}
        options={FOOTPRINT_MODE_OPTIONS}
        disabled={disabled || !canEditFootprint}
        error={fieldErrors['footprint-mode']}
        helperText={footprintMode === 'custom_polygon' ? 'Use the model-space outline tool to edit the shared house.' : undefined}
        onCommit={(value) => {
          if (value === 'custom_polygon') {
            return runStartOutline();
          }
          return runFootprintCommit('footprint-mode', {
            type: 'mode',
            mode: 'preset',
          });
        }}
      />,
      <SelectField
        key="footprint-preset"
        label="House footprint"
        value={footprintPreset}
        options={FOOTPRINT_OPTIONS}
        disabled={disabled || !canEditFootprint || footprintMode === 'custom_polygon'}
        error={fieldErrors['footprint-preset']}
        onCommit={(value) =>
          runFootprintCommit('footprint-preset', {
            type: 'preset',
            preset: value as CalculatorModuleInputs['houseFootprintPreset'],
          })
        }
      />,
      <SelectField
        key="attachment-side"
        label="Attachment side"
        value={house?.footprint.attachmentSide ?? 'rear'}
        options={ATTACHMENT_SIDE_OPTIONS}
        disabled={disabled || !canEditFootprint}
        error={fieldErrors['attachment-side']}
        onCommit={(value) =>
          runFootprintCommit('attachment-side', {
            type: 'attachment_side',
            side: value as CalculatorModuleInputs['attachmentSide'],
          })
        }
      />,
      <div key="footprint-actions" className={styles.buttonRow}>
        <ActionButton
          label="Rotate -90"
          disabled={disabled || !canEditFootprint}
          onClick={() => void runFootprintCommit('rotate-left', { type: 'rotate', delta: -1 })}
        />
        <ActionButton
          label="Rotate +90"
          disabled={disabled || !canEditFootprint}
          onClick={() => void runFootprintCommit('rotate-right', { type: 'rotate', delta: 1 })}
        />
      </div>,
      <ActionButton
        key="draw-outline"
        label={footprintMode === 'custom_polygon' ? 'Continue outline' : 'Draw outline'}
        disabled={disabled || !canEditFootprint || !canStartDrawOutline}
        onClick={() => void runStartOutline()}
      />,
      fieldErrors.outline ? <p key="outline-error" className={styles.fieldError}>{fieldErrors.outline}</p> : null,
      <NumberField
        key="width"
        label="House width (m)"
        value={footprintParams.widthM}
        disabled={disabled || !canEditFootprint || footprintMode === 'custom_polygon'}
        error={fieldErrors.widthM}
        helperText="Blank matches the active legacy module length."
        onCommit={(value) => runFootprintCommit('widthM', { type: 'param', key: 'widthM', value })}
      />,
      <NumberField
        key="offset"
        label="House offset X (m)"
        value={footprintParams.offsetXM}
        disabled={disabled || !canEditFootprint}
        error={fieldErrors.offsetXM}
        helperText="Negative values extend left of the pergola datum."
        onCommit={(value) => runFootprintCommit('offsetXM', { type: 'param', key: 'offsetXM', value })}
      />,
      <NumberField
        key="setback"
        label="Facade setback (m)"
        value={footprintParams.setbackM}
        disabled={disabled || !canEditFootprint}
        error={fieldErrors.setbackM}
        helperText="Shared facade offset for the house footprint context."
        onCommit={(value) => runFootprintCommit('setbackM', { type: 'param', key: 'setbackM', value })}
      />,
      <NumberField
        key="band-depth"
        label="Footprint band depth (m)"
        value={footprintParams.bandDepthM}
        disabled={disabled || !canEditFootprint || footprintMode === 'custom_polygon'}
        error={fieldErrors.bandDepthM}
        onCommit={(value) => runFootprintCommit('bandDepthM', { type: 'param', key: 'bandDepthM', value })}
      />,
    ];

    if (footprintMode === 'preset' && (footprintPreset === 'l_left' || footprintPreset === 'l_right')) {
      fields.push(
        <NumberField
          key="return-run"
          label="Return run (m)"
          value={footprintParams.returnRunM}
          disabled={disabled || !canEditFootprint}
          error={fieldErrors.returnRunM}
          onCommit={(value) => runFootprintCommit('returnRunM', { type: 'param', key: 'returnRunM', value })}
        />,
      );
    }

    if (footprintMode === 'preset' && (footprintPreset === 'recess_left' || footprintPreset === 'recess_right')) {
      fields.push(
        <NumberField
          key="recess-width"
          label="Recess width (m)"
          value={footprintParams.recessWidthM}
          disabled={disabled || !canEditFootprint}
          error={fieldErrors.recessWidthM}
          onCommit={(value) => runFootprintCommit('recessWidthM', { type: 'param', key: 'recessWidthM', value })}
        />,
        <NumberField
          key="recess-depth"
          label="Recess depth (m)"
          value={footprintParams.recessDepthM}
          disabled={disabled || !canEditFootprint}
          error={fieldErrors.recessDepthM}
          onCommit={(value) => runFootprintCommit('recessDepthM', { type: 'param', key: 'recessDepthM', value })}
        />,
      );
    }

    if (footprintMode === 'preset' && footprintPreset === 'u_shape') {
      fields.push(
        <NumberField
          key="left-leg"
          label="Left leg run (m)"
          value={footprintParams.leftLegRunM}
          disabled={disabled || !canEditFootprint}
          error={fieldErrors.leftLegRunM}
          onCommit={(value) => runFootprintCommit('leftLegRunM', { type: 'param', key: 'leftLegRunM', value })}
        />,
        <NumberField
          key="right-leg"
          label="Right leg run (m)"
          value={footprintParams.rightLegRunM}
          disabled={disabled || !canEditFootprint}
          error={fieldErrors.rightLegRunM}
          onCommit={(value) => runFootprintCommit('rightLegRunM', { type: 'param', key: 'rightLegRunM', value })}
        />,
      );
    }

    if (footprintMode === 'preset' && (footprintPreset === 'wrap_left' || footprintPreset === 'wrap_right')) {
      fields.push(
        <NumberField
          key="side-run"
          label="Side run (m)"
          value={footprintParams.sideRunM}
          disabled={disabled || !canEditFootprint}
          error={fieldErrors.sideRunM}
          onCommit={(value) => runFootprintCommit('sideRunM', { type: 'param', key: 'sideRunM', value })}
        />,
      );
    }

    return fields;
  }, [
    canEditFootprint,
    canStartDrawOutline,
    disabled,
    fieldErrors,
    footprintMode,
    footprintParams,
    footprintPreset,
    house?.footprint.attachmentSide,
    runFootprintCommit,
    runStartOutline,
  ]);
  const roofCapabilities = house?.roof.capabilities ?? null;
  const roofSections = useMemo(() => {
    const appendageHelperText = roofCapabilities?.appendageSupported
      ? 'One lower appendage band is supported in this milestone.'
      : 'Appendage bands are limited to straight or rectangular house footprints in this milestone.';
    const fields: ReactNode[] = [
      <SelectField
        key="roof-form"
        label="Roof form"
        value={roofDraft.form ?? 'mono'}
        options={ROOF_FORM_OPTIONS}
        disabled={disabled}
        error={fieldErrors['roof-form']}
        onCommit={(value) =>
          runRoofCommit('roof-form', {
            ...roofDraft,
            form: value as HouseFirstRoofDraft['form'],
          })
        }
      />,
      <NumberField
        key="roof-pitch"
        label="Roof pitch (deg)"
        value={roofDraft.primaryPitchDeg ?? ''}
        disabled={disabled}
        error={fieldErrors['roof-pitch']}
        helperText="Shared roof pitch for the main house roof."
        onCommit={(value) =>
          runRoofCommit('roof-pitch', {
            ...roofDraft,
            primaryPitchDeg: value,
          })
        }
      />,
      <SelectField
        key="roof-material"
        label="Roof material"
        value={roofDraft.material ?? 'corrugated_iron'}
        options={ROOF_MATERIAL_OPTIONS}
        disabled={disabled}
        error={fieldErrors['roof-material']}
        onCommit={(value) =>
          runRoofCommit('roof-material', {
            ...roofDraft,
            material: value as CalculatorHouseRoofMaterial,
          })
        }
      />,
    ];

    if ((roofCapabilities?.controls.primaryFallDirection ?? (roofDraft.form === 'mono'))) {
      fields.push(
        <SelectField
          key="roof-fall-direction"
          label="Mono fall direction"
          value={roofDraft.primaryFallDirection ?? 'positive_y'}
          options={ROOF_FALL_DIRECTION_OPTIONS}
          disabled={disabled}
          error={fieldErrors['roof-fall-direction']}
          onCommit={(value) =>
            runRoofCommit('roof-fall-direction', {
              ...roofDraft,
              primaryFallDirection: value as HouseRoofPrimaryFallDirection,
            })
          }
        />,
      );
    }

    if ((roofCapabilities?.controls.ridgeAxis ?? (roofDraft.form === 'gable'))) {
      fields.push(
        <SelectField
          key="roof-ridge-axis"
          label="Gable ridge orientation"
          value={roofDraft.ridgeAxis ?? 'x'}
          options={ROOF_RIDGE_AXIS_OPTIONS}
          disabled={disabled}
          error={fieldErrors['roof-ridge-axis']}
          onCommit={(value) =>
            runRoofCommit('roof-ridge-axis', {
              ...roofDraft,
              ridgeAxis: value as HouseRoofRidgeAxis,
            })
          }
        />,
      );
    }

    if (roofDraft.form === 'gable' && house?.roof.capabilities.selectedFormSupported) {
      if (house.roof.terminalEnds.length > 0) {
        fields.push(
          <div key="gable-end-frames" className={styles.field}>
            <span className={styles.fieldLabel}>Open gable ends</span>
            <div className={styles.buttonRow}>
              {house.roof.terminalEnds.map((end) => (
                <ActionButton
                  key={end.id}
                  label={`${end.isOpen ? 'Close' : 'Open'} ${end.label}`}
                  disabled={disabled}
                  onClick={() =>
                    void runRoofCommit(`gable-end-${end.id}`, {
                      ...roofDraft,
                      openGableEndIds: end.isOpen
                        ? (roofDraft.openGableEndIds ?? []).filter((candidate) => candidate !== end.id)
                        : [...new Set([...(roofDraft.openGableEndIds ?? []), end.id])],
                    })
                  }
                />
              ))}
            </div>
            <span className={styles.fieldHint}>
              Select which terminal gable faces render as open end frames.
            </span>
          </div>,
        );
      } else {
        fields.push(
          <p key="gable-end-frames-empty" className={styles.fieldHint}>
            No terminal gable ends are available for the current footprint.
          </p>,
        );
      }
    }

    fields.push(
      <SelectField
        key="appendage-enabled"
        label="Appendage band"
        value={roofDraft.appendage?.enabled ? 'enabled' : 'disabled'}
        options={[
          { label: 'Off', value: 'disabled' },
          { label: 'On', value: 'enabled' },
        ]}
        disabled={disabled}
        error={fieldErrors['appendage-enabled']}
        helperText={appendageHelperText}
        onCommit={(value) =>
          runRoofCommit('appendage-enabled', {
            ...roofDraft,
            appendage: {
              ...(roofDraft.appendage ?? {}),
              enabled: value === 'enabled',
            },
          })
        }
      />,
    );

    if (roofDraft.appendage?.enabled) {
      fields.push(
        <SelectField
          key="appendage-host-edge"
          label="Appendage host edge"
          value={roofDraft.appendage.hostEdge ?? 'rear'}
          options={ATTACHMENT_SIDE_OPTIONS}
          disabled={disabled}
          error={fieldErrors['appendage-host-edge']}
          onCommit={(value) =>
            runRoofCommit('appendage-host-edge', {
              ...roofDraft,
              appendage: {
                ...(roofDraft.appendage ?? {}),
                hostEdge: value as CalculatorModuleInputs['attachmentSide'],
              },
            })
          }
        />,
        <NumberField
          key="appendage-pitch"
          label="Appendage pitch (deg)"
          value={roofDraft.appendage.pitchDeg ?? ''}
          disabled={disabled}
          error={fieldErrors['appendage-pitch']}
          onCommit={(value) =>
            runRoofCommit('appendage-pitch', {
              ...roofDraft,
              appendage: {
                ...(roofDraft.appendage ?? {}),
                pitchDeg: value,
                form: Number(value) === 0 ? 'flat' : 'mono',
              },
            })
          }
        />,
        <NumberField
          key="appendage-drop"
          label="Appendage drop (mm)"
          value={roofDraft.appendage.dropMm ?? '450'}
          disabled={disabled}
          error={fieldErrors['appendage-drop']}
          onCommit={(value) =>
            runRoofCommit('appendage-drop', {
              ...roofDraft,
              appendage: {
                ...(roofDraft.appendage ?? {}),
                dropMm: value,
              },
            })
          }
        />,
      );
    }

    if (house?.roof.validation.status === 'invalid' && house.roof.validation.message) {
      fields.push(
        <p key="roof-invalid" className={styles.fieldError}>
          {house.roof.validation.message}
        </p>,
      );
    }

    return fields;
  }, [
    disabled,
    fieldErrors,
    house?.roof.validation.message,
    house?.roof.validation.status,
    roofCapabilities,
    roofDraft,
    runRoofCommit,
  ]);
  const deckSections = useMemo(() => {
    const deckValidationSummary = activeDeck ? resolveDeckValidationSummary(activeDeck) : null;
    const deckWarningSummaries = activeDeck ? resolveDeckWarningSummaries(activeDeck) : [];
    const pendingAttachedDeckCreation = pendingDeckCreationKind === 'attached_preset';
    const deckButtons: ReactNode[] = [
      <div key="deck-actions" className={styles.buttonRow}>
        <ActionButton
          label="Add attached"
          disabled={disabled || pendingAttachedDeckCreation}
          onClick={() =>
            void runDeckAction(
              'deck-add-attached',
              onAddDeck?.('attached_preset'),
              'Unable to add an attached deck.',
            )
          }
        />
        <ActionButton
          label="Add detached"
          disabled={disabled}
          onClick={() =>
            void runDeckAction(
              'deck-add-detached',
              onAddDeck?.('detached_preset'),
              'Unable to add a detached deck.',
            )
          }
        />
        <ActionButton
          label="Custom outline"
          disabled={disabled}
          onClick={() =>
            void runDeckAction(
              'deck-add-custom',
              onAddDeck?.('custom_outline'),
              'Unable to start a custom deck outline.',
            )
          }
        />
      </div>,
    ];

    if (pendingAttachedDeckCreation) {
      deckButtons.push(
        <p key="deck-pending-hint" className={styles.fieldHint}>
          Click a house side in Model Space plan or 3D View to place the new attached deck.
        </p>,
        <div key="deck-pending-actions" className={styles.buttonRow}>
          <ActionButton
            label="Cancel"
            disabled={disabled}
            onClick={() => onCancelPendingDeckCreation?.()}
          />
        </div>,
      );
    }

    if (!activeDeck) {
      if (!pendingAttachedDeckCreation) {
        deckButtons.push(
          <p key="deck-empty" className={styles.empty}>
            Add a shared deck to start building external house context.
          </p>,
        );
      }
      return deckButtons;
    }

    deckButtons.push(
      <div key="deck-list" className={styles.buttonRow}>
        {house?.decks.map((deck) => (
          <button
            key={deck.id}
            type="button"
            className={deck.id === activeDeck.id ? styles.buttonPrimary : styles.overlayButton}
            disabled={disabled}
            onClick={() => onSelectDeck?.(deck.id)}
          >
            {deck.name}
          </button>
        ))}
      </div>,
      <div key="deck-active-summary" className={styles.inlineMeta}>
        <span className={styles.inlineLabel}>Editing</span>
        <span className={styles.inlineValue}>
          {activeDeck.isAttached ? 'Attached' : 'Detached'}{' '}
          {activeDeck.shape === 'preset' ? 'rectangular preset' : 'custom outline'}
        </span>
      </div>,
      <p key="deck-selection-hint" className={styles.fieldHint}>
        {activeDeck.shape === 'preset' && activeDeck.isAttached
          ? 'Only the selected deck shows active dimensions in plan/model space. Attached rectangular presets can be dragged in Model Space and expose host-edge relationship dimensions on selection.'
          : 'Only the selected deck shows active dimensions in plan/model space. Secondary decks stay visible but muted.'}
      </p>,
      activeDeck.shape === 'custom' ? (
        <p key="deck-custom-deferred" className={styles.fieldHint}>
          Custom outlines keep their existing point/edge editing flow. Object drag, snap previews, and house-edge relationship dimensions are still deferred for custom decks.
        </p>
      ) : null,
      activeDeck.shape === 'preset' && !activeDeck.isAttached ? (
        <p key="deck-detached-deferred" className={styles.fieldHint}>
          Detached rectangular decks keep the preset fields below, but drag, snap, and house-edge relationship dimensions currently apply only to attached preset decks.
        </p>
      ) : null,
      <TextField
        key="deck-name"
        label="Deck name"
        value={activeDeck.name}
        disabled={disabled}
        error={fieldErrors[`deck-name-${activeDeck.id}`]}
        onCommit={(value) =>
          runDeckAction(
            `deck-name-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, { name: value }),
            'Unable to rename the deck.',
          )
        }
      />,
      <SelectField
        key="deck-kind"
        label="Deck kind"
        value={activeDeck.kind}
        options={DECK_KIND_OPTIONS}
        disabled={disabled}
        error={fieldErrors[`deck-kind-${activeDeck.id}`]}
        onCommit={(value) =>
          runDeckAction(
            `deck-kind-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, { kind: value as HouseFirstDeckDraft['kind'] }),
            'Unable to update the deck kind.',
          )
        }
      />,
      <SelectField
        key="deck-attachment"
        label="Deck placement"
        value={activeDeck.isAttached ? 'attached' : 'detached'}
        options={DECK_ATTACHMENT_OPTIONS}
        disabled={disabled}
        error={fieldErrors[`deck-placement-${activeDeck.id}`]}
        helperText={
          activeDeck.isAttached
            ? 'Attached decks rebuild directly off the selected exterior host edge.'
            : 'Detached decks keep the same rectangular editor, but offset away from the house.'
        }
        onCommit={(value) =>
          runDeckAction(
            `deck-placement-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, {
              isAttached: value === 'attached',
              presetType: value === 'attached' ? 'rect_attached' : 'rect_detached',
              hostEdgeId: activeDeck.hostEdgeId ?? house?.footprint.attachmentSide ?? 'rear',
              elevationMode:
                value === 'attached' && activeDeck.elevationMode === 'ground'
                  ? 'aligned_to_threshold'
                  : value === 'detached' && activeDeck.elevationMode === 'aligned_to_threshold'
                    ? 'ground'
                    : activeDeck.elevationMode,
            }),
            'Unable to update the deck placement.',
          )
        }
      />,
    );

    deckButtons.push(
      <SelectField
        key="deck-host-edge"
        label="Host edge"
        value={activeDeck.hostEdgeId ?? house?.footprint.attachmentSide ?? 'rear'}
        options={ATTACHMENT_SIDE_OPTIONS}
        disabled={disabled}
        error={fieldErrors[`deck-host-${activeDeck.id}`]}
        helperText={
          activeDeck.isAttached
            ? 'The preset rectangle will rebuild fully outside this edge.'
            : 'This edge acts as the reference side for deck width, depth, and detached gap.'
        }
        onCommit={(value) =>
          runDeckAction(
            `deck-host-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, { hostEdgeId: value }),
            'Unable to update the deck host edge.',
          )
        }
      />,
      <SelectField
        key="deck-shape"
        label="Shape"
        value={activeDeck.shape}
        options={DECK_SHAPE_OPTIONS}
        disabled={disabled}
        error={fieldErrors[`deck-shape-${activeDeck.id}`]}
        helperText="Rectangular preset is the main deck workflow. Custom outline is available when the rectangle is not enough."
        onCommit={(value) =>
          runDeckAction(
            `deck-shape-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, {
              shape: value as HouseFirstDeckDraft['shape'],
              presetType:
                value === 'preset'
                  ? activeDeck.isAttached
                    ? 'rect_attached'
                    : 'rect_detached'
                  : activeDeck.presetType,
            }),
            'Unable to update the deck shape.',
          )
        }
      />,
    );

    if (deckValidationSummary) {
      deckButtons.push(
        <p key="deck-invalid" className={styles.fieldError}>
          {deckValidationSummary}
        </p>,
      );
    }
    for (const [index, warning] of deckWarningSummaries.entries()) {
      deckButtons.push(
        <p key={`deck-warning-${index}`} className={styles.fieldHint}>
          {warning}
        </p>,
      );
    }

    if (activeDeck.shape === 'preset') {
      deckButtons.push(
        <NumberField
          key="deck-width"
          label="Width (m)"
          value={activeDeck.presetRect?.widthM ?? ''}
          disabled={disabled}
          error={fieldErrors[`deck-width-${activeDeck.id}`]}
          helperText="Span measured along the selected host edge."
          onCommit={(value) =>
            runDeckAction(
              `deck-width-${activeDeck.id}`,
              onCommitDeckPatch?.(activeDeck.id, {
                presetRect: {
                  ...resolveDeckPresetRectDraft(activeDeck),
                  widthM: value,
                },
              }),
              'Unable to update the deck width.',
            )
          }
        />,
        <NumberField
          key="deck-depth"
          label="Depth (m)"
          value={activeDeck.presetRect?.depthM ?? ''}
          disabled={disabled}
          error={fieldErrors[`deck-depth-${activeDeck.id}`]}
          helperText="Projection outward from the selected host edge."
          onCommit={(value) =>
            runDeckAction(
              `deck-depth-${activeDeck.id}`,
              onCommitDeckPatch?.(activeDeck.id, {
                presetRect: {
                  ...resolveDeckPresetRectDraft(activeDeck),
                  depthM: value,
                },
              }),
              'Unable to update the deck depth.',
            )
          }
        />,
        <NumberField
          key="deck-center-offset"
          label="Center offset (m)"
          value={activeDeck.presetRect?.centerOffsetM ?? ''}
          disabled={disabled}
          error={fieldErrors[`deck-center-offset-${activeDeck.id}`]}
          helperText="Signed offset from the host-edge midpoint."
          onCommit={(value) =>
            runDeckAction(
              `deck-center-offset-${activeDeck.id}`,
              onCommitDeckPatch?.(activeDeck.id, {
                presetRect: {
                  ...resolveDeckPresetRectDraft(activeDeck),
                  centerOffsetM: value,
                },
              }),
              'Unable to update the deck center offset.',
            )
          }
        />,
      );

      if (activeDeck.isAttached) {
        deckButtons.push(
          <p key="deck-model-space-hint" className={styles.fieldHint}>
            In Model Space, select this deck to edit width/depth plus host-edge start and end gaps. Drag the deck body to move it along the host edge.
          </p>,
        );
      }

      if (!activeDeck.isAttached) {
        deckButtons.push(
          <NumberField
            key="deck-detached-gap"
            label="Detached gap (m)"
            value={activeDeck.presetRect?.detachedGapM ?? ''}
            disabled={disabled}
            error={fieldErrors[`deck-detached-gap-${activeDeck.id}`]}
            helperText="Clear gap from the house-side host edge."
            onCommit={(value) =>
              runDeckAction(
                `deck-detached-gap-${activeDeck.id}`,
                onCommitDeckPatch?.(activeDeck.id, {
                  presetRect: {
                    ...resolveDeckPresetRectDraft(activeDeck),
                    detachedGapM: value,
                  },
                }),
                'Unable to update the detached gap.',
              )
            }
          />,
        );
      }
    }

    deckButtons.push(
      <SelectField
        key="deck-elevation"
        label="Elevation mode"
        value={activeDeck.elevationMode}
        options={DECK_ELEVATION_OPTIONS}
        disabled={disabled}
        error={fieldErrors[`deck-elevation-${activeDeck.id}`]}
        onCommit={(value) =>
          runDeckAction(
            `deck-elevation-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, { elevationMode: value as HouseFirstDeckDraft['elevationMode'] }),
            'Unable to update the deck elevation mode.',
          )
        }
      />,
      <NumberField
        key="deck-offset"
        label="Level offset (mm)"
        value={activeDeck.levelOffsetMm}
        disabled={disabled}
        error={fieldErrors[`deck-offset-${activeDeck.id}`]}
        helperText="One scalar height offset for the deck top surface."
        onCommit={(value) =>
          runDeckAction(
            `deck-offset-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, { levelOffsetMm: value }),
            'Unable to update the deck level offset.',
          )
        }
      />,
      <SelectField
        key="deck-surface"
        label="Surface material"
        value={activeDeck.surfaceMaterial}
        options={DECK_SURFACE_OPTIONS}
        disabled={disabled}
        error={fieldErrors[`deck-surface-${activeDeck.id}`]}
        onCommit={(value) =>
          runDeckAction(
            `deck-surface-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, { surfaceMaterial: value as HouseFirstDeckDraft['surfaceMaterial'] }),
            'Unable to update the deck material.',
          )
        }
      />,
      <div key="deck-edit-actions" className={styles.buttonRow}>
        <ActionButton
          label="Redraw outline"
          disabled={disabled}
          onClick={() =>
            void runDeckAction(
              `deck-outline-${activeDeck.id}`,
              onStartDeckOutline?.(activeDeck.id),
              'Unable to start deck outline drawing.',
            )
          }
        />
        <ActionButton
          label="Remove deck"
          disabled={disabled}
          onClick={() =>
            void runDeckAction(
              `deck-remove-${activeDeck.id}`,
              onRemoveDeck?.(activeDeck.id),
              'Unable to remove the deck.',
            )
          }
        />
      </div>,
    );

    return deckButtons;
  }, [
    activeDeck,
    disabled,
    fieldErrors,
    house?.decks,
    house?.footprint.attachmentSide,
    onAddDeck,
    onCancelPendingDeckCreation,
    onCommitDeckPatch,
    onRemoveDeck,
    onSelectDeck,
    onStartDeckOutline,
    pendingDeckCreationKind,
    runDeckAction,
  ]);
  const openingSections = useMemo(() => {
    const openingValidationSummary = activeOpening?.validation.message ?? null;
    const sections: ReactNode[] = [
      <div key="opening-actions" className={styles.buttonRow}>
        <ActionButton
          label="Add window"
          disabled={disabled}
          onClick={() =>
            void runDeckAction(
              'opening-add-window',
              onAddOpening?.(),
              'Unable to add a window.',
            )
          }
        />
      </div>,
    ];

    if (!activeOpening) {
      sections.push(
        <p key="opening-empty" className={styles.empty}>
          Add a shared window to start editing host-wall openings in house mode.
        </p>,
      );
      return sections;
    }

    sections.push(
      <div key="opening-list" className={styles.buttonRow}>
        {house?.openings.map((opening) => (
          <button
            key={opening.id}
            type="button"
            className={opening.id === activeOpening.id ? styles.buttonPrimary : styles.overlayButton}
            disabled={disabled}
            onClick={() => onSelectOpening?.(opening.id)}
          >
            {opening.label}
          </button>
        ))}
      </div>,
      <p key="opening-selection-hint" className={styles.fieldHint}>
        Selected windows show width and along-wall offset dimensions in Model Space plan. Height and sill stay editable in the rail for this slice.
      </p>,
      <TextField
        key="opening-label"
        label="Window label"
        value={activeOpening.label}
        disabled={disabled}
        error={fieldErrors[`opening-label-${activeOpening.id}`]}
        onCommit={(value) =>
          runDeckAction(
            `opening-label-${activeOpening.id}`,
            onCommitOpeningPatch?.(activeOpening.id, { label: value }),
            'Unable to rename the window.',
          )
        }
      />,
      <SelectField
        key="opening-wall"
        label="Host wall"
        value={activeOpening.wallId ?? house?.footprint.attachmentSide ?? 'rear'}
        options={ATTACHMENT_SIDE_OPTIONS}
        disabled={disabled}
        error={fieldErrors[`opening-wall-${activeOpening.id}`]}
        onCommit={(value) =>
          runDeckAction(
            `opening-wall-${activeOpening.id}`,
            onCommitOpeningPatch?.(activeOpening.id, { wallId: value as WallOpeningHostSide }),
            'Unable to update the host wall.',
          )
        }
      />,
      <NumberField
        key="opening-width"
        label="Window width (m)"
        value={activeOpening.widthM}
        disabled={disabled}
        error={fieldErrors[`opening-width-${activeOpening.id}`]}
        onCommit={(value) =>
          runDeckAction(
            `opening-width-${activeOpening.id}`,
            onCommitOpeningPatch?.(activeOpening.id, { widthM: value }),
            'Unable to update the window width.',
          )
        }
      />,
      <NumberField
        key="opening-height"
        label="Window height (m)"
        value={activeOpening.heightM}
        disabled={disabled}
        error={fieldErrors[`opening-height-${activeOpening.id}`]}
        onCommit={(value) =>
          runDeckAction(
            `opening-height-${activeOpening.id}`,
            onCommitOpeningPatch?.(activeOpening.id, { heightM: value }),
            'Unable to update the window height.',
          )
        }
      />,
      <NumberField
        key="opening-sill-height"
        label="Sill height (m)"
        value={activeOpening.sillHeightM}
        disabled={disabled}
        error={fieldErrors[`opening-sill-height-${activeOpening.id}`]}
        onCommit={(value) =>
          runDeckAction(
            `opening-sill-height-${activeOpening.id}`,
            onCommitOpeningPatch?.(activeOpening.id, { sillHeightM: value }),
            'Unable to update the sill height.',
          )
        }
      />,
      <NumberField
        key="opening-offset"
        label="Offset along wall (m)"
        value={activeOpening.offsetAlongWallM}
        disabled={disabled}
        error={fieldErrors[`opening-offset-${activeOpening.id}`]}
        helperText="Measured from the selected wall start in the current house-side frame."
        onCommit={(value) =>
          runDeckAction(
            `opening-offset-${activeOpening.id}`,
            onCommitOpeningPatch?.(activeOpening.id, { offsetAlongWallM: value }),
            'Unable to update the along-wall offset.',
          )
        }
      />,
      <div key="opening-edit-actions" className={styles.buttonRow}>
        <ActionButton
          label="Remove window"
          disabled={disabled}
          onClick={() =>
            void runDeckAction(
              `opening-remove-${activeOpening.id}`,
              onRemoveOpening?.(activeOpening.id),
              'Unable to remove the window.',
            )
          }
        />
      </div>,
    );

    if (openingValidationSummary) {
      sections.push(
        <p key="opening-invalid" className={styles.fieldError}>
          {openingValidationSummary}
        </p>,
      );
    }

    return sections;
  }, [
    activeOpening,
    disabled,
    fieldErrors,
    house?.footprint.attachmentSide,
    house?.openings,
    onAddOpening,
    onCommitOpeningPatch,
    onRemoveOpening,
    onSelectOpening,
    runDeckAction,
  ]);

  return (
    <div className={styles.rail}>
      <SummarySection
        title="House Configurator"
        items={[
          { label: 'Shared house', value: house?.label ?? 'Not derived yet' },
          { label: 'Roof form', value: labelForRoofForm(house?.roof.form) },
          {
            label: 'Roof status',
            value: house?.roof.validation.status === 'invalid' ? 'Blocked' : 'Ready',
          },
          { label: 'Decks', value: String(house?.decks.length ?? 0) },
          { label: 'Windows', value: String(house?.openings.length ?? 0) },
          { label: 'Footprint', value: labelForPreset(house?.footprint.preset) },
          { label: 'Rotation', value: formatRotation(house?.footprint.drawingRotationQuarterTurns) },
          { label: 'Attachment side', value: labelForAttachmentSide(house?.footprint.attachmentSide) },
          { label: 'Pergolas', value: String(pergolas.length) },
        ]}
        hint={
          house?.lowConfidence
            ? `Migration warnings are present for the shared house (${warnings.length}).`
            : 'House mode is the shared source of truth for footprint editing in this slice.'
        }
      />

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Footprint</h4>
        <div className={styles.sectionBody}>{sections}</div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Roof</h4>
        <div className={styles.sectionBody}>{roofSections}</div>
      </section>
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Decks</h4>
        <div className={styles.sectionBody}>{deckSections}</div>
      </section>
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Openings</h4>
        <div className={styles.sectionBody}>{openingSections}</div>
      </section>
    </div>
  );
}

export default function HouseFirstWorkbenchRail({
  workbenchMode,
  house,
  activeDeckId,
  activeOpeningId,
  pergolas,
  warnings,
  disabled,
  canEditFootprint,
  canStartDrawOutline,
  onStartDrawOutline,
  onCommitFootprintEdit,
  onCommitRoofDraft,
  onSelectDeck,
  onSelectOpening,
  onAddDeck,
  onAddOpening,
  onRemoveDeck,
  onRemoveOpening,
  onCommitDeckPatch,
  onCommitOpeningPatch,
  onStartDeckOutline,
  pendingDeckCreationKind,
  onCancelPendingDeckCreation,
  pergolaFallback,
}: HouseFirstWorkbenchRailProps) {
  if (workbenchMode === 'pergolas') {
    return (
      <div className={styles.rail}>
        <SummarySection
          title="Pergola Mode"
          items={[
            { label: 'Pergolas', value: String(pergolas.length) },
            { label: 'Shared house', value: house?.label ?? 'Not derived yet' },
            { label: 'Warnings', value: String(warnings.length) },
          ]}
          hint="Pergola editing is still routed through the existing Sanctuary fallback editor in this slice."
        />
        {pergolaFallback}
      </div>
    );
  }

  return (
      <HouseModeRail
        house={house}
        activeDeckId={activeDeckId}
        activeOpeningId={activeOpeningId}
        pergolas={pergolas}
      warnings={warnings}
      disabled={disabled}
      canEditFootprint={canEditFootprint}
      canStartDrawOutline={canStartDrawOutline}
      onStartDrawOutline={onStartDrawOutline}
      onCommitFootprintEdit={onCommitFootprintEdit}
        onCommitRoofDraft={onCommitRoofDraft}
        onSelectDeck={onSelectDeck}
        onSelectOpening={onSelectOpening}
        onAddDeck={onAddDeck}
        onAddOpening={onAddOpening}
        onRemoveDeck={onRemoveDeck}
        onRemoveOpening={onRemoveOpening}
        onCommitDeckPatch={onCommitDeckPatch}
        onCommitOpeningPatch={onCommitOpeningPatch}
        onStartDeckOutline={onStartDeckOutline}
      pendingDeckCreationKind={pendingDeckCreationKind}
      onCancelPendingDeckCreation={onCancelPendingDeckCreation}
    />
  );
}
