'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { HOUSE_FOOTPRINT_PRESET_OPTIONS } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import {
  FLASHING_BANDS,
  FLASHING_BAND_OPTIONS,
  FLASHING_PURPOSE_OPTIONS,
  formatFlashingLengthInput,
  isPrimaryFlashingLengthAutoLinked,
  makeFlashingId,
  normalizeFlashingsStateForUi,
  roofLengthForPrimaryFlashing,
} from '@/lib/drawings/flashings';
import type {
  CalculatorFlashingBand,
  CalculatorFlashingPurpose,
  CalculatorFlashingsState,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import {
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPreset,
  supportsHouseFootprints,
} from '@/lib/types/calculator';
import type {
  EditableJobFieldKey,
  EditableModuleFieldKey,
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

type SelectOption = { label: string; value: string; disabled?: boolean };
type SummaryItem = { label: string; value: string; helperText?: string };

type RailFieldDefinition =
  | { id: string; kind: 'select'; label: string; value: string; options: SelectOption[]; helperText?: string; error?: string; disabled?: boolean; pending?: boolean; onCommit: (value: string) => Promise<unknown> | void }
  | { id: string; kind: 'number' | 'text'; label: string; value: string; helperText?: string; error?: string; disabled?: boolean; pending?: boolean; onCommit: (value: string) => Promise<unknown> | void }
  | { id: string; kind: 'toggle'; label: string; value: boolean; helperText?: string; error?: string; disabled?: boolean; pending?: boolean; onCommit: (value: boolean) => Promise<unknown> | void }
  | { id: string; kind: 'readOnly'; label: string; value: string; helperText?: string };

type RailSection = { id: string; title: string; defaultOpen: boolean; body: ReactNode };

const PERGOLA_STYLE_OPTIONS: SelectOption[] = [
  { label: 'Pitched', value: 'pitched' },
  { label: 'Gable', value: 'gable' },
  { label: 'Hip', value: 'hip' },
  { label: 'Hip (corner)', value: 'hip_corner' },
];
const ROOF_MATERIAL_OPTIONS: SelectOption[] = [
  { label: 'Acrylic', value: 'acrylic' },
  { label: 'Timber', value: 'timber' },
  { label: 'Mixed (Acrylic + Timber)', value: 'mixed' },
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
const GROUND_OPTIONS: SelectOption[] = [{ label: 'Easy', value: 'easy' }, { label: 'Hard', value: 'hard' }];
const ACCESS_OPTIONS: SelectOption[] = [{ label: 'Easy', value: 'easy' }, { label: 'Normal', value: 'normal' }, { label: 'Hard', value: 'hard' }];
const HEIGHT_OPTIONS: SelectOption[] = [{ label: 'Single storey', value: 'single_storey' }, { label: 'Two storey', value: 'two_storey' }];
const JOB_TYPE_OPTIONS: SelectOption[] = [{ label: 'Residential', value: 'residential' }, { label: 'Commercial', value: 'commercial' }];
const TIMBER_ROOF_ABOVE_OPTIONS: SelectOption[] = [
  { label: 'Insulated panels', value: 'insulated_panels' },
  { label: 'Steel corrugated', value: 'steel_corrugated' },
  { label: 'Steel tray', value: 'steel_tray' },
];
const TIMBER_TRAY_WIDTH_OPTIONS: SelectOption[] = [{ label: '400', value: '400' }, { label: '500', value: '500' }, { label: '600', value: '600' }];
const EXTRUSION_COLOUR_OPTIONS: SelectOption[] = [{ label: 'Black', value: 'Black' }, { label: 'White', value: 'White' }, { label: 'Mill', value: 'Mill' }];
const POWDERCOAT_STANDARD_COLOUR_OPTIONS: SelectOption[] = [
  { label: 'Select', value: '' },
  { label: 'Ironsands', value: 'Ironsands' },
  { label: 'Charcoal', value: 'Charcoal' },
  { label: 'Grey Friars', value: 'Grey Friars' },
  { label: 'Flaxpod', value: 'Flaxpod' },
  { label: 'Rangoon Green', value: 'Rangoon Green' },
  { label: 'Gull Grey', value: 'Gull Grey' },
  { label: 'Titania', value: 'Titania' },
];
const GABLE_END_FRAME_OPTIONS: SelectOption[] = [{ label: 'None', value: 'none' }, { label: 'Outer end only', value: 'outer_end_only' }, { label: 'Both ends', value: 'both_ends' }];
const GABLE_GUTTER_OPTIONS: SelectOption[] = [{ label: 'House gutter', value: 'house' }, { label: 'Our gutter (SP)', value: 'our' }];
const BOX_GUTTER_OPTIONS: SelectOption[] = [{ label: 'House gutter', value: 'house' }, { label: 'Our gutter', value: 'our' }, { label: 'None', value: 'none' }];
const OVERHANG_SUPPORT_BEAM_OPTIONS: SelectOption[] = [{ label: '150x50', value: '150x50' }, { label: '200x50', value: '200x50' }, { label: 'Steel RHS 150x50x3', value: 'RHS 150x50x3' }];
const DEFAULT_OVERRIDE_OPTION: SelectOption = { label: 'Default (auto)', value: '' };
const RAFTER_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '80x50', value: '80x50' }, { label: '100x50', value: '100x50' }, { label: '150x50', value: '150x50' }, { label: '200x50', value: '200x50' }];
const LEDGER_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '80x50', value: '80x50' }, { label: '100x50', value: '100x50' }, { label: '150x50', value: '150x50' }, { label: '200x50', value: '200x50' }];
const POST_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '80x50', value: '80x50' }, { label: '100x50', value: '100x50' }, { label: '150x100', value: '150x100' }, { label: '100x100', value: '100x100' }, { label: '150x150', value: '150x150' }];
const FRONT_BEAM_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: 'SP Gutter', value: 'SP Gutter' }, { label: '100x50', value: '100x50' }, { label: '150x50', value: '150x50' }, { label: '200x50', value: '200x50' }, { label: '300x50', value: '300x50' }, { label: 'Steel RHS 150x50x3', value: 'RHS 150x50x3' }];
const RIDGE_BEAM_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '100x50', value: '100x50' }, { label: '150x50', value: '150x50' }, { label: '200x50', value: '200x50' }, { label: 'Steel RHS 150x50x3', value: 'RHS 150x50x3' }];
const BOX_BEAM_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '300x50', value: '300x50' }, { label: '250x50', value: '250x50' }, { label: '200x50', value: '200x50' }];
const STRUT_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '50x50', value: '50x50' }, { label: '80x50', value: '80x50' }, { label: '100x50', value: '100x50' }, { label: '150x50', value: '150x50' }, { label: '200x50', value: '200x50' }];
const DP_JOIN_OPTIONS: SelectOption[] = Array.from({ length: 11 }, (_, i) => ({ label: String(i), value: String(i) }));
const DP_ELBOW_OPTIONS: SelectOption[] = Array.from({ length: 21 }, (_, i) => ({ label: String(i), value: String(i) }));
const DEFAULT_SECTION_STATE: Record<string, boolean> = { 'connections-site': true, structure: true, flashings: false, overrides: false, allowances: false, 'house-footprint': false };

function withCurrentOption(options: SelectOption[], current: string | undefined, fallbackLabel: string): SelectOption[] {
  if (!current || options.some((option) => option.value === current)) return options;
  return [{ label: fallbackLabel, value: current, disabled: true }, ...options];
}

function labelForOption(options: SelectOption[], value: string | undefined, fallback = '—'): string {
  if (!value) return fallback;
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function resolveCommitResult(action: Promise<CommitResult> | CommitResult): Promise<CommitResult> {
  return Promise.resolve(action);
}

function renderField(field: RailFieldDefinition) {
  if (field.kind === 'readOnly') {
    return <div key={field.id} className={styles.field}><span className={styles.fieldLabel}>{field.label}</span><div className={styles.inlineMeta}><span className={styles.inlineValue}>{field.value}</span></div>{field.helperText ? <span className={styles.fieldHint}>{field.helperText}</span> : null}</div>;
  }
  if (field.kind === 'toggle') {
    return <ToggleField key={field.id} {...field} />;
  }
  if (field.kind === 'select') {
    return <SelectField key={field.id} {...field} />;
  }
  return <TextLikeField key={field.id} {...field} />;
}

function SelectField(field: Extract<RailFieldDefinition, { kind: 'select' }>) {
  return <label className={styles.field}><span className={styles.fieldLabel}>{field.label}</span><select id={field.id} className={styles.select} aria-label={field.label} value={field.value} disabled={field.disabled || field.pending} onChange={(event) => void field.onCommit(event.target.value)}>{field.options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select>{field.error ? <span className={styles.fieldError}>{field.error}</span> : field.helperText ? <span className={styles.fieldHint}>{field.helperText}</span> : null}</label>;
}

function TextLikeField(field: Extract<RailFieldDefinition, { kind: 'number' | 'text' }>) {
  const [draft, setDraft] = useState(field.value);
  useEffect(() => setDraft(field.value), [field.value]);
  const commit = useCallback(async () => {
    if (draft === field.value) return;
    await field.onCommit(draft);
  }, [draft, field]);
  return <label className={styles.field}><span className={styles.fieldLabel}>{field.label}</span><input id={field.id} className={styles.input} aria-label={field.label} inputMode={field.kind === 'number' ? 'decimal' : undefined} value={draft} disabled={field.disabled || field.pending} onChange={(event) => setDraft(event.target.value)} onBlur={() => void commit()} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void commit(); } if (event.key === 'Escape') { event.preventDefault(); setDraft(field.value); } }} />{field.error ? <span className={styles.fieldError}>{field.error}</span> : field.helperText ? <span className={styles.fieldHint}>{field.helperText}</span> : null}</label>;
}

function ToggleField(field: Extract<RailFieldDefinition, { kind: 'toggle' }>) {
  return <label className={`${styles.field} ${styles.toggleField}`}><div className={styles.toggleHeader}><span className={styles.fieldLabel}>{field.label}</span><button id={field.id} type="button" className={`${styles.toggleButton} ${field.value ? styles.toggleButtonActive : ''}`} aria-pressed={field.value} disabled={field.disabled || field.pending} onClick={() => void field.onCommit(!field.value)}>{field.value ? 'On' : 'Off'}</button></div>{field.error ? <span className={styles.fieldError}>{field.error}</span> : field.helperText ? <span className={styles.fieldHint}>{field.helperText}</span> : null}</label>;
}

function SummarySection({ title, items, hint }: { title: string; items: SummaryItem[]; hint?: string }) {
  if (!items.length && !hint) return null;
  return <section className={styles.section}><h4 className={styles.sectionTitle}>{title}</h4>{items.length ? <div className={styles.summaryList}>{items.map((item) => <div key={`${title}-${item.label}`} className={styles.summaryRow}><span className={styles.summaryLabel}>{item.label}</span><span className={styles.summaryValue}>{item.value}</span>{item.helperText ? <span className={styles.summaryHint}>{item.helperText}</span> : null}</div>)}</div> : null}{hint ? <p className={styles.empty}>{hint}</p> : null}</section>;
}

const EMPTY_MODULE: CalculatorModuleInputs = {
  pergolaStyle: 'pitched',
  roofMaterial: 'acrylic',
  extrusionColour: 'White',
  boxPerimeterEnabled: false,
  internalRoofType: 'pitched',
  fallDistanceMm: '0',
  roofPitchDeg: '5',
  gableEndFramesMode: 'none',
  gableHouseEdgeGutter: 'house',
  gableOuterEdgeGutter: 'our',
  boxGutterHouseEdge: 'house',
  boxGutterFarEdge: 'our',
  downpipeCount: '0',
  downpipeJoinCount: '0',
  downpipeElbowCount: '0',
  separateGutterEnabled: false,
  overhangEnabled: false,
  overhangAmountM: '0',
  overhangSupportBeamProfile: '150x50',
  invertedEnabled: false,
  invertedHouseGutter: false,
  mixedSkylightStripCount: '0',
  mixedSkylightStripWidthM: '0',
  mixedAcrylicBaysMain: '0',
  mixedAcrylicBaysA: '0',
  mixedAcrylicBaysB: '0',
  timberRoofAboveType: 'insulated_panels',
  timberInsulatedPanelThicknessMm: '50',
  timberTrayWidthMm: '500',
  postCount: '2',
  houseConnectionType: 'fascia',
  postConnectionType: 'deck_bracket',
  ground: 'easy',
  lengthM: '6',
  projectionM: '3',
  hipCornerLengthBM: '0',
  hipCornerProjectionBM: '0',
  postCutHeightM: '2.5',
  timberRoofAllowanceExGst: '0',
  flashings: { rows: [] },
  overrides: {},
  infills: { items: [] },
};

function toNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatMaybeNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function resolveFieldEditorValue(field: EstimateDrawingField | undefined, fallback: string): string {
  return field?.rawValue ?? fallback;
}

function computeHasOurGutter(module: CalculatorModuleInputs): boolean {
  if (module.invertedEnabled && module.invertedHouseGutter) return false;
  if (module.boxPerimeterEnabled) return module.boxGutterHouseEdge === 'our' || module.boxGutterFarEdge === 'our';
  if (module.pergolaStyle === 'gable') return module.gableHouseEdgeGutter === 'our' || module.gableOuterEdgeGutter === 'our';
  return module.houseConnectionType !== 'none';
}

function hasGutterBeam(profile: string | undefined): boolean {
  return Boolean(profile && profile.toLowerCase().replace(/\s+/g, '').includes('spgutter'));
}

function resolveBayCounts(module: CalculatorModuleInputs): { roofType: string; bayCountMain: number; bayCountA: number; bayCountB: number } {
  const roofType = module.pergolaStyle === 'hip_corner' ? 'hip_corner' : module.pergolaStyle;
  const lengthMmA = Math.max(0, Math.round((Number.isFinite(toNumber(module.lengthM)) ? toNumber(module.lengthM) : 0) * 1000));
  const bayCountA = Math.max(0, Math.ceil(lengthMmA / 1000));
  if (roofType === 'hip_corner') {
    const lengthMmB = Math.max(0, Math.round((Number.isFinite(toNumber(module.hipCornerLengthBM)) ? toNumber(module.hipCornerLengthBM) : 0) * 1000));
    return { roofType, bayCountMain: 0, bayCountA, bayCountB: Math.max(0, Math.ceil(lengthMmB / 1000)) };
  }
  if (roofType === 'pitched') return { roofType, bayCountMain: bayCountA, bayCountA: 0, bayCountB: 0 };
  return { roofType, bayCountMain: 0, bayCountA, bayCountB: bayCountA };
}

function jobFieldFallback(key: EditableJobFieldKey): string {
  switch (key) {
    case 'access':
      return 'normal';
    case 'height':
      return 'single_storey';
    case 'jobType':
      return 'residential';
    default:
      return '0';
  }
}

export default function ConfiguratorRail({
  moduleLabel,
  moduleInput,
  view,
  mode,
  editableFields = [],
  onCommitFootprintEdit,
  onCommitModuleField,
  onOpenFullCalculator,
  onSwitchToModelSpace,
  disabled = false,
}: ConfiguratorRailProps) {
  const [pendingFieldId, setPendingFieldId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sectionOpenState, setSectionOpenState] = useState<Record<string, boolean>>(DEFAULT_SECTION_STATE);
  const [showAllFlashingBands, setShowAllFlashingBands] = useState(false);

  const editableFieldsById = useMemo(() => new Map(editableFields.map((field) => [field.id, field])), [editableFields]);
  const module = moduleInput ?? EMPTY_MODULE;
  const footprintParams = useMemo(() => normalizeHouseFootprintParams(module.houseFootprintParams), [module.houseFootprintParams]);
  const footprintPreset = normalizeHouseFootprintPreset(module.houseFootprintPreset);
  const rotationQuarterTurns = normalizeDrawingRotationQuarterTurns(module.drawingRotationQuarterTurns);
  const canEdit = !disabled && Boolean(moduleInput);
  const canEditHouseContext = canEdit && Boolean(onCommitFootprintEdit) && module.houseConnectionType !== 'none' && supportsHouseFootprints(module.pergolaStyle);
  const footprintSectionAvailable = module.houseConnectionType !== 'none' && supportsHouseFootprints(module.pergolaStyle);
  const showPlanContextControls = view === 'plan' && canEditHouseContext;
  const flashingsState = useMemo(() => normalizeFlashingsStateForUi(module.flashings, module), [module.flashings, module]);
  const gableGutterOptions = useMemo(() => (module.houseConnectionType === 'none' ? [GABLE_GUTTER_OPTIONS[1]] : GABLE_GUTTER_OPTIONS), [module.houseConnectionType]);
  const hasOurGutter = useMemo(() => computeHasOurGutter(module), [module]);
  const bayCounts = useMemo(() => resolveBayCounts(module), [module]);
  const showSeparateGutterToggle = useMemo(() => !module.boxPerimeterEnabled && !module.overhangEnabled && !module.invertedEnabled && !hasGutterBeam((module.overrides?.frontBeamProfile ?? '').trim() || 'SP Gutter'), [module]);

  const runCommit = useCallback(async (fieldId: string, action: Promise<CommitResult> | CommitResult) => {
    setPendingFieldId(fieldId);
    const result = await resolveCommitResult(action);
    setPendingFieldId((current) => (current === fieldId ? null : current));
    setFieldErrors((current) => {
      const next = { ...current };
      if (result.ok) delete next[fieldId];
      else next[fieldId] = result.error ?? 'Unable to update the drawing draft.';
      return next;
    });
    return result;
  }, []);

  const commitModuleField = useCallback(async (fieldId: string, edit: EstimateDrawingModuleFieldEdit) => {
    if (!onCommitModuleField) return { ok: false, error: 'This configurator control is not available right now.' } satisfies CommitResult;
    return await runCommit(fieldId, onCommitModuleField(edit));
  }, [onCommitModuleField, runCommit]);

  const commitFootprintEdit = useCallback(async (fieldId: string, edit: EstimateDrawingFootprintEdit) => {
    if (!onCommitFootprintEdit) return { ok: false, error: 'House footprint controls are not available right now.' } satisfies CommitResult;
    return await runCommit(fieldId, onCommitFootprintEdit(edit));
  }, [onCommitFootprintEdit, runCommit]);

  const commitModuleValue = useCallback(async <K extends EditableModuleFieldKey>(fieldId: string, key: K, value: CalculatorModuleInputs[K]) => await commitModuleField(fieldId, { field: 'moduleValue', key, value }), [commitModuleField]);
  const commitJobValue = useCallback(async (fieldId: string, key: EditableJobFieldKey, value: string) => await commitModuleField(fieldId, { field: 'jobValue', key, value } as EstimateDrawingModuleFieldEdit), [commitModuleField]);
  const commitOverrideValue = useCallback(async (fieldId: string, key: keyof NonNullable<CalculatorModuleInputs['overrides']>, value: string) => await commitModuleField(fieldId, { field: 'moduleOverride', key, value }), [commitModuleField]);
  const resolveJobField = useCallback((key: EditableJobFieldKey) => editableFieldsById.get(`job:${key}`)?.rawValue ?? jobFieldFallback(key), [editableFieldsById]);

  const geometrySummaryItems = useMemo<SummaryItem[]>(() => (
    view === 'plan'
      ? [
          { label: 'Plan length', value: resolveFieldEditorValue(editableFieldsById.get('plan:lengthA'), module.lengthM) },
          { label: 'Plan span', value: resolveFieldEditorValue(editableFieldsById.get('plan:spanA'), module.projectionM) },
        ]
      : [
          { label: 'Section span', value: resolveFieldEditorValue(editableFieldsById.get('section:spanA'), module.projectionM) },
          { label: 'Roof pitch', value: resolveFieldEditorValue(editableFieldsById.get('section:pitch'), module.roofPitchDeg) },
        ]
  ), [editableFieldsById, module.lengthM, module.projectionM, module.roofPitchDeg, view]);

  const structureSummaryItems = useMemo<SummaryItem[]>(() => [
    { label: 'Pergola style', value: labelForOption(PERGOLA_STYLE_OPTIONS, module.pergolaStyle) },
    { label: 'Roof material', value: labelForOption(ROOF_MATERIAL_OPTIONS, module.roofMaterial) },
    { label: 'House connection', value: labelForOption(HOUSE_CONNECTION_OPTIONS, module.houseConnectionType) },
  ], [module.houseConnectionType, module.pergolaStyle, module.roofMaterial]);

  const flashingTotalsPreview = useMemo(() => {
    const totals: Record<CalculatorFlashingBand, number> = { '0-200': 0, '201-300': 0, '301-400': 0 };
    for (const row of flashingsState.rows) {
      const length = toNumber(row.lengthM);
      if (!Number.isFinite(length) || length <= 0) continue;
      totals[row.band] += length;
    }
    return totals;
  }, [flashingsState.rows]);
  const flashingVisibleBands = useMemo(() => FLASHING_BANDS.filter((band) => showAllFlashingBands || flashingTotalsPreview[band] > 0), [flashingTotalsPreview, showAllFlashingBands]);

  const updateFlashings = useCallback(async (fieldId: string, updater: (current: CalculatorFlashingsState) => CalculatorFlashingsState) => {
    const next = normalizeFlashingsStateForUi(updater(flashingsState), module);
    return await commitModuleField(fieldId, { field: 'flashings', value: next });
  }, [commitModuleField, flashingsState, module]);

  const connectionFields: RailFieldDefinition[] = [
    { id: 'house-connection', kind: 'select', label: 'House connection', value: module.houseConnectionType, options: HOUSE_CONNECTION_OPTIONS, pending: pendingFieldId === 'house-connection', error: fieldErrors['house-connection'], disabled: !canEdit, onCommit: (value) => commitModuleValue('house-connection', 'houseConnectionType', value as CalculatorModuleInputs['houseConnectionType']) },
    { id: 'post-connection', kind: 'select', label: 'Post connection', value: module.postConnectionType, options: POST_CONNECTION_OPTIONS, pending: pendingFieldId === 'post-connection', error: fieldErrors['post-connection'], disabled: !canEdit, onCommit: (value) => commitModuleValue('post-connection', 'postConnectionType', value as CalculatorModuleInputs['postConnectionType']) },
    ...(module.postConnectionType === 'pile_1m' || module.postConnectionType === 'pile_1_5m' ? [{ id: 'ground-condition', kind: 'select', label: 'Ground', value: module.ground, options: GROUND_OPTIONS, helperText: 'Applies to concrete pile actions.', pending: pendingFieldId === 'ground-condition', error: fieldErrors['ground-condition'], disabled: !canEdit, onCommit: (value: string) => commitModuleValue('ground-condition', 'ground', value as CalculatorModuleInputs['ground']) } satisfies RailFieldDefinition] : []),
    { id: 'access', kind: 'select', label: 'Access', value: resolveJobField('access'), options: ACCESS_OPTIONS, pending: pendingFieldId === 'access', error: fieldErrors['access'], disabled: !canEdit, onCommit: (value) => commitJobValue('access', 'access', value) },
    { id: 'height', kind: 'select', label: 'Height', value: resolveJobField('height'), options: HEIGHT_OPTIONS, pending: pendingFieldId === 'height', error: fieldErrors['height'], disabled: !canEdit, onCommit: (value) => commitJobValue('height', 'height', value) },
    { id: 'job-type', kind: 'select', label: 'Job type', value: resolveJobField('jobType'), options: JOB_TYPE_OPTIONS, pending: pendingFieldId === 'job-type', error: fieldErrors['job-type'], disabled: !canEdit, onCommit: (value) => commitJobValue('job-type', 'jobType', value) },
  ];

  const structureFields: RailFieldDefinition[] = [
    { id: 'pergola-style', kind: 'select', label: 'Pergola style', value: module.pergolaStyle, options: PERGOLA_STYLE_OPTIONS, helperText: module.pergolaStyle === 'gable' || module.pergolaStyle === 'hip' || module.pergolaStyle === 'hip_corner' ? 'Check details on site-specific assumptions.' : undefined, pending: pendingFieldId === 'pergola-style', error: fieldErrors['pergola-style'], disabled: !canEdit, onCommit: (value) => commitModuleValue('pergola-style', 'pergolaStyle', value as CalculatorModuleInputs['pergolaStyle']) },
    { id: 'box-perimeter-enabled', kind: 'toggle', label: 'Box perimeter', value: Boolean(module.boxPerimeterEnabled), helperText: module.pergolaStyle === 'hip_corner' ? 'Not supported for hip corner.' : module.boxPerimeterEnabled ? 'On' : 'Off', pending: pendingFieldId === 'box-perimeter-enabled', error: fieldErrors['box-perimeter-enabled'], disabled: !canEdit || module.pergolaStyle === 'hip_corner', onCommit: (value) => commitModuleValue('box-perimeter-enabled', 'boxPerimeterEnabled', value) },
    { id: 'roof-material', kind: 'select', label: 'Roof material', value: module.roofMaterial, options: ROOF_MATERIAL_OPTIONS, pending: pendingFieldId === 'roof-material', error: fieldErrors['roof-material'], disabled: !canEdit, onCommit: (value) => commitModuleValue('roof-material', 'roofMaterial', value as CalculatorModuleInputs['roofMaterial']) },
    { id: 'extrusion-colour', kind: 'select', label: 'Extrusion colour', value: module.extrusionColour, options: EXTRUSION_COLOUR_OPTIONS, pending: pendingFieldId === 'extrusion-colour', error: fieldErrors['extrusion-colour'], disabled: !canEdit, onCommit: (value) => commitModuleValue('extrusion-colour', 'extrusionColour', value as CalculatorModuleInputs['extrusionColour']) },
    { id: 'lengthM', kind: 'number', label: module.pergolaStyle === 'hip_corner' ? 'Roof length A (m)' : 'Roof length (m)', value: resolveFieldEditorValue(editableFieldsById.get('plan:lengthA'), module.lengthM), helperText: 'Dimension parallel to the ridge / gutter.', pending: pendingFieldId === 'lengthM', error: fieldErrors['lengthM'], disabled: !canEdit, onCommit: (value) => commitModuleValue('lengthM', 'lengthM', value) },
    { id: 'projectionM', kind: 'number', label: module.pergolaStyle === 'hip_corner' ? 'Roof span A (m)' : 'Roof span (eave-to-eave) (m)', value: resolveFieldEditorValue(editableFieldsById.get('plan:spanA'), module.projectionM), helperText: 'Total width across the roof.', pending: pendingFieldId === 'projectionM', error: fieldErrors['projectionM'], disabled: !canEdit, onCommit: (value) => commitModuleValue('projectionM', 'projectionM', value) },
    { id: 'roof-pitch', kind: 'number', label: 'Roof pitch (deg)', value: resolveFieldEditorValue(editableFieldsById.get('section:pitch'), module.roofPitchDeg), helperText: module.boxPerimeterEnabled ? 'Auto-computed for box perimeter.' : 'Blank = default pitch.', pending: pendingFieldId === 'roof-pitch', error: fieldErrors['roof-pitch'], disabled: !canEdit || module.boxPerimeterEnabled, onCommit: (value) => commitModuleValue('roof-pitch', 'roofPitchDeg', value) },
  ];

  if (module.roofMaterial === 'mixed') {
    if (bayCounts.roofType === 'pitched') structureFields.splice(3, 0, { id: 'mixed-acrylic-main', kind: 'number', label: 'Acrylic bays (main)', value: module.mixedAcrylicBaysMain, helperText: `0-${bayCounts.bayCountMain}`, pending: pendingFieldId === 'mixed-acrylic-main', error: fieldErrors['mixed-acrylic-main'], disabled: !canEdit, onCommit: (value) => commitModuleValue('mixed-acrylic-main', 'mixedAcrylicBaysMain', value) });
    else structureFields.splice(3, 0,
      { id: 'mixed-acrylic-a', kind: 'number', label: bayCounts.roofType === 'hip_corner' ? 'Acrylic bays (leg A)' : 'Acrylic bays (side A)', value: module.mixedAcrylicBaysA, helperText: `0-${bayCounts.bayCountA}`, pending: pendingFieldId === 'mixed-acrylic-a', error: fieldErrors['mixed-acrylic-a'], disabled: !canEdit, onCommit: (value) => commitModuleValue('mixed-acrylic-a', 'mixedAcrylicBaysA', value) },
      { id: 'mixed-acrylic-b', kind: 'number', label: bayCounts.roofType === 'hip_corner' ? 'Acrylic bays (leg B)' : 'Acrylic bays (side B)', value: module.mixedAcrylicBaysB, helperText: `0-${bayCounts.bayCountB}`, pending: pendingFieldId === 'mixed-acrylic-b', error: fieldErrors['mixed-acrylic-b'], disabled: !canEdit, onCommit: (value) => commitModuleValue('mixed-acrylic-b', 'mixedAcrylicBaysB', value) },
    );
  }

  if (module.roofMaterial === 'timber' || module.roofMaterial === 'mixed') {
    structureFields.splice(3, 0, { id: 'timber-roof-above-type', kind: 'select', label: 'Roof above type', value: module.timberRoofAboveType, options: TIMBER_ROOF_ABOVE_OPTIONS, pending: pendingFieldId === 'timber-roof-above-type', error: fieldErrors['timber-roof-above-type'], disabled: !canEdit, onCommit: (value) => commitModuleValue('timber-roof-above-type', 'timberRoofAboveType', value as CalculatorModuleInputs['timberRoofAboveType']) });
    if (module.timberRoofAboveType === 'steel_tray') structureFields.splice(4, 0, { id: 'timber-tray-width', kind: 'select', label: 'Steel tray width (mm)', value: module.timberTrayWidthMm, options: TIMBER_TRAY_WIDTH_OPTIONS, pending: pendingFieldId === 'timber-tray-width', error: fieldErrors['timber-tray-width'], disabled: !canEdit, onCommit: (value) => commitModuleValue('timber-tray-width', 'timberTrayWidthMm', value) });
  }

  if (module.extrusionColour === 'Mill') {
    structureFields.splice(4, 0,
      { id: 'powdercoat-standard-colour', kind: 'select', label: 'Powdercoat colour', value: module.powdercoatStandardColour ?? '', options: POWDERCOAT_STANDARD_COLOUR_OPTIONS, pending: pendingFieldId === 'powdercoat-standard-colour', error: fieldErrors['powdercoat-standard-colour'], disabled: !canEdit || Boolean(module.powdercoatIsCustom), onCommit: (value) => commitModuleValue('powdercoat-standard-colour', 'powdercoatStandardColour', value) },
      { id: 'powdercoat-is-custom', kind: 'toggle', label: 'Custom powdercoat colour', value: Boolean(module.powdercoatIsCustom), pending: pendingFieldId === 'powdercoat-is-custom', error: fieldErrors['powdercoat-is-custom'], disabled: !canEdit, onCommit: (value) => commitModuleValue('powdercoat-is-custom', 'powdercoatIsCustom', value) },
    );
    if (module.powdercoatIsCustom) structureFields.splice(6, 0, { id: 'powdercoat-custom-colour', kind: 'text', label: 'Custom powdercoat colour name', value: module.powdercoatCustomColour ?? '', pending: pendingFieldId === 'powdercoat-custom-colour', error: fieldErrors['powdercoat-custom-colour'], disabled: !canEdit, onCommit: (value) => commitModuleValue('powdercoat-custom-colour', 'powdercoatCustomColour', value) });
  }

  if (module.pergolaStyle === 'hip_corner') structureFields.push(
    { id: 'hip-corner-length-b', kind: 'number', label: 'Roof length B (m)', value: module.hipCornerLengthBM, pending: pendingFieldId === 'hip-corner-length-b', error: fieldErrors['hip-corner-length-b'], disabled: !canEdit, onCommit: (value) => commitModuleValue('hip-corner-length-b', 'hipCornerLengthBM', value) },
    { id: 'hip-corner-span-b', kind: 'number', label: 'Roof span B (m)', value: module.hipCornerProjectionBM, pending: pendingFieldId === 'hip-corner-span-b', error: fieldErrors['hip-corner-span-b'], disabled: !canEdit, onCommit: (value) => commitModuleValue('hip-corner-span-b', 'hipCornerProjectionBM', value) },
  );

  if (module.pergolaStyle === 'gable') structureFields.push(
    { id: 'gable-end-frames', kind: 'select', label: 'Gable end frames', value: module.gableEndFramesMode, options: GABLE_END_FRAME_OPTIONS, helperText: 'Adds tie beam + king-post strut at selected gable end(s).', pending: pendingFieldId === 'gable-end-frames', error: fieldErrors['gable-end-frames'], disabled: !canEdit, onCommit: (value) => commitModuleValue('gable-end-frames', 'gableEndFramesMode', value as CalculatorModuleInputs['gableEndFramesMode']) },
    { id: 'gable-house-edge-gutter', kind: 'select', label: 'House-side eave gutter', value: module.gableHouseEdgeGutter, options: gableGutterOptions, pending: pendingFieldId === 'gable-house-edge-gutter', error: fieldErrors['gable-house-edge-gutter'], disabled: !canEdit, onCommit: (value) => commitModuleValue('gable-house-edge-gutter', 'gableHouseEdgeGutter', value as CalculatorModuleInputs['gableHouseEdgeGutter']) },
    { id: 'gable-outer-edge-gutter', kind: 'select', label: 'Outer-side eave gutter', value: module.gableOuterEdgeGutter, options: gableGutterOptions, pending: pendingFieldId === 'gable-outer-edge-gutter', error: fieldErrors['gable-outer-edge-gutter'], disabled: !canEdit, onCommit: (value) => commitModuleValue('gable-outer-edge-gutter', 'gableOuterEdgeGutter', value as CalculatorModuleInputs['gableOuterEdgeGutter']) },
  );

  if (module.pergolaStyle === 'pitched' && !module.boxPerimeterEnabled) {
    structureFields.push({ id: 'inverted-enabled', kind: 'toggle', label: 'Inverted (toward house)', value: Boolean(module.invertedEnabled), helperText: 'Flip slope so fall runs toward the house.', pending: pendingFieldId === 'inverted-enabled', error: fieldErrors['inverted-enabled'], disabled: !canEdit, onCommit: (value) => commitModuleValue('inverted-enabled', 'invertedEnabled', value) });
    if (module.invertedEnabled) structureFields.push({ id: 'inverted-house-gutter', kind: 'toggle', label: 'Use house gutter?', value: Boolean(module.invertedHouseGutter), helperText: module.invertedHouseGutter ? 'No gutter supplied by us.' : 'Use SP gutter at the house edge.', pending: pendingFieldId === 'inverted-house-gutter', error: fieldErrors['inverted-house-gutter'], disabled: !canEdit, onCommit: (value) => commitModuleValue('inverted-house-gutter', 'invertedHouseGutter', value) });
  }

  if (!module.boxPerimeterEnabled) {
    structureFields.push({ id: 'overhang-enabled', kind: 'toggle', label: 'Overhang', value: Boolean(module.overhangEnabled), helperText: 'Add overhang support beam + end stringer.', pending: pendingFieldId === 'overhang-enabled', error: fieldErrors['overhang-enabled'], disabled: !canEdit, onCommit: (value) => commitModuleValue('overhang-enabled', 'overhangEnabled', value) });
    if (module.overhangEnabled) structureFields.push(
      { id: 'overhang-amount', kind: 'number', label: 'Overhang amount (m)', value: module.overhangAmountM, helperText: 'Within the roof footprint. It moves the post beam inboard.', pending: pendingFieldId === 'overhang-amount', error: fieldErrors['overhang-amount'], disabled: !canEdit, onCommit: (value) => commitModuleValue('overhang-amount', 'overhangAmountM', value) },
      { id: 'overhang-support-beam-profile', kind: 'select', label: 'Overhang support beam profile', value: module.overhangSupportBeamProfile, options: OVERHANG_SUPPORT_BEAM_OPTIONS, pending: pendingFieldId === 'overhang-support-beam-profile', error: fieldErrors['overhang-support-beam-profile'], disabled: !canEdit, onCommit: (value) => commitModuleValue('overhang-support-beam-profile', 'overhangSupportBeamProfile', value as CalculatorModuleInputs['overhangSupportBeamProfile']) },
    );
  }

  if (module.boxPerimeterEnabled) structureFields.push(
    { id: 'box-gutter-house-edge', kind: 'select', label: 'House edge gutter', value: module.boxGutterHouseEdge, options: BOX_GUTTER_OPTIONS, pending: pendingFieldId === 'box-gutter-house-edge', error: fieldErrors['box-gutter-house-edge'], disabled: !canEdit, onCommit: (value) => commitModuleValue('box-gutter-house-edge', 'boxGutterHouseEdge', value as CalculatorModuleInputs['boxGutterHouseEdge']) },
    { id: 'box-gutter-far-edge', kind: 'select', label: 'Far edge gutter', value: module.boxGutterFarEdge, options: BOX_GUTTER_OPTIONS, pending: pendingFieldId === 'box-gutter-far-edge', error: fieldErrors['box-gutter-far-edge'], disabled: !canEdit, onCommit: (value) => commitModuleValue('box-gutter-far-edge', 'boxGutterFarEdge', value as CalculatorModuleInputs['boxGutterFarEdge']) },
  );

  structureFields.push(
    { id: 'downpipe-count', kind: 'number', label: 'Downpipes (count)', value: module.downpipeCount, helperText: module.boxPerimeterEnabled ? 'Default 1 when any "our" gutter edge is set.' : 'Default 1 when any "our" gutter is used.', pending: pendingFieldId === 'downpipe-count', error: fieldErrors['downpipe-count'], disabled: !canEdit, onCommit: (value) => commitModuleValue('downpipe-count', 'downpipeCount', value) },
    { id: 'downpipe-joins', kind: 'select', label: 'DP joins', value: module.downpipeJoinCount, options: DP_JOIN_OPTIONS, pending: pendingFieldId === 'downpipe-joins', error: fieldErrors['downpipe-joins'], disabled: !canEdit, onCommit: (value) => commitModuleValue('downpipe-joins', 'downpipeJoinCount', value) },
  );
  if (hasOurGutter) structureFields.push({ id: 'downpipe-elbows', kind: 'select', label: 'DP elbows', value: module.downpipeElbowCount, options: DP_ELBOW_OPTIONS, helperText: 'Only applicable when our gutter is used.', pending: pendingFieldId === 'downpipe-elbows', error: fieldErrors['downpipe-elbows'], disabled: !canEdit, onCommit: (value) => commitModuleValue('downpipe-elbows', 'downpipeElbowCount', value) });
  if (showSeparateGutterToggle) structureFields.push({ id: 'separate-gutter-enabled', kind: 'toggle', label: 'Separate gutter (100x100 cut)', value: Boolean(module.separateGutterEnabled), helperText: 'Adds separate 100x100 cut-down gutter.', pending: pendingFieldId === 'separate-gutter-enabled', error: fieldErrors['separate-gutter-enabled'], disabled: !canEdit, onCommit: (value) => commitModuleValue('separate-gutter-enabled', 'separateGutterEnabled', value) });
  structureFields.push(
    { id: 'post-cut-height', kind: 'number', label: 'Ledger underside height (m)', value: module.postCutHeightM, helperText: 'Clear height to underside of ledger.', pending: pendingFieldId === 'post-cut-height', error: fieldErrors['post-cut-height'], disabled: !canEdit, onCommit: (value) => commitModuleValue('post-cut-height', 'postCutHeightM', value) },
    { id: 'post-count', kind: 'number', label: 'Post count', value: module.postCount, pending: pendingFieldId === 'post-count', error: fieldErrors['post-count'], disabled: !canEdit, onCommit: (value) => commitModuleValue('post-count', 'postCount', value) },
  );

  const overrideFields: RailFieldDefinition[] = [
    { id: 'ledger-profile-override', kind: 'select', label: 'Ledger override', value: module.overrides?.ledgerProfile ?? '', options: withCurrentOption(LEDGER_PROFILE_OPTIONS, module.overrides?.ledgerProfile, 'Current override'), pending: pendingFieldId === 'ledger-profile-override', error: fieldErrors['ledger-profile-override'], disabled: !canEdit, onCommit: (value) => commitOverrideValue('ledger-profile-override', 'ledgerProfile', value) },
    { id: 'rafter-profile-override', kind: 'select', label: 'Rafter override', value: module.overrides?.rafterProfile ?? '', options: withCurrentOption(RAFTER_PROFILE_OPTIONS, module.overrides?.rafterProfile, 'Current override'), pending: pendingFieldId === 'rafter-profile-override', error: fieldErrors['rafter-profile-override'], disabled: !canEdit, onCommit: (value) => commitOverrideValue('rafter-profile-override', 'rafterProfile', value) },
    { id: 'post-profile-override', kind: 'select', label: 'Post override', value: module.overrides?.postProfile ?? '', options: withCurrentOption(POST_PROFILE_OPTIONS, module.overrides?.postProfile, 'Current override'), pending: pendingFieldId === 'post-profile-override', error: fieldErrors['post-profile-override'], disabled: !canEdit, onCommit: (value) => commitOverrideValue('post-profile-override', 'postProfile', value) },
    { id: 'front-beam-profile-override', kind: 'select', label: 'Front beam override', value: module.overrides?.frontBeamProfile ?? '', options: withCurrentOption(FRONT_BEAM_PROFILE_OPTIONS, module.overrides?.frontBeamProfile, 'Current override'), pending: pendingFieldId === 'front-beam-profile-override', error: fieldErrors['front-beam-profile-override'], disabled: !canEdit, onCommit: (value) => commitOverrideValue('front-beam-profile-override', 'frontBeamProfile', value) },
    { id: 'ridge-beam-profile-override', kind: 'select', label: 'Ridge beam override', value: module.overrides?.ridgeBeamProfile ?? '', options: withCurrentOption(RIDGE_BEAM_PROFILE_OPTIONS, module.overrides?.ridgeBeamProfile, 'Current override'), pending: pendingFieldId === 'ridge-beam-profile-override', error: fieldErrors['ridge-beam-profile-override'], disabled: !canEdit, onCommit: (value) => commitOverrideValue('ridge-beam-profile-override', 'ridgeBeamProfile', value) },
  ];
  if (module.boxPerimeterEnabled) overrideFields.push({ id: 'box-beam-profile-override', kind: 'select', label: 'Box perimeter beam override', value: module.overrides?.boxPerimeterBeamProfile ?? '', options: withCurrentOption(BOX_BEAM_PROFILE_OPTIONS, module.overrides?.boxPerimeterBeamProfile, 'Current override'), pending: pendingFieldId === 'box-beam-profile-override', error: fieldErrors['box-beam-profile-override'], disabled: !canEdit, onCommit: (value) => commitOverrideValue('box-beam-profile-override', 'boxPerimeterBeamProfile', value) });
  if (module.pergolaStyle === 'gable') overrideFields.push(
    { id: 'tie-beam-profile-override', kind: 'select', label: 'Tie beam override', value: module.overrides?.tieBeamProfile ?? '', options: withCurrentOption(FRONT_BEAM_PROFILE_OPTIONS, module.overrides?.tieBeamProfile, 'Current override'), pending: pendingFieldId === 'tie-beam-profile-override', error: fieldErrors['tie-beam-profile-override'], disabled: !canEdit, onCommit: (value) => commitOverrideValue('tie-beam-profile-override', 'tieBeamProfile', value) },
    { id: 'strut-profile-override', kind: 'select', label: 'King-post strut override', value: module.overrides?.strutProfile ?? '', options: withCurrentOption(STRUT_PROFILE_OPTIONS, module.overrides?.strutProfile, 'Current override'), pending: pendingFieldId === 'strut-profile-override', error: fieldErrors['strut-profile-override'], disabled: !canEdit, onCommit: (value) => commitOverrideValue('strut-profile-override', 'strutProfile', value) },
  );

  const allowanceFields: RailFieldDefinition[] = [
    { id: 'travel-ex-gst', kind: 'number', label: 'Travel (ex-GST)', value: resolveJobField('travelExGst'), pending: pendingFieldId === 'travel-ex-gst', error: fieldErrors['travel-ex-gst'], disabled: !canEdit, onCommit: (value) => commitJobValue('travel-ex-gst', 'travelExGst', value) },
    { id: 'extras-allowance', kind: 'number', label: 'Extras allowance (ex-GST)', value: resolveJobField('extrasAllowanceExGst'), pending: pendingFieldId === 'extras-allowance', error: fieldErrors['extras-allowance'], disabled: !canEdit, onCommit: (value) => commitJobValue('extras-allowance', 'extrasAllowanceExGst', value) },
    { id: 'quote-discount-pct', kind: 'number', label: 'Discount (%)', value: resolveJobField('quoteDiscountPct'), helperText: 'Quote-only (not in true cost).', pending: pendingFieldId === 'quote-discount-pct', error: fieldErrors['quote-discount-pct'], disabled: !canEdit, onCommit: (value) => commitJobValue('quote-discount-pct', 'quoteDiscountPct', value) },
  ];

  const footprintBody = showPlanContextControls ? <div className={styles.fieldStack}>
    {renderField({ id: 'attachment-side', kind: 'select', label: 'Attachment side', value: module.attachmentSide ?? 'rear', options: ATTACHMENT_SIDE_OPTIONS, pending: pendingFieldId === 'attachment-side', error: fieldErrors['attachment-side'], disabled: !showPlanContextControls, onCommit: (value) => commitFootprintEdit('attachment-side', { type: 'attachment_side', side: value as CalculatorModuleInputs['attachmentSide'] }) })}
    {renderField({ id: 'house-footprint-preset', kind: 'select', label: 'House footprint', value: footprintPreset, options: HOUSE_FOOTPRINT_PRESET_OPTIONS.map((option) => ({ label: option.label, value: option.id ?? 'straight' })), pending: pendingFieldId === 'house-footprint-preset', error: fieldErrors['house-footprint-preset'], disabled: !showPlanContextControls, onCommit: (value) => commitFootprintEdit('house-footprint-preset', { type: 'preset', preset: value as CalculatorModuleInputs['houseFootprintPreset'] }) })}
    {renderField({ id: 'drawing-rotation', kind: 'select', label: 'Drawing rotation', value: String(rotationQuarterTurns), options: [{ label: '0 deg', value: '0' }, { label: '90 deg', value: '1' }, { label: '180 deg', value: '2' }, { label: '270 deg', value: '3' }], pending: pendingFieldId === 'drawing-rotation', error: fieldErrors['drawing-rotation'], disabled: !showPlanContextControls, onCommit: async (value) => { const target = Number.parseInt(value, 10); let current = rotationQuarterTurns; while (current !== target) { const forward = (target - current + 4) % 4; const delta: -1 | 1 = forward <= 2 ? 1 : -1; const result = await commitFootprintEdit('drawing-rotation', { type: 'rotate', delta }); if (!result.ok) return result; current = ((current + delta + 4) % 4) as 0 | 1 | 2 | 3; } return { ok: true }; } })}
    {renderField({ id: 'house-footprint-band-depth', kind: 'number', label: 'Footprint band depth (m)', value: footprintParams.bandDepthM, pending: pendingFieldId === 'house-footprint-band-depth', error: fieldErrors['house-footprint-band-depth'], disabled: !showPlanContextControls, onCommit: (value) => commitFootprintEdit('house-footprint-band-depth', { type: 'param', key: 'bandDepthM', value }) })}
    {(footprintPreset === 'l_left' || footprintPreset === 'l_right') ? renderField({ id: 'house-footprint-return-run', kind: 'number', label: 'Return run (m)', value: footprintParams.returnRunM, pending: pendingFieldId === 'house-footprint-return-run', error: fieldErrors['house-footprint-return-run'], disabled: !showPlanContextControls, onCommit: (value) => commitFootprintEdit('house-footprint-return-run', { type: 'param', key: 'returnRunM', value }) }) : null}
    {(footprintPreset === 'recess_left' || footprintPreset === 'recess_right') ? <>{renderField({ id: 'house-footprint-recess-width', kind: 'number', label: 'Recess width (m)', value: footprintParams.recessWidthM, pending: pendingFieldId === 'house-footprint-recess-width', error: fieldErrors['house-footprint-recess-width'], disabled: !showPlanContextControls, onCommit: (value) => commitFootprintEdit('house-footprint-recess-width', { type: 'param', key: 'recessWidthM', value }) })}{renderField({ id: 'house-footprint-recess-depth', kind: 'number', label: 'Recess depth (m)', value: footprintParams.recessDepthM, pending: pendingFieldId === 'house-footprint-recess-depth', error: fieldErrors['house-footprint-recess-depth'], disabled: !showPlanContextControls, onCommit: (value) => commitFootprintEdit('house-footprint-recess-depth', { type: 'param', key: 'recessDepthM', value }) })}</> : null}
    {footprintPreset === 'u_shape' ? <>{renderField({ id: 'house-footprint-left-leg', kind: 'number', label: 'Left leg run (m)', value: footprintParams.leftLegRunM, pending: pendingFieldId === 'house-footprint-left-leg', error: fieldErrors['house-footprint-left-leg'], disabled: !showPlanContextControls, onCommit: (value) => commitFootprintEdit('house-footprint-left-leg', { type: 'param', key: 'leftLegRunM', value }) })}{renderField({ id: 'house-footprint-right-leg', kind: 'number', label: 'Right leg run (m)', value: footprintParams.rightLegRunM, pending: pendingFieldId === 'house-footprint-right-leg', error: fieldErrors['house-footprint-right-leg'], disabled: !showPlanContextControls, onCommit: (value) => commitFootprintEdit('house-footprint-right-leg', { type: 'param', key: 'rightLegRunM', value }) })}</> : null}
    {(footprintPreset === 'wrap_left' || footprintPreset === 'wrap_right') ? renderField({ id: 'house-footprint-side-run', kind: 'number', label: 'Side run (m)', value: footprintParams.sideRunM, pending: pendingFieldId === 'house-footprint-side-run', error: fieldErrors['house-footprint-side-run'], disabled: !showPlanContextControls, onCommit: (value) => commitFootprintEdit('house-footprint-side-run', { type: 'param', key: 'sideRunM', value }) }) : null}
  </div> : <p className={styles.empty}>{view === 'section' ? 'House footprint controls are plan-only. The chosen house connection still feeds section output.' : footprintSectionAvailable ? 'House footprint controls are available in plan view.' : 'House footprint controls appear when the module is attached to the house and the style supports footprints.'}</p>;

  const sections: RailSection[] = [
    { id: 'connections-site', title: 'Connections & Site', defaultOpen: true, body: <div className={styles.fieldStack}>{connectionFields.map(renderField)}</div> },
    { id: 'structure', title: 'Structure', defaultOpen: true, body: <div className={styles.fieldStack}>{structureFields.map(renderField)}</div> },
    { id: 'flashings', title: 'Flashings', defaultOpen: false, body: <FlashingsSection canEdit={canEdit} fieldErrors={fieldErrors} flashingsState={flashingsState} flashingTotalsPreview={flashingTotalsPreview} flashingVisibleBands={flashingVisibleBands} module={module} pending={pendingFieldId === 'flashings'} showAllFlashingBands={showAllFlashingBands} setShowAllFlashingBands={setShowAllFlashingBands} updateFlashings={updateFlashings} /> },
    { id: 'overrides', title: 'Overrides', defaultOpen: false, body: <div className={styles.fieldStack}>{overrideFields.map(renderField)}</div> },
    { id: 'allowances', title: 'Allowances', defaultOpen: false, body: <div className={styles.fieldStack}>{allowanceFields.map(renderField)}</div> },
    { id: 'house-footprint', title: 'House Footprint', defaultOpen: false, body: footprintBody },
  ];

  if (mode === 'compact') {
    return <div className={`${styles.rail} ${styles.railCompact}`} aria-label={`Configurator summary for ${moduleLabel}`}><div className={`${styles.summary} ${styles.summaryCompact}`}><p className={styles.eyebrow}>Sheet Preview</p><p className={styles.summaryText}>This rail stays in summary mode while you review the generated sheet.</p></div><SummarySection title="Geometry" items={geometrySummaryItems} /><SummarySection title="Structure" items={structureSummaryItems} /><SummarySection title="House Footprint" items={module.houseConnectionType !== 'none' ? [{ label: 'Attachment side', value: labelForOption(ATTACHMENT_SIDE_OPTIONS, module.attachmentSide ?? 'rear') }, { label: 'House footprint', value: labelForOption(HOUSE_FOOTPRINT_PRESET_OPTIONS.map((option) => ({ label: option.label, value: option.id ?? 'straight' })), footprintPreset) }] : []} hint={view === 'section' ? 'Plan-only house footprint controls are available in plan view and model space.' : undefined} /><section className={styles.section}><h4 className={styles.sectionTitle}>Actions</h4><div className={styles.actionStack}>{onSwitchToModelSpace ? <button type="button" className={styles.buttonPrimary} onClick={onSwitchToModelSpace}>Switch to model space</button> : null}<button type="button" className={styles.secondaryButton} disabled={!onOpenFullCalculator} onClick={onOpenFullCalculator}>Open full calculator</button></div></section></div>;
  }

  return <div className={`${styles.rail} ${styles.railFull}`} aria-label={`Configurator rail for ${moduleLabel}`}><div className={styles.summary}><p className={styles.eyebrow}>Model Configurator</p><p className={styles.summaryText}>Calculator-aligned controls for the live draft. Blinds and infills remain in the full calculator for now.</p></div>{sections.map((section) => { const isOpen = sectionOpenState[section.id] ?? section.defaultOpen; return <section key={section.id} className={styles.section}><button type="button" className={styles.sectionToggle} aria-expanded={isOpen} onClick={() => setSectionOpenState((current) => ({ ...current, [section.id]: !(current[section.id] ?? section.defaultOpen) }))}><span className={styles.sectionTitle}>{section.title}</span><span className={styles.sectionToggleIcon}>{isOpen ? '−' : '+'}</span></button>{isOpen ? <div className={styles.sectionBody}>{section.body}</div> : null}</section>; })}<section className={styles.section}><h4 className={styles.sectionTitle}>Actions</h4><div className={styles.actionStack}><button type="button" className={styles.secondaryButton} disabled={!onOpenFullCalculator} onClick={onOpenFullCalculator}>Open full calculator</button></div></section></div>;
}

function FlashingsSection({ canEdit, fieldErrors, flashingsState, flashingTotalsPreview, flashingVisibleBands, module, pending, showAllFlashingBands, setShowAllFlashingBands, updateFlashings }: { canEdit: boolean; fieldErrors: Record<string, string>; flashingsState: CalculatorFlashingsState; flashingTotalsPreview: Record<CalculatorFlashingBand, number>; flashingVisibleBands: CalculatorFlashingBand[]; module: CalculatorModuleInputs; pending: boolean; showAllFlashingBands: boolean; setShowAllFlashingBands: React.Dispatch<React.SetStateAction<boolean>>; updateFlashings: (fieldId: string, updater: (current: CalculatorFlashingsState) => CalculatorFlashingsState) => Promise<CommitResult>; }) {
  return <div className={styles.flashingsSection}><p className={styles.fieldHint}>Defaults auto-apply by roof type; override each row or add extras.</p><div className={styles.flashingsTable}><div className={styles.flashingsGridHeader}><div>Item</div><div>Girth (mm)</div><div>Length (m)</div><div>Purpose</div><div>Remove</div></div>{flashingsState.rows.map((row, rowIndex) => { const isPrimary = row.kind === 'primary'; const parsedLength = toNumber(row.lengthM); const invalidLength = !Number.isFinite(parsedLength) || parsedLength < 0; const duplicatePrimary = !isPrimary && Number.isFinite(parsedLength) && parsedLength > 0 && isPrimaryFlashingLengthAutoLinked(row.lengthM, module) && row.band === flashingsState.rows[0]?.band; return <div key={row.id} className={isPrimary ? styles.flashingsRowPrimary : styles.flashingsRow}><div className={styles.flashingsCellItem}><div className={styles.flashingsItemBadge}>{isPrimary ? 'Primary' : `Extra ${rowIndex}`}</div>{isPrimary ? <div className={styles.flashingsItemMeta}>Default from roof type; editable.</div> : null}{invalidLength ? <div className={styles.flashingsWarning}>Enter a length of 0 or more.</div> : null}{duplicatePrimary ? <div className={styles.flashingsWarning}>May double-count primary flashing.</div> : null}</div><select className={styles.select} value={row.band} disabled={!canEdit || pending} onChange={(event) => void updateFlashings('flashings', (current) => ({ rows: current.rows.map((item) => item.id === row.id ? { ...item, band: event.target.value as CalculatorFlashingBand } : item) }))}>{FLASHING_BAND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><div className={styles.flashingsLengthCell}><input className={styles.input} inputMode="decimal" value={row.lengthM} disabled={!canEdit || pending} onChange={(event) => void updateFlashings('flashings', (current) => ({ rows: current.rows.map((item) => item.id === row.id ? { ...item, lengthM: event.target.value } : item) }))} /><span className={styles.flashingsLengthSuffix}>m</span></div><select className={styles.select} value={row.purpose} disabled={!canEdit || pending} onChange={(event) => void updateFlashings('flashings', (current) => ({ rows: current.rows.map((item) => item.id === row.id ? { ...item, purpose: event.target.value as CalculatorFlashingPurpose } : item) }))}>{FLASHING_PURPOSE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{isPrimary ? <div className={styles.flashingsRemovePlaceholder} /> : <button type="button" className={styles.flashingsRemoveButton} disabled={!canEdit || pending} onClick={() => void updateFlashings('flashings', (current) => ({ rows: current.rows.filter((item) => item.id !== row.id) }))}>×</button>}</div>; })}</div>{fieldErrors.flashings ? <p className={styles.fieldError}>{fieldErrors.flashings}</p> : null}<button type="button" className={styles.secondaryButton} disabled={!canEdit || pending} onClick={() => void updateFlashings('flashings', (current) => ({ rows: [...current.rows, { id: makeFlashingId(), kind: 'extra', band: current.rows[0]?.band ?? '201-300', lengthM: formatFlashingLengthInput(roofLengthForPrimaryFlashing(module)), purpose: 'CUSTOM' }] }))}>Add flashing row</button><div className={styles.flashingsTotalsCard}><div className={styles.flashingsTotalsTitle}>Totals</div><div className={styles.flashingsTotalsRow}><span>Total</span><span>{`${formatMaybeNumber(FLASHING_BANDS.reduce((sum, band) => sum + flashingTotalsPreview[band], 0), 1)} m`}</span></div>{flashingVisibleBands.map((band) => <div key={band} className={styles.flashingsTotalsRow}><span>{band}</span><span>{`${formatMaybeNumber(flashingTotalsPreview[band], 1)} m`}</span></div>)}<button type="button" className={styles.flashingsTotalsToggle} onClick={() => setShowAllFlashingBands((current) => !current)}>{showAllFlashingBands ? 'Show non-zero bands only' : 'Show all bands'}</button></div></div>;
}
