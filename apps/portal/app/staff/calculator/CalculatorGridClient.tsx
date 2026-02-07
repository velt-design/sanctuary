'use client';

import type { CostInputsV1, JobInputsV1, JobOutputV1, RoofType } from '@sp/costing';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import FieldTile, { type FieldOption, type FieldTileType } from './FieldTile';
import styles from './CalculatorGrid.module.css';
import type {
  BlindFabric as BlindFabricInput,
  BlindLineItem,
  BlindSystemType as BlindSystemInput,
  CalculatorBlindsState,
  CalculatorInputs,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import { normalizeBlindsState } from '@/lib/types/calculator';
import type { Project } from '@/lib/types/project';
import { getContact } from '@/lib/repo/contactsRepo';
import { addProjectActivity, getProject } from '@/lib/repo/projectsRepo';
import { createEstimate, duplicateEstimateToDraft } from '@/lib/repo/estimatesRepo';
import { getCostingMeta } from '@/lib/costing/costEngine';
import { useToast } from '@/components/ui/toast/ToastProvider';
import Modal from '@/components/ui/modal/Modal';
import { useSession } from 'next-auth/react';
import { useCalculatorUiPrefs } from '@/lib/ui/useCalculatorUiPrefs';
import RoofOrientationDiagram from './RoofOrientationDiagram';
import {
  priceAllBlinds,
  type BlindLineItemInput,
  type BlindPricingResult,
} from '@/lib/costing/blinds';
import { buildAddonsTotals, computeDisplayTotals } from './calcTotals';

type FieldSchemaItem = {
  id: string;
  label: string;
  type: FieldTileType;
  value?: string | boolean;
  content?: ReactNode;
  onChange?: (next: string | boolean) => void;
  options?: FieldOption[];
  disabled?: boolean;
  helperText?: string;
  error?: string;
  onAction?: () => void;
  actionLabel?: string;
};

function toNumber(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

function formatCents(cents?: number): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatMaybeMoney(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return formatMoney(n);
}

function formatMaybeNumber(n: number | undefined, digits = 2): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function inferStockLengthFromLabel(label: string): number | null {
  const match = String(label ?? '').match(/(\d+(?:\.\d+)?)m\b/i);
  if (!match) return null;
  const n = Number.parseFloat(match[1] ?? '');
  return Number.isFinite(n) ? n : null;
}

const RAFTER_SPACING_MM_MAX = 642;
const DEFAULT_MIXED_ACRYLIC_BAYS = 2;

function toNonNegativeInt(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : NaN;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function hasNonEmptyValue(value: string | undefined): value is string {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function defaultMixedAcrylicBays(bayCount: number): string {
  return String(clampInt(DEFAULT_MIXED_ACRYLIC_BAYS, 0, bayCount));
}

function computeHasOurGutter(module: CalculatorModuleInputs): boolean {
  if (module.invertedEnabled && module.invertedHouseGutter) return false;
  if (module.boxPerimeterEnabled) {
    return module.boxGutterHouseEdge === 'our' || module.boxGutterFarEdge === 'our';
  }
  if (module.overhangEnabled) return true;
  if (module.separateGutterEnabled) return true;
  if (module.invertedEnabled && !module.invertedHouseGutter) return true;
  const frontBeamOverride = normalizeOverrideValue(module.overrides?.frontBeamProfile);
  const frontBeamProfileUsed = frontBeamOverride ?? 'SP Gutter';
  return isGutterBeamProfile(frontBeamProfileUsed);
}

function labelForIssueField(id: string): string {
  switch (id) {
    case 'powdercoatStandardColour':
      return 'Powdercoat colour';
    case 'powdercoatCustomColour':
      return 'Custom powdercoat colour';
    case 'lengthM':
      return 'Roof Length (m)';
    case 'projectionM':
      return 'Roof Span (Eave‑to‑Eave) (m)';
    case 'hipCornerLengthBM':
      return 'Roof Length B (m)';
    case 'hipCornerProjectionBM':
      return 'Roof Span B (m)';
    case 'postCutHeightM':
      return 'Ledger underside height (m)';
    case 'roofPitchDeg':
      return 'Roof pitch (deg)';
    case 'downpipeCount':
      return 'Downpipes (count)';
    case 'downpipeJoinCount':
      return 'DP joins';
    case 'downpipeElbowCount':
      return 'DP elbows';
    case 'overhangEnabled':
      return 'Overhang';
    case 'overhangAmountM':
      return 'Overhang amount (m)';
    case 'overhangSupportBeamProfile':
      return 'Overhang support beam profile';
    case 'invertedEnabled':
      return 'Inverted roof';
    case 'invertedHouseGutter':
      return 'Inverted house gutter';
    case 'gableEndFramesMode':
      return 'Gable end frames';
    case 'postCount':
      return 'Post count';
    case 'fallDistanceMm':
      return 'Fall distance (mm)';
    case 'mixedAcrylicBaysMain':
      return 'Acrylic bays';
    case 'mixedAcrylicBaysA':
      return 'Acrylic bays (A)';
    case 'mixedAcrylicBaysB':
      return 'Acrylic bays (B)';
    case 'timberRoofAboveType':
      return 'Timber roof above';
    case 'timberInsulatedPanelThicknessMm':
      return 'Insulated panel thickness (mm)';
    case 'timberTrayWidthMm':
      return 'Steel tray width (mm)';
    default:
      return id;
  }
}

function normalizeOverrideValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isGutterBeamProfile(profile: string | undefined): boolean {
  if (!profile) return false;
  const normalized = profile.toLowerCase().replace(/\s+/g, '');
  return normalized.includes('spgutter');
}

const DEFAULT_OVERRIDE_OPTION: FieldOption = { label: 'Default (auto)', value: '' };
const RAFTER_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '80x50', value: '80x50' },
  { label: '100x50', value: '100x50' },
  { label: '150x50', value: '150x50' },
  { label: '200x50', value: '200x50' },
];
const LEDGER_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '80x50', value: '80x50' },
  { label: '100x50', value: '100x50' },
  { label: '150x50', value: '150x50' },
  { label: '200x50', value: '200x50' },
];
const POST_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '100x100', value: '100x100' },
  { label: '150x150', value: '150x150' },
];
const FRONT_BEAM_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: 'SP Gutter', value: 'SP Gutter' },
  { label: '100x50', value: '100x50' },
  { label: '150x50', value: '150x50' },
  { label: '200x50', value: '200x50' },
  { label: '300x50', value: '300x50' },
];
const RIDGE_BEAM_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '100x50', value: '100x50' },
  { label: '150x50', value: '150x50' },
  { label: '200x50', value: '200x50' },
];
const BOX_BEAM_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '300x50', value: '300x50' },
  { label: '200x50', value: '200x50' },
];
const STRUT_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '50x50', value: '50x50' },
  { label: '80x50', value: '80x50' },
  { label: '100x50', value: '100x50' },
  { label: '150x50', value: '150x50' },
  { label: '200x50', value: '200x50' },
];
const DP_JOIN_OPTIONS: FieldOption[] = Array.from({ length: 11 }, (_, i) => ({ label: String(i), value: String(i) }));
const DP_ELBOW_OPTIONS: FieldOption[] = Array.from({ length: 21 }, (_, i) => ({ label: String(i), value: String(i) }));
const GABLE_END_FRAME_OPTIONS: FieldOption[] = [
  { label: 'None', value: 'none' },
  { label: 'Outer end only', value: 'outer_end_only' },
  { label: 'Both ends', value: 'both_ends' },
];
const POWDERCOAT_STANDARD_COLOURS = [
  'Ironsands',
  'Charcoal',
  'Grey Friars',
  'Flaxpod',
  'Rangoon Green',
  'Gull Grey',
  'Titania',
];

function getRoofTypeForModule(module: CalculatorModuleInputs): RoofType {
  if (module.pergolaStyle === 'gable') return 'gable';
  if (module.pergolaStyle === 'hip') return 'hip';
  if (module.pergolaStyle === 'hip_corner') return 'hip_corner';
  return 'pitched';
}

function computeBayCountsForModule(
  module: CalculatorModuleInputs,
): { roofType: RoofType; bayCountMain: number; bayCountA: number; bayCountB: number } {
  const roofType = getRoofTypeForModule(module);

  const lengthM = toNumber(module.lengthM);
  const lengthMmA = Number.isFinite(lengthM) && lengthM > 0 ? Math.round(lengthM * 1000) : 0;
  const rafterCountA = lengthMmA > 0 ? Math.ceil(lengthMmA / RAFTER_SPACING_MM_MAX) + 1 : 0;
  const bayCountA = Math.max(0, rafterCountA - 1);

  if (roofType === 'hip_corner') {
    const lengthBM = toNumber(module.hipCornerLengthBM);
    const lengthMmB = Number.isFinite(lengthBM) && lengthBM > 0 ? Math.round(lengthBM * 1000) : 0;
    const rafterCountB = lengthMmB > 0 ? Math.ceil(lengthMmB / RAFTER_SPACING_MM_MAX) + 1 : 0;
    const bayCountB = Math.max(0, rafterCountB - 1);
    return { roofType, bayCountMain: 0, bayCountA, bayCountB };
  }

  if (roofType === 'pitched') return { roofType, bayCountMain: bayCountA, bayCountA: 0, bayCountB: 0 };
  return { roofType, bayCountMain: 0, bayCountA, bayCountB: bayCountA };
}

function makeDefaultModule(): CalculatorModuleInputs {
  return {
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'Black',
    powdercoatStandardColour: '',
    powdercoatIsCustom: false,
    powdercoatCustomColour: '',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '',
    gableEndFramesMode: 'outer_end_only',
    boxGutterHouseEdge: 'house',
    boxGutterFarEdge: 'our',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    overhangAmountM: '0.2',
    overhangSupportBeamProfile: '150x50',
    invertedEnabled: false,
    invertedHouseGutter: true,
    mixedSkylightStripCount: '1',
    mixedSkylightStripWidthM: '0.62',
    mixedAcrylicBaysMain: '',
    mixedAcrylicBaysA: '',
    mixedAcrylicBaysB: '',
    timberRoofAboveType: 'insulated_panels',
    timberInsulatedPanelThicknessMm: '50',
    timberTrayWidthMm: '500',

    postCount: '4',
    houseConnectionType: 'soffit',
    postConnectionType: 'deck_bracket',
    ground: 'easy',

    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.4',

    timberRoofAllowanceExGst: '0',

    overrides: {},
  };
}

function makeBlindId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `blind-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeDefaultBlindItem(overrides?: Partial<BlindLineItem>): BlindLineItem {
  return {
    id: makeBlindId(),
    system: 'ZIPTRAK',
    widthMm: '',
    coverLengthMm: '',
    fabric: 'MESH',
    motorised: 'NONE',
    ...overrides,
  };
}

function makeDefaultBlinds(): CalculatorBlindsState {
  return { items: [makeDefaultBlindItem()] };
}

function normalizeBlindsStateForUi(value: unknown): CalculatorBlindsState {
  const normalized = normalizeBlindsState(value);
  if (normalized && Array.isArray(normalized.items) && normalized.items.length > 0) return normalized;
  return makeDefaultBlinds();
}

export default function CalculatorGridClient({
  email: emailProp,
  role: roleProp,
}: {
  email?: string;
  role?: 'admin' | 'staff';
}) {
  const { data: session } = useSession();
  const email = typeof emailProp === 'string' ? emailProp : (typeof session?.user?.email === 'string' ? session.user.email : '');
  const role = (roleProp ?? (((session?.user as any)?.role ?? 'staff') as 'admin' | 'staff')) === 'admin' ? 'admin' : 'staff';
  const { previewLayoutEnabled } = useCalculatorUiPrefs();

  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const projectId = searchParams.get('projectId') ?? '';
  const fromEstimateId = searchParams.get('fromEstimateId') ?? '';

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [values, setValues] = useState<CalculatorInputs>(() => ({
    schemaVersion: 'v2',
    projectName: '',
    quoteRef: '',
    access: 'normal',
    height: 'single_storey',
    travelExGst: '0',
    extrasAllowanceExGst: '0',
    quoteDiscountPct: '0',
    modules: [makeDefaultModule()],
    blinds: makeDefaultBlinds(),
  }));
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setProjectError(null);
      return;
    }

    void (async () => {
      const p = await getProject(projectId);
      setProject(p);
      if (!p) {
        setProjectError('Project not found (use Projects in the header to create/select one).');
        return;
      }
      setProjectError(null);
      setValues((prev) => ({
        ...prev,
        projectName: p.projectName ?? p.name ?? prev.projectName,
        quoteRef: p.quoteRef ?? prev.quoteRef,
      }));
    })();
  }, [projectId]);

  useEffect(() => {
    if (!fromEstimateId) {
      setDraftNotice(null);
      return;
    }

    void (async () => {
      try {
        const draft = await duplicateEstimateToDraft(fromEstimateId);
        const mergedBlinds = normalizeBlindsStateForUi((draft as any).blinds);

        setValues({
          ...draft,
          schemaVersion: 'v2',
          modules: (draft.modules ?? []).map((m) => {
            const merged: CalculatorModuleInputs = { ...makeDefaultModule(), ...m };
            if (merged.roofMaterial !== 'mixed') return merged;

            const bayCounts = computeBayCountsForModule(merged);
            const hasMain = Object.prototype.hasOwnProperty.call(m as any, 'mixedAcrylicBaysMain');
            const hasA = Object.prototype.hasOwnProperty.call(m as any, 'mixedAcrylicBaysA');
            const hasB = Object.prototype.hasOwnProperty.call(m as any, 'mixedAcrylicBaysB');

            if (bayCounts.roofType === 'pitched') {
              if (!hasMain) merged.mixedAcrylicBaysMain = defaultMixedAcrylicBays(bayCounts.bayCountMain);
            } else {
              if (!hasA) merged.mixedAcrylicBaysA = defaultMixedAcrylicBays(bayCounts.bayCountA);
              if (!hasB) merged.mixedAcrylicBaysB = defaultMixedAcrylicBays(bayCounts.bayCountB);
            }

            return merged;
          }),
          blinds: mergedBlinds,
        });
        setActiveModuleIndex(0);
        const msg = `Draft duplicated from estimate ${fromEstimateId}`;
        setDraftNotice(msg);
        toast.success(msg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to duplicate estimate';
        setDraftNotice(msg);
        toast.error(msg);
      }
    })();
  }, [fromEstimateId]);

  useEffect(() => {
    if (!previewLayoutEnabled) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [previewLayoutEnabled]);

  useEffect(() => {
    setActiveModuleIndex((prev) => {
      const max = Math.max(0, values.modules.length - 1);
      return Math.min(prev, max);
    });
  }, [values.modules.length]);

  const activeModule = values.modules[activeModuleIndex] ?? values.modules[0] ?? makeDefaultModule();

  const errorsByModule = useMemo(() => {
    return values.modules.map((module) => {
      const next: Partial<Record<keyof CalculatorModuleInputs, string>> = {};

      const length = toNumber(module.lengthM);
      if (!Number.isFinite(length) || length <= 0) next.lengthM = 'Enter a length > 0';

      const projection = toNumber(module.projectionM);
      if (!Number.isFinite(projection) || projection <= 0) next.projectionM = 'Enter a roof span > 0';

      if (module.pergolaStyle === 'hip_corner') {
        const lengthB = toNumber(module.hipCornerLengthBM);
        if (!Number.isFinite(lengthB) || lengthB <= 0) next.hipCornerLengthBM = 'Roof length B is required';

        const projectionB = toNumber(module.hipCornerProjectionBM);
        if (!Number.isFinite(projectionB) || projectionB <= 0) next.hipCornerProjectionBM = 'Roof span B is required';
      }

      const postHeight = toNumber(module.postCutHeightM);
      if (!Number.isFinite(postHeight) || postHeight <= 0) next.postCutHeightM = 'Enter a post cut height > 0';

      if (module.roofPitchDeg.trim()) {
        const pitch = toNumber(module.roofPitchDeg);
        if (!Number.isFinite(pitch) || pitch < 0 || pitch > 85) next.roofPitchDeg = 'Enter a pitch between 0 and 85';
      }

      const roofTypeForModule = getRoofTypeForModule(module);
      if (module.overhangEnabled && module.boxPerimeterEnabled) {
        next.overhangEnabled = 'Overhang cannot be used with Box Perimeter.';
      }
      if (module.invertedEnabled && (roofTypeForModule !== 'pitched' || module.boxPerimeterEnabled)) {
        next.invertedEnabled = 'Inverted option is only available for Pitched roofs.';
      }
      if (module.overhangEnabled) {
        const overhangAmount = toNumber(module.overhangAmountM);
        if (!Number.isFinite(overhangAmount) || overhangAmount < 0 || overhangAmount > 1.5) {
          next.overhangAmountM = 'Enter an overhang between 0 and 1.5m';
        } else {
          const span = toNumber(module.projectionM);
          if (Number.isFinite(span) && overhangAmount >= span) {
            next.overhangAmountM = `Overhang must be less than roof span (${span}m)`;
          }
        }
      }

      const postCount = toNumber(module.postCount);
      if (!Number.isFinite(postCount) || postCount <= 0) next.postCount = 'Enter a post count > 0';

      const downpipeCount = toNumber(module.downpipeCount);
      if (module.downpipeCount.trim()) {
        if (!Number.isFinite(downpipeCount) || downpipeCount < 0) next.downpipeCount = 'Enter a downpipe count >= 0';
      }

      const downpipeJoinCount = toNonNegativeInt(module.downpipeJoinCount);
      if (!Number.isFinite(downpipeJoinCount) || downpipeJoinCount < 0 || downpipeJoinCount > 10) {
        next.downpipeJoinCount = 'Choose 0–10';
      }

      const hasOurGutter = computeHasOurGutter(module);
      if (hasOurGutter) {
        const downpipeElbowCount = toNonNegativeInt(module.downpipeElbowCount);
        if (!Number.isFinite(downpipeElbowCount) || downpipeElbowCount < 0 || downpipeElbowCount > 20) {
          next.downpipeElbowCount = 'Choose 0–20';
        }
      }

      if (module.extrusionColour === 'Mill') {
        if (module.powdercoatIsCustom) {
          if (!module.powdercoatCustomColour?.trim()) next.powdercoatCustomColour = 'Enter a custom powdercoat colour';
        } else if (!module.powdercoatStandardColour?.trim()) {
          next.powdercoatStandardColour = 'Select a powdercoat colour';
        }
      }

      if (module.roofMaterial === 'mixed') {
        const bayCounts = computeBayCountsForModule(module);
        if (bayCounts.roofType === 'pitched') {
          const raw = toNonNegativeInt(module.mixedAcrylicBaysMain);
          const clamped = clampInt(raw, 0, bayCounts.bayCountMain);
          if (!Number.isFinite(raw) || clamped !== raw) next.mixedAcrylicBaysMain = `Enter an integer between 0 and ${bayCounts.bayCountMain}`;
        } else if (bayCounts.roofType === 'hip_corner') {
          const rawA = toNonNegativeInt(module.mixedAcrylicBaysA);
          const rawB = toNonNegativeInt(module.mixedAcrylicBaysB);
          const clampedA = clampInt(rawA, 0, bayCounts.bayCountA);
          const clampedB = clampInt(rawB, 0, bayCounts.bayCountB);
          if (!Number.isFinite(rawA) || clampedA !== rawA) next.mixedAcrylicBaysA = `Enter an integer between 0 and ${bayCounts.bayCountA}`;
          if (!Number.isFinite(rawB) || clampedB !== rawB) next.mixedAcrylicBaysB = `Enter an integer between 0 and ${bayCounts.bayCountB}`;
        } else {
          const rawA = toNonNegativeInt(module.mixedAcrylicBaysA);
          const rawB = toNonNegativeInt(module.mixedAcrylicBaysB);
          const clampedA = clampInt(rawA, 0, bayCounts.bayCountA);
          const clampedB = clampInt(rawB, 0, bayCounts.bayCountB);
          if (!Number.isFinite(rawA) || clampedA !== rawA) next.mixedAcrylicBaysA = `Enter an integer between 0 and ${bayCounts.bayCountA}`;
          if (!Number.isFinite(rawB) || clampedB !== rawB) next.mixedAcrylicBaysB = `Enter an integer between 0 and ${bayCounts.bayCountB}`;
        }
      }

      if (module.roofMaterial === 'timber' || module.roofMaterial === 'mixed') {
        if (!['insulated_panels', 'steel_corrugated', 'steel_tray'].includes(module.timberRoofAboveType)) {
          next.timberRoofAboveType = 'Select a timber roof above type';
        }
        if (module.timberRoofAboveType === 'insulated_panels') {
          const thickness = toNumber(module.timberInsulatedPanelThicknessMm);
          if (!Number.isFinite(thickness) || thickness <= 0) {
            next.timberInsulatedPanelThicknessMm = 'Enter a panel thickness > 0';
          }
        }
        if (module.timberRoofAboveType === 'steel_tray') {
          const trayWidth = toNumber(module.timberTrayWidthMm);
          if (![400, 500, 600].includes(Number.isFinite(trayWidth) ? Math.round(trayWidth) : NaN)) {
            next.timberTrayWidthMm = 'Choose 400, 500, or 600';
          }
        }
      }

      return next;
    });
  }, [values.modules]);

  const errors = errorsByModule[activeModuleIndex] ?? {};
  const hasModuleErrors = errorsByModule.some((map) => Object.values(map).some(Boolean));

  useEffect(() => {
    if (activeModule.extrusionColour !== 'Mill') return;
    if (activeModule.powdercoatIsCustom) return;
    if (activeModule.powdercoatStandardColour?.trim()) return;
    setModuleField('powdercoatStandardColour', 'Ironsands');
  }, [
    activeModule.extrusionColour,
    activeModule.powdercoatIsCustom,
    activeModule.powdercoatStandardColour,
    activeModuleIndex,
  ]);

  const setJobField = <K extends Exclude<keyof CalculatorInputs, 'modules'>>(key: K, next: CalculatorInputs[K]) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  };

  const setModuleField = <K extends keyof CalculatorModuleInputs>(key: K, next: CalculatorModuleInputs[K]) => {
    setValues((prev) => {
      const modules = prev.modules.slice();
      const current = modules[activeModuleIndex] ?? makeDefaultModule();
      const updated: CalculatorModuleInputs = { ...current, [key]: next };
      const nextHouseConnection =
        key === 'houseConnectionType' ? (next as CalculatorModuleInputs['houseConnectionType']) : updated.houseConnectionType;
      const nextBoxEnabled = key === 'boxPerimeterEnabled' ? Boolean(next) : updated.boxPerimeterEnabled;

      if (key === 'extrusionColour') {
        if (next === 'Mill' && !updated.powdercoatIsCustom && !updated.powdercoatStandardColour) {
          updated.powdercoatStandardColour = 'Ironsands';
        }
      }
      if (key === 'powdercoatIsCustom') {
        if (!next && updated.extrusionColour === 'Mill' && !updated.powdercoatStandardColour) {
          updated.powdercoatStandardColour = 'Ironsands';
        }
      }

      if (key === 'houseConnectionType') {
        if (nextHouseConnection === 'none') {
          updated.boxGutterHouseEdge = 'none';
          updated.boxGutterFarEdge = 'none';
        } else if (current.houseConnectionType === 'none') {
          if (current.boxGutterHouseEdge === 'none') updated.boxGutterHouseEdge = 'house';
          if (current.boxGutterFarEdge === 'none') updated.boxGutterFarEdge = 'our';
        }

        if (updated.pergolaStyle === 'gable') {
          const prevDefault = current.houseConnectionType !== 'none' ? 'outer_end_only' : 'both_ends';
          const nextDefault = nextHouseConnection !== 'none' ? 'outer_end_only' : 'both_ends';
          if (updated.gableEndFramesMode === prevDefault) {
            updated.gableEndFramesMode = nextDefault;
          }
        }
      }

      if (key === 'boxPerimeterEnabled' && nextBoxEnabled) {
        if (nextHouseConnection === 'none') {
          updated.boxGutterHouseEdge = 'none';
          updated.boxGutterFarEdge = 'none';
        } else {
          if (current.boxGutterHouseEdge === 'none') updated.boxGutterHouseEdge = 'house';
          if (current.boxGutterFarEdge === 'none') updated.boxGutterFarEdge = 'our';
        }
        updated.overhangEnabled = false;
        updated.invertedEnabled = false;
        updated.invertedHouseGutter = true;
        updated.separateGutterEnabled = false;
      }

      if (key === 'pergolaStyle' && next !== 'pitched') {
        updated.invertedEnabled = false;
        updated.invertedHouseGutter = true;
        updated.separateGutterEnabled = false;
      }

      if (key === 'overhangEnabled' && Boolean(next)) {
        updated.separateGutterEnabled = false;
      }

      if (key === 'invertedEnabled' && Boolean(next)) {
        updated.separateGutterEnabled = false;
      }

      if (key === 'invertedHouseGutter' && updated.invertedEnabled && Boolean(next)) {
        updated.separateGutterEnabled = false;
      }

      const frontBeamOverride = normalizeOverrideValue(updated.overrides?.frontBeamProfile);
      const frontBeamProfileUsed = frontBeamOverride ?? 'SP Gutter';
      if (isGutterBeamProfile(frontBeamProfileUsed)) {
        updated.separateGutterEnabled = false;
      }

      modules[activeModuleIndex] = updated;
      return { ...prev, modules };
    });
  };

  const setModuleOverride = (key: keyof NonNullable<CalculatorModuleInputs['overrides']>, value: string) => {
    setValues((prev) => {
      const modules = prev.modules.slice();
      const current = modules[activeModuleIndex] ?? makeDefaultModule();
      const overrides = { ...(current.overrides ?? {}) };
      if (value) overrides[key] = value;
      else delete overrides[key];
      const updated: CalculatorModuleInputs = { ...current, overrides };

      if (key === 'frontBeamProfile') {
        const frontBeamProfileUsed = normalizeOverrideValue(overrides.frontBeamProfile) ?? 'SP Gutter';
        if (isGutterBeamProfile(frontBeamProfileUsed)) {
          updated.separateGutterEnabled = false;
        }
      }

      modules[activeModuleIndex] = updated;
      return { ...prev, modules };
    });
  };

  const blindsState = normalizeBlindsStateForUi(values.blinds);

  useEffect(() => {
    if (values.blinds !== blindsState) {
      setValues((prev) => ({ ...prev, blinds: blindsState }));
    }
  }, [values.blinds, blindsState]);

  const setBlindItem = (id: string, patch: Partial<BlindLineItem>) => {
    setValues((prev) => {
      const current = normalizeBlindsStateForUi(prev.blinds);
      const items = current.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
      return { ...prev, blinds: { items } };
    });
  };

  const addBlind = (seed?: Partial<BlindLineItem>) => {
    setValues((prev) => {
      const current = normalizeBlindsStateForUi(prev.blinds);
      const nextItem = makeDefaultBlindItem(seed);
      return { ...prev, blinds: { items: [...current.items, nextItem] } };
    });
  };

  const duplicateBlind = (id: string) => {
    const current = blindsState.items.find((item) => item.id === id);
    if (!current) return;
    addBlind({ ...current, id: makeBlindId(), label: current.label ? `${current.label} (copy)` : undefined });
  };

  const removeBlind = (id: string) => {
    setValues((prev) => {
      const current = normalizeBlindsStateForUi(prev.blinds);
      const items = current.items.filter((item) => item.id !== id);
      return { ...prev, blinds: { items: items.length ? items : [makeDefaultBlindItem()] } };
    });
  };

  const readyToCalculate = values.modules.length > 0 && !hasModuleErrors;

  const requestPayload = useMemo<JobInputsV1>(() => {
    const travel_ex_gst = toNumber(values.travelExGst);
    const extras_allowance_ex_gst = toNumber(values.extrasAllowanceExGst);
    const quote_discount_pct = toNumber(values.quoteDiscountPct);

    const modules: CostInputsV1[] = values.modules.map((module) => {
      const length_m = toNumber(module.lengthM);
      const roof_span_m = toNumber(module.projectionM);
      const post_cut_height_m = toNumber(module.postCutHeightM);
      const roof_pitch_deg = module.roofPitchDeg.trim() ? toNumber(module.roofPitchDeg) : NaN;
      const post_count = toNumber(module.postCount);
      const downpipe_count = toNumber(module.downpipeCount);
      const downpipe_join_count = toNumber(module.downpipeJoinCount);
      const downpipe_elbow_count = toNumber(module.downpipeElbowCount);

      const fall_distance_mm = toNumber(module.fallDistanceMm);
      const hip_corner_length_b_m = toNumber(module.hipCornerLengthBM);
      const hip_corner_projection_b_m = toNumber(module.hipCornerProjectionBM);

      const isPile = module.postConnectionType === 'pile_1m' || module.postConnectionType === 'pile_1_5m';
      const bayCounts = computeBayCountsForModule(module);
      const overrides = module.overrides ?? {};

      return {
        length_m,
        roof_span_m,
        post_cut_height_m,
        roof_pitch_deg: Number.isFinite(roof_pitch_deg) ? roof_pitch_deg : undefined,
        post_count,

        pergola_style: module.pergolaStyle,
        gable_end_frames_mode: module.gableEndFramesMode,
        box_perimeter_enabled: module.boxPerimeterEnabled,
        internal_roof_type: module.boxPerimeterEnabled ? undefined : module.internalRoofType,
        fall_distance_mm: module.boxPerimeterEnabled ? fall_distance_mm : undefined,
        box_gutter_house_edge: module.boxPerimeterEnabled ? module.boxGutterHouseEdge : undefined,
        box_gutter_far_edge: module.boxPerimeterEnabled ? module.boxGutterFarEdge : undefined,
        downpipe_count: Number.isFinite(downpipe_count) ? downpipe_count : undefined,
        downpipe_join_count: Number.isFinite(downpipe_join_count) ? downpipe_join_count : undefined,
        downpipe_elbow_count: Number.isFinite(downpipe_elbow_count) ? downpipe_elbow_count : undefined,
        separate_gutter_enabled: module.separateGutterEnabled,
        overhang_enabled: module.overhangEnabled,
        overhang_amount_m: module.overhangEnabled ? toNumber(module.overhangAmountM) : undefined,
        overhang_support_beam_profile: module.overhangEnabled ? module.overhangSupportBeamProfile : undefined,
        inverted_enabled: module.invertedEnabled,
        inverted_house_gutter: module.invertedEnabled ? module.invertedHouseGutter : undefined,
        overrides: {
          ledger_profile: normalizeOverrideValue(overrides.ledgerProfile),
          rafter_profile: normalizeOverrideValue(overrides.rafterProfile),
          post_profile: normalizeOverrideValue(overrides.postProfile),
          front_beam_profile: normalizeOverrideValue(overrides.frontBeamProfile),
          ridge_beam_profile: normalizeOverrideValue(overrides.ridgeBeamProfile),
          box_perimeter_beam_profile: normalizeOverrideValue(overrides.boxPerimeterBeamProfile),
          overhang_support_beam_profile: normalizeOverrideValue(overrides.overhangSupportBeamProfile),
          tie_beam_profile: normalizeOverrideValue(overrides.tieBeamProfile),
          strut_profile: normalizeOverrideValue(overrides.strutProfile),
        },

        roof_material: module.roofMaterial,
        extrusion_colour: module.extrusionColour,
        timber_roof_above_type: module.roofMaterial === 'timber' || module.roofMaterial === 'mixed' ? module.timberRoofAboveType : undefined,
        timber_insulated_panel_thickness_mm:
          (module.roofMaterial === 'timber' || module.roofMaterial === 'mixed') && module.timberRoofAboveType === 'insulated_panels'
            ? toNumber(module.timberInsulatedPanelThicknessMm)
            : undefined,
        timber_tray_width_mm:
          (module.roofMaterial === 'timber' || module.roofMaterial === 'mixed') && module.timberRoofAboveType === 'steel_tray'
            ? toNumber(module.timberTrayWidthMm)
            : undefined,
        powdercoat_standard_colour: module.powdercoatStandardColour?.trim() || undefined,
        powdercoat_is_custom: module.powdercoatIsCustom === true,
        powdercoat_custom_colour: module.powdercoatCustomColour?.trim() || undefined,
        mixed_roof:
          module.roofMaterial === 'mixed'
            ? {
                mode: 'acrylic_bays',
                acrylic_bays_by_plane: ((): Record<string, number> => {
                  if (bayCounts.roofType === 'pitched') {
                    return { main: clampInt(toNonNegativeInt(module.mixedAcrylicBaysMain), 0, bayCounts.bayCountMain) };
                  }
                  return {
                    A: clampInt(toNonNegativeInt(module.mixedAcrylicBaysA), 0, bayCounts.bayCountA),
                    B: clampInt(toNonNegativeInt(module.mixedAcrylicBaysB), 0, bayCounts.bayCountB),
                  };
                })(),
              }
            : undefined,
        hip_corner:
          module.pergolaStyle === 'hip_corner'
            ? {
                length_b_m: Number.isFinite(hip_corner_length_b_m) && hip_corner_length_b_m > 0 ? hip_corner_length_b_m : undefined,
                projection_b_m:
                  Number.isFinite(hip_corner_projection_b_m) && hip_corner_projection_b_m > 0 ? hip_corner_projection_b_m : undefined,
              }
            : undefined,

        house_connection_type: module.houseConnectionType,
        post_connection_type: module.postConnectionType,
        access: values.access,
        height: values.height,
        ground: isPile ? module.ground : undefined,

        travel_ex_gst: 0,
        extras_allowance_ex_gst: 0,
        quote_discount_pct: 0,
      };
    });

    return {
      modules,
      travel_ex_gst: Number.isFinite(travel_ex_gst) ? travel_ex_gst : 0,
      extras_allowance_ex_gst: Number.isFinite(extras_allowance_ex_gst) ? extras_allowance_ex_gst : 0,
      quote_discount_pct: Number.isFinite(quote_discount_pct) ? quote_discount_pct : 0,
    };
  }, [values]);

  const requestPayloadJson = useMemo(() => JSON.stringify(requestPayload), [requestPayload]);

  const [result, setResult] = useState<JobOutputV1 | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  const [confirmAcknowledgeWarnings, setConfirmAcknowledgeWarnings] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const pendingIssueFocusRef = useRef<{ moduleIndex: number; fieldId: string } | null>(null);
  const blindFieldPrefix = useId();

  const issues = useMemo(() => {
    const out: Array<{ moduleIndex: number; fieldId: string; label: string; message: string }> = [];
    errorsByModule.forEach((map, moduleIndex) => {
      Object.entries(map).forEach(([fieldId, message]) => {
        if (!message) return;
        out.push({ moduleIndex, fieldId, label: labelForIssueField(fieldId), message });
      });
    });
    return out;
  }, [errorsByModule]);

  const issuesCount = issues.length;

  useEffect(() => {
    if (issuesOpen) return;
    const pending = pendingIssueFocusRef.current;
    if (!pending) return;
    if (pending.moduleIndex !== activeModuleIndex) return;
    pendingIssueFocusRef.current = null;

    const el = document.getElementById(pending.fieldId);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (typeof (el as any).focus === 'function') {
      try {
        (el as any).focus({ preventScroll: true });
      } catch {
        (el as any).focus();
      }
    }
  }, [activeModuleIndex, issuesOpen]);

  useEffect(() => {
    if (!readyToCalculate) {
      setEngineError(null);
      return;
    }

    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setIsCalculating(true);
      setEngineError(null);

      try {
        const res = await fetch('/api/staff/costing/v1/job', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: requestPayloadJson,
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(String(json?.error ?? 'Costing failed'));
        setResult(json as JobOutputV1);
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Costing failed';
        setEngineError(msg);
      } finally {
        if (!controller.signal.aborted) setIsCalculating(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [readyToCalculate, requestPayloadJson]);

  const moduleResult = result?.modules[activeModuleIndex] ?? result?.modules[0] ?? null;

  const derivedArea = moduleResult?.derived.area_m2;
  const derivedRoofArea = moduleResult?.derived.roof_surface_area_m2;
  const derivedPitchUsed = moduleResult?.derived.roof_pitch_deg_used;
  const derivedAcrylicArea = moduleResult?.derived.acrylic_area_m2;
  const derivedTimberArea = (moduleResult?.derived as any)?.timber_area_m2 as number | undefined;
  const derivedAcrylicBaysTotal = (moduleResult?.derived as any)?.acrylic_bays_total as number | undefined;
  const derivedSlopeLength = moduleResult?.derived.rafter_length_m;
  const derivedBoxPitch = (moduleResult?.derived as any)?.box_pitch_deg_used as number | undefined;
  const derivedBoxRiseMm = (moduleResult?.derived as any)?.box_rise_mm as number | undefined;
  const derivedBoxMaxFallMm = (moduleResult?.derived as any)?.box_max_fall_mm as number | undefined;
  const derivedHasOurGutter = (moduleResult?.derived as any)?.has_our_gutter as boolean | undefined;
  const roofType = moduleResult?.inputs_normalized.roof_type;
  const rafterCount = moduleResult?.derived.rafter_count;
  const hipRafterCount = moduleResult?.derived.hip_rafter_count;
  const bracketCount = moduleResult?.derived.bracket_count;
  const rafterProfile = moduleResult?.inputs_normalized.rafter_profile;
  const crewHours = result?.install.totals.crew_hours;
  const siteDays = moduleResult?.derived?.site_days ?? result?.modules?.[0]?.derived?.site_days;
  const hasOurGutterUi = typeof derivedHasOurGutter === 'boolean' ? derivedHasOurGutter : computeHasOurGutter(activeModule);
  const crewDays = typeof siteDays === 'number' ? siteDays : undefined;

  const materialsEx = result?.materials.totals.materials_ex_gst;
  const installEx = result?.install.totals.install_ex_gst;
  const overheadEx = result?.overhead.total_ex_gst;
  const totalEx = result?.totals.cost_ex_gst;
  const totalInc = result?.totals.cost_inc_gst;

  const blindInputs = useMemo<BlindLineItemInput[]>(
    () =>
      blindsState.items.map((item) => ({
        id: item.id,
        label: item.label,
        system: item.system as BlindSystemInput,
        widthMm: Number.isFinite(toNumber(item.widthMm)) ? toNumber(item.widthMm) : null,
        coverLengthMm: Number.isFinite(toNumber(item.coverLengthMm)) ? toNumber(item.coverLengthMm) : null,
        fabric: item.fabric as BlindFabricInput,
        motorised: item.motorised === 'YES' ? true : null,
      })),
    [blindsState],
  );

  const blindsPricing = useMemo<BlindPricingResult>(() => priceAllBlinds(blindInputs), [blindInputs]);
  const blindsTotals = blindsPricing.totals;
  const blindsTotalEx = blindsTotals ? blindsTotals.totalExCents / 100 : 0;
  const blindsTotalInc = blindsTotals ? blindsTotals.totalIncCents / 100 : 0;
  const addonsTotals = buildAddonsTotals(blindsTotalEx, blindsTotalInc);
  const { coreEx: coreTotalEx, coreInc: coreTotalInc } = computeDisplayTotals(totalEx, totalInc, addonsTotals);
  const warningsTyped =
    result?.totals.warnings ??
    (result?.totals.notes_and_warnings ?? []).map((message) => ({ level: 'info' as const, message }));
  const criticalWarnings = warningsTyped.filter((w) => w.level === 'critical');
  const infoWarnings = warningsTyped.filter((w) => w.level === 'info');
  const warningsCount = warningsTyped.length;

  useEffect(() => {
    if (hasOurGutterUi) return;
    if (activeModule.downpipeElbowCount === '0') return;
    setModuleField('downpipeElbowCount', '0');
  }, [hasOurGutterUi, activeModule.downpipeElbowCount, activeModuleIndex]);

  const roofingProcurementSummary = useMemo(() => {
    const lines = moduleResult?.materials?.lines ?? [];
    if (!Array.isArray(lines) || !lines.length) return '—';

    const cedar = lines.find((l: any) => String(l?.id ?? '') === 'roofing-timber_cedar_sarking_wrc_110cover_12mm_lm');
    const cedarPart =
      cedar && typeof cedar.qty === 'number' && Number.isFinite(cedar.qty) ? `Timber: ${formatMaybeNumber(cedar.qty, 2)} lm cedar sarking` : null;

    const sheet = lines.find((l: any) => String(l?.profile ?? '') === 'Plexi sheet 3050×2030');
    const sheetPart =
      sheet && typeof sheet.qty === 'number' && Number.isFinite(sheet.qty) ? `Acrylic: ${Math.round(sheet.qty)} × 3050×2030 sheet(s)` : null;

    const stripGroups = new Map<number, number>();
    for (const l of lines as any[]) {
      if (String(l?.profile ?? '') !== 'Crystalite 620mm') continue;
      const len = inferStockLengthFromLabel(String(l?.label ?? '')) ?? 0;
      if (!len) continue;
      const qty = typeof l?.qty === 'number' && Number.isFinite(l.qty) ? l.qty : 0;
      stripGroups.set(len, (stripGroups.get(len) ?? 0) + qty);
    }
    const stripPart =
      stripGroups.size > 0
        ? `Acrylic: ${Array.from(stripGroups.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([len, qty]) => `${Math.round(qty)} × 620mm strip(s) @ ${len}m`)
            .join(', ')}`
        : null;

    const acrylicPart = sheetPart ?? stripPart;
    const parts = [acrylicPart, cedarPart].filter(Boolean);
    return parts.length ? (parts as string[]).join(' · ') : '—';
  }, [moduleResult]);

  const rafterCountTotal =
    typeof rafterCount === 'number'
      ? roofType === 'gable' || roofType === 'low_gable' || roofType === 'hip'
        ? rafterCount * 2
        : rafterCount
      : null;

  const rafterHelperText =
    typeof rafterCount === 'number' && (roofType === 'gable' || roofType === 'low_gable')
      ? `Per side: ${rafterCount}`
      : typeof rafterCount === 'number' && roofType === 'hip'
        ? `Per side: ${rafterCount}${typeof hipRafterCount === 'number' && hipRafterCount > 0 ? ` (+${hipRafterCount} hip)` : ''}`
        : undefined;

  const generateLabel = isGenerating ? 'Generating…' : 'Generate';

  const roofTypeForInputs = getRoofTypeForModule(activeModule);
  const roofSpanForInputsM = toNumber(activeModule.projectionM);
  const pitchForInputsDegRaw = toNumber(activeModule.roofPitchDeg);
  const defaultPitchForInputsDeg =
    roofTypeForInputs === 'low_gable'
      ? 10
      : roofTypeForInputs === 'gable' || roofTypeForInputs === 'hip' || roofTypeForInputs === 'hip_corner'
        ? 25
        : 5;
  const pitchForHintsDeg = Number.isFinite(pitchForInputsDegRaw)
    ? Math.max(0, Math.min(85, pitchForInputsDegRaw))
    : defaultPitchForInputsDeg;
  const cosForHints = Math.max(0.02, Math.cos((pitchForHintsDeg * Math.PI) / 180));

  const perSideSpanM =
    Number.isFinite(roofSpanForInputsM) && roofSpanForInputsM > 0 ? roofSpanForInputsM / 2 : NaN;
  const slopedDownslopePerSideM = perSideSpanM / cosForHints;

  const gableHintFields: FieldSchemaItem[] =
    roofTypeForInputs === 'gable' || roofTypeForInputs === 'low_gable'
      ? [
          {
            id: 'perSideSpanM',
            label: 'Per‑side span (m)',
            type: 'readOnly',
            value: formatMaybeNumber(perSideSpanM, 2),
            helperText: 'Gable: per-side span = roof span ÷ 2',
          },
          {
            id: 'slopedLengthPerSideM',
            label: 'Sloped length per side (m)',
            type: 'readOnly',
            value: Number.isFinite(slopedDownslopePerSideM)
              ? `${formatMaybeNumber(slopedDownslopePerSideM, 2)} (at ${pitchForHintsDeg.toFixed(0)}°)`
              : '—',
            helperText: 'Sloped length = (roof span ÷ 2) ÷ cos(pitch)',
          },
        ]
      : [];

  const moduleOverrides = activeModule.overrides ?? {};
  const frontBeamOverride = normalizeOverrideValue(moduleOverrides.frontBeamProfile);
  const frontBeamProfileUsed = frontBeamOverride ?? 'SP Gutter';
  const integratedGutterBeamUi = isGutterBeamProfile(frontBeamProfileUsed);
  const showSeparateGutterToggle =
    !activeModule.boxPerimeterEnabled && !activeModule.overhangEnabled && !activeModule.invertedEnabled && !integratedGutterBeamUi;

  const blindItemPricing = blindsPricing.items;

  const blindsListContent = (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blindsState.items.map((item, idx) => {
        const pricing = blindItemPricing.find((p) => p.id === item.id);
        const errors = pricing?.errors ?? [];
        const hasErrors = errors.length > 0;
        const isMissingDims = errors.some((err) => err.toLowerCase().includes('enter width'));
        const widthTooLarge = errors.some((err) => err.toLowerCase().includes('max width'));
        const lengthTooLarge = errors.some((err) => err.toLowerCase().includes('max cover length'));
        const statusMessage = isMissingDims
          ? 'Enter dimensions to price this blind.'
          : widthTooLarge
            ? 'Add another blind and split widths manually.'
            : lengthTooLarge
              ? 'Manual quote required.'
              : hasErrors
                ? errors[0]
                : '';
        const statusClassName = hasErrors && !isMissingDims ? styles.error : styles.helper;
        const showStatus = Boolean(statusMessage);
        const isPriceable = pricing ? pricing.errors.length === 0 : false;
        const totalExLabel = isPriceable ? formatCents(pricing?.blindSellExCents ?? 0) : '—';
        const totalIncLabel = isPriceable ? formatCents(pricing?.blindSellIncCents ?? 0) : '—';
        const domIdBase = `${blindFieldPrefix}-blind-${idx + 1}`;
        return (
          <div key={item.id} className={styles.previewCard} style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <strong>Blind {idx + 1}</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={styles.drawerClose}
                  style={{ padding: '6px 10px', fontSize: 11 }}
                  onClick={() => duplicateBlind(item.id)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className={styles.drawerClose}
                  style={{ padding: '6px 10px', fontSize: 11 }}
                  onClick={() => removeBlind(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 8, marginTop: 10 }}>
              <FieldTile
                id={`${domIdBase}-label`}
                label="Label"
                type="text"
                value={item.label ?? ''}
                onChange={(v) => setBlindItem(item.id, { label: String(v) })}
              />
              <FieldTile
                id={`${domIdBase}-system`}
                label="System"
                type="select"
                value={item.system}
                onChange={(v) => setBlindItem(item.id, { system: v as BlindSystemInput })}
                options={[
                  { label: 'Ziptrak', value: 'ZIPTRAK' },
                  { label: 'Omni', value: 'OMNI' },
                ]}
              />
              <FieldTile
                id={`${domIdBase}-width`}
                label="Width (mm)"
                type="number"
                value={item.widthMm}
                onChange={(v) => setBlindItem(item.id, { widthMm: String(v) })}
              />
              <FieldTile
                id={`${domIdBase}-cover`}
                label="Cover length (mm)"
                type="number"
                value={item.coverLengthMm}
                onChange={(v) => setBlindItem(item.id, { coverLengthMm: String(v) })}
              />
              <FieldTile
                id={`${domIdBase}-fabric`}
                label="Fabric"
                type="select"
                value={item.fabric}
                onChange={(v) => setBlindItem(item.id, { fabric: v as BlindFabricInput })}
                options={[
                  { label: 'Mesh', value: 'MESH' },
                  { label: 'PVC', value: 'PVC' },
                  { label: 'Fine mesh', value: 'FINE_MESH' },
                  { label: 'None (Mesh)', value: 'NONE' },
                ]}
              />
              <FieldTile
                id={`${domIdBase}-motor`}
                label="Motorised"
                type="toggle"
                value={item.motorised === 'YES'}
                onChange={(v) => setBlindItem(item.id, { motorised: v ? 'YES' : 'NONE' })}
              />
              <FieldTile id={`${domIdBase}-total-ex`} label="Blind total (ex‑GST)" type="readOnly" value={totalExLabel} />
              <FieldTile id={`${domIdBase}-total-inc`} label="Blind total (inc‑GST)" type="readOnly" value={totalIncLabel} />
            </div>
            {showStatus ? <div className={statusClassName}>{statusMessage}</div> : null}
          </div>
        );
      })}

      <div className={styles.previewCard} style={{ padding: 12 }}>
        <button
          type="button"
          className={styles.drawerClose}
          style={{ width: '100%', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}
          onClick={() => addBlind()}
        >
          Add blind
        </button>
      </div>

      <div className={styles.previewCard} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Blinds total (ex‑GST)</span>
          <span>{formatCents(blindsTotals?.totalExCents ?? 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Blinds total (inc‑GST)</span>
          <span>{formatCents(blindsTotals?.totalIncCents ?? 0)}</span>
        </div>
        <div className={styles.helper}>Totals round to cents; pricing uses banded size lookup.</div>
      </div>
    </div>
  );

  const schema: FieldSchemaItem[] = [
    {
      id: 'engine-status',
      label: 'Cost engine',
      type: 'readOnly',
      value: isCalculating ? 'Calculating…' : engineError ? 'Error' : result ? 'Ready' : '—',
      error: engineError ?? undefined,
      helperText: engineError ? undefined : 'True cost (ex‑GST)',
    },
    {
      id: 'project-context',
      label: 'Project',
      type: 'readOnly',
      value: project ? project.projectName ?? project.name ?? '—' : projectId ? 'Not found' : 'None',
      helperText: project ? `Attached: ${project.projectName ?? project.name ?? '—'}` : 'Use Projects in the header to select or create one.',
      error: projectId && !project ? projectError ?? undefined : undefined,
    },

    ...(draftNotice
      ? [
          {
            id: 'draft-notice',
            label: 'Draft',
            type: 'readOnly',
            value: 'Active',
            helperText: draftNotice,
          } satisfies FieldSchemaItem,
        ]
      : []),

    ...(projectId && project
      ? [
          {
            id: 'projectName',
            label: 'Project name',
            type: 'readOnly',
            value: project.projectName ?? project.name ?? '—',
          } satisfies FieldSchemaItem,
          { id: 'quoteRef', label: 'Quote ref', type: 'readOnly', value: project.quoteRef ?? '—', helperText: 'Internal reference' } satisfies FieldSchemaItem,
        ]
      : [
          {
            id: 'projectName',
            label: 'Project name',
            type: 'text',
            value: values.projectName,
            onChange: (v) => setJobField('projectName', String(v)),
          } satisfies FieldSchemaItem,
          {
            id: 'quoteRef',
            label: 'Quote ref',
            type: 'text',
            value: values.quoteRef,
            onChange: (v) => setJobField('quoteRef', String(v)),
            helperText: 'Internal reference',
          } satisfies FieldSchemaItem,
        ]),

    {
      id: 'moduleIndex',
      label: 'Module',
      type: 'select',
      value: String(activeModuleIndex),
      onChange: (v) => {
        const idx = Number.parseInt(String(v), 10);
        if (!Number.isFinite(idx)) return;
        setActiveModuleIndex(Math.max(0, Math.min(values.modules.length - 1, idx)));
      },
      options: values.modules.map((_, idx) => ({ label: `Module ${idx + 1}`, value: String(idx) })),
      helperText: values.modules.length > 1 ? `${values.modules.length} modules in this job` : 'Single module job',
    },
    {
      id: 'addModule',
      label: 'Add module',
      type: 'action',
      actionLabel: 'Add',
      onAction: () => {
        setValues((prev) => {
          const base = prev.modules[activeModuleIndex] ?? prev.modules[0] ?? makeDefaultModule();
          return { ...prev, modules: [...prev.modules, { ...base }] };
        });
        setActiveModuleIndex(values.modules.length);
      },
      helperText: 'Duplicates the current module',
    },
    ...(values.modules.length > 1
      ? [
          {
            id: 'removeModule',
            label: 'Remove module',
            type: 'action',
            actionLabel: 'Remove',
            onAction: () => {
              if (values.modules.length <= 1) return;
              setValues((prev) => {
                if (prev.modules.length <= 1) return prev;
                const nextModules = prev.modules.slice();
                nextModules.splice(activeModuleIndex, 1);
                return { ...prev, modules: nextModules };
              });
              setActiveModuleIndex(Math.min(activeModuleIndex, Math.max(0, values.modules.length - 2)));
            },
            helperText: 'Removes the current module',
          } satisfies FieldSchemaItem,
        ]
      : []),

    {
      id: 'pergolaStyle',
      label: 'Pergola style',
      type: 'select',
      value: activeModule.pergolaStyle,
      onChange: (v) => {
        const nextStyle = v as CalculatorModuleInputs['pergolaStyle'];
        setValues((prev) => {
          const modules = prev.modules.slice();
          const current = modules[activeModuleIndex] ?? makeDefaultModule();
          modules[activeModuleIndex] = {
            ...current,
            pergolaStyle: nextStyle,
            ...(nextStyle === 'hip_corner' ? { boxPerimeterEnabled: false } : null),
          };
          return { ...prev, modules };
        });
      },
      options: [
        { label: 'Pitched', value: 'pitched' },
        { label: 'Gable', value: 'gable' },
        { label: 'Hip', value: 'hip' },
        { label: 'Hip (corner)', value: 'hip_corner' },
      ],
      helperText:
        activeModule.pergolaStyle === 'gable' || activeModule.pergolaStyle === 'hip' || activeModule.pergolaStyle === 'hip_corner'
          ? 'v1 assumptions (check Details)'
          : undefined,
    },
    {
      id: 'boxPerimeterEnabled',
      label: 'Box perimeter',
      type: 'toggle',
      value: activeModule.boxPerimeterEnabled,
      onChange: (v) => setModuleField('boxPerimeterEnabled', Boolean(v)),
      disabled: activeModule.pergolaStyle === 'hip_corner',
      helperText:
        activeModule.pergolaStyle === 'hip_corner'
          ? 'Not supported for hip corner'
          : activeModule.boxPerimeterEnabled
            ? 'Box beam = 300x50'
            : 'Off',
    },
    {
      id: 'roofMaterial',
      label: 'Roof material',
      type: 'select',
      value: activeModule.roofMaterial,
      onChange: (v) => {
        const next = v as CalculatorModuleInputs['roofMaterial'];
        setValues((prev) => {
          const modules = prev.modules.slice();
          const current = modules[activeModuleIndex] ?? makeDefaultModule();
          const updated: CalculatorModuleInputs =
            next === 'mixed'
              ? (() => {
                  const bayCounts = computeBayCountsForModule(current);
                  const withDefault = (value: string | undefined, bayCount: number) =>
                    hasNonEmptyValue(value) ? value : defaultMixedAcrylicBays(bayCount);
                  return {
                    ...current,
                    roofMaterial: next,
                    ...(bayCounts.roofType === 'pitched'
                      ? { mixedAcrylicBaysMain: withDefault(current.mixedAcrylicBaysMain, bayCounts.bayCountMain) }
                      : {
                          mixedAcrylicBaysA: withDefault(current.mixedAcrylicBaysA, bayCounts.bayCountA),
                          mixedAcrylicBaysB: withDefault(current.mixedAcrylicBaysB, bayCounts.bayCountB),
                        }),
                  };
                })()
              : { ...current, roofMaterial: next };
          modules[activeModuleIndex] = updated;
          return { ...prev, modules };
        });
      },
      options: [
        { label: 'Acrylic', value: 'acrylic' },
        { label: 'Timber', value: 'timber' },
        { label: 'Mixed (Acrylic + Timber)', value: 'mixed' },
      ],
    },
    ...(activeModule.roofMaterial === 'mixed'
      ? [
          ...(computeBayCountsForModule(activeModule).roofType === 'pitched'
            ? [
                {
                  id: 'mixedAcrylicBaysMain',
                  label: 'Acrylic bays (main)',
                  type: 'number',
                  value: activeModule.mixedAcrylicBaysMain,
                  onChange: (v: string | boolean) => setModuleField('mixedAcrylicBaysMain', String(v)),
                  error: errors.mixedAcrylicBaysMain,
                  helperText: `0–${computeBayCountsForModule(activeModule).bayCountMain}`,
                } satisfies FieldSchemaItem,
              ]
            : computeBayCountsForModule(activeModule).roofType === 'hip_corner'
              ? [
                  {
                    id: 'mixedAcrylicBaysA',
                    label: 'Acrylic bays (leg A)',
                    type: 'number',
                    value: activeModule.mixedAcrylicBaysA,
                    onChange: (v: string | boolean) => setModuleField('mixedAcrylicBaysA', String(v)),
                    error: errors.mixedAcrylicBaysA,
                    helperText: `0–${computeBayCountsForModule(activeModule).bayCountA}`,
                  } satisfies FieldSchemaItem,
                  {
                    id: 'mixedAcrylicBaysB',
                    label: 'Acrylic bays (leg B)',
                    type: 'number',
                    value: activeModule.mixedAcrylicBaysB,
                    onChange: (v: string | boolean) => setModuleField('mixedAcrylicBaysB', String(v)),
                    error: errors.mixedAcrylicBaysB,
                    helperText: `0–${computeBayCountsForModule(activeModule).bayCountB}`,
                  } satisfies FieldSchemaItem,
                ]
              : [
                  {
                    id: 'mixedAcrylicBaysA',
                    label: 'Acrylic bays (side A)',
                    type: 'number',
                    value: activeModule.mixedAcrylicBaysA,
                    onChange: (v: string | boolean) => setModuleField('mixedAcrylicBaysA', String(v)),
                    error: errors.mixedAcrylicBaysA,
                    helperText: `0–${computeBayCountsForModule(activeModule).bayCountA}`,
                  } satisfies FieldSchemaItem,
                  {
                    id: 'mixedAcrylicBaysB',
                    label: 'Acrylic bays (side B)',
                    type: 'number',
                    value: activeModule.mixedAcrylicBaysB,
                    onChange: (v: string | boolean) => setModuleField('mixedAcrylicBaysB', String(v)),
                    error: errors.mixedAcrylicBaysB,
                    helperText: `0–${computeBayCountsForModule(activeModule).bayCountB}`,
                  } satisfies FieldSchemaItem,
                ]),
        ]
      : []),
    ...(activeModule.roofMaterial === 'timber' || activeModule.roofMaterial === 'mixed'
      ? [
          {
            id: 'timberSystemHeading',
            label: 'TIMBER SYSTEM (ceiling + roof above)',
            type: 'readOnly',
            value: '—',
          } satisfies FieldSchemaItem,
          {
            id: 'timberNoteRafters',
            label: 'Timber rafters',
            type: 'readOnly',
            value: 'Common rafters 80x50 @ max 500mm centres (mill finish)',
          } satisfies FieldSchemaItem,
          {
            id: 'timberNotePurlins',
            label: 'Purlins',
            type: 'readOnly',
            value: '50x50 @ max 500mm centres, first/last 100mm from eave + ridge (mill finish)',
          } satisfies FieldSchemaItem,
          {
            id: 'timberNoteEdgeRafters',
            label: 'Edge rafters',
            type: 'readOnly',
            value: '150x50 each side (match frame finish)',
          } satisfies FieldSchemaItem,
          {
            id: 'timberRoofAboveType',
            label: 'Roof above type',
            type: 'select',
            value: activeModule.timberRoofAboveType,
            onChange: (v) => setModuleField('timberRoofAboveType', v as CalculatorModuleInputs['timberRoofAboveType']),
            options: [
              { label: 'Insulated panels', value: 'insulated_panels' },
              { label: 'Steel corrugated', value: 'steel_corrugated' },
              { label: 'Steel tray', value: 'steel_tray' },
            ],
            error: errors.timberRoofAboveType,
          } satisfies FieldSchemaItem,
          ...(activeModule.timberRoofAboveType === 'insulated_panels'
            ? [
                {
                  id: 'timberInsulatedPanelThicknessMm',
                  label: 'Insulated panel thickness (mm)',
                  type: 'readOnly',
                  value: activeModule.timberInsulatedPanelThicknessMm,
                  error: errors.timberInsulatedPanelThicknessMm,
                } satisfies FieldSchemaItem,
              ]
            : []),
          ...(activeModule.timberRoofAboveType === 'steel_tray'
            ? [
                {
                  id: 'timberTrayWidthMm',
                  label: 'Steel tray width (mm)',
                  type: 'select',
                  value: activeModule.timberTrayWidthMm,
                  onChange: (v) => setModuleField('timberTrayWidthMm', String(v)),
                  options: [
                    { label: '400', value: '400' },
                    { label: '500', value: '500' },
                    { label: '600', value: '600' },
                  ],
                  error: errors.timberTrayWidthMm,
                } satisfies FieldSchemaItem,
              ]
            : []),
        ]
      : []),
    {
      id: 'extrusionColour',
      label: 'Extrusion colour',
      type: 'select',
      value: activeModule.extrusionColour,
      onChange: (v) => setModuleField('extrusionColour', v as CalculatorModuleInputs['extrusionColour']),
      options: [
        { label: 'Black', value: 'Black' },
        { label: 'White', value: 'White' },
        { label: 'Mill', value: 'Mill' },
      ],
    },
    ...(activeModule.extrusionColour === 'Mill'
      ? [
          {
            id: 'powdercoatStandardColour',
            label: 'Powdercoat colour',
            type: 'select',
            value: activeModule.powdercoatStandardColour ?? '',
            onChange: (v) => setModuleField('powdercoatStandardColour', String(v)),
            options: [
              { label: 'Select', value: '' },
              ...POWDERCOAT_STANDARD_COLOURS.map((colour) => ({ label: colour, value: colour })),
            ],
            disabled: Boolean(activeModule.powdercoatIsCustom),
            error: errors.powdercoatStandardColour,
          } satisfies FieldSchemaItem,
          {
            id: 'powdercoatIsCustom',
            label: 'Custom powdercoat colour',
            type: 'toggle',
            value: Boolean(activeModule.powdercoatIsCustom),
            onChange: (v) => setModuleField('powdercoatIsCustom', Boolean(v)),
          } satisfies FieldSchemaItem,
          ...(activeModule.powdercoatIsCustom
            ? [
                {
                  id: 'powdercoatCustomColour',
                  label: 'Custom powdercoat colour name',
                  type: 'text',
                  value: activeModule.powdercoatCustomColour ?? '',
                  onChange: (v) => setModuleField('powdercoatCustomColour', String(v)),
                  error: errors.powdercoatCustomColour,
                } satisfies FieldSchemaItem,
              ]
            : []),
        ]
      : []),

    {
      id: 'lengthM',
      label: activeModule.pergolaStyle === 'hip_corner' ? 'Roof Length A (m)' : 'Roof Length (m)',
      type: 'number',
      value: activeModule.lengthM,
      onChange: (v) => setModuleField('lengthM', String(v)),
      error: errors.lengthM,
      helperText: 'Roof Length: dimension parallel to the ridge / gutter.',
    },
    {
      id: 'projectionM',
      label: activeModule.pergolaStyle === 'hip_corner' ? 'Roof Span A (m)' : 'Roof Span (Eave‑to‑Eave) (m)',
      type: 'number',
      value: activeModule.projectionM,
      onChange: (v) => setModuleField('projectionM', String(v)),
      error: errors.projectionM,
      helperText: 'Roof Span (Eave‑to‑Eave): total width across the roof (both sides for gable, single slope for pitched).',
    },
    ...(previewLayoutEnabled
      ? [
          {
            id: 'roofOrientation',
            label: 'Orientation',
            type: 'custom',
            content: <RoofOrientationDiagram />,
            helperText: 'Length = parallel to ridge. Span = eave‑to‑eave.',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(activeModule.pergolaStyle === 'hip_corner'
      ? [
          {
            id: 'hipCornerLengthBM',
            label: 'Roof Length B (m)',
            type: 'number',
            value: activeModule.hipCornerLengthBM,
            onChange: (v: string | boolean) => setModuleField('hipCornerLengthBM', String(v)),
            error: errors.hipCornerLengthBM,
          } satisfies FieldSchemaItem,
          {
            id: 'hipCornerProjectionBM',
            label: 'Roof Span B (m)',
            type: 'number',
            value: activeModule.hipCornerProjectionBM,
            onChange: (v: string | boolean) => setModuleField('hipCornerProjectionBM', String(v)),
            error: errors.hipCornerProjectionBM,
          } satisfies FieldSchemaItem,
        ]
      : []),
    {
      id: 'roofPitchDeg',
      label: 'Roof pitch (deg)',
      type: 'number',
      value: activeModule.roofPitchDeg,
      onChange: (v) => setModuleField('roofPitchDeg', String(v)),
      error: errors.roofPitchDeg,
      helperText: activeModule.boxPerimeterEnabled
        ? 'Auto-computed for box perimeter'
        : activeModule.roofPitchDeg.trim()
          ? 'Overrides default pitch for roof type'
          : 'Blank = default pitch',
      disabled: activeModule.boxPerimeterEnabled,
    },
    ...(activeModule.pergolaStyle === 'gable'
      ? [
          {
            id: 'gableEndFramesMode',
            label: 'Gable end frames',
            type: 'select',
            value: activeModule.gableEndFramesMode,
            onChange: (v) => setModuleField('gableEndFramesMode', v as CalculatorModuleInputs['gableEndFramesMode']),
            options: GABLE_END_FRAME_OPTIONS,
            helperText: 'Adds tie beam + king-post strut at selected gable end(s).',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(roofTypeForInputs === 'pitched' && !activeModule.boxPerimeterEnabled
      ? [
          {
            id: 'invertedEnabled',
            label: 'Inverted (toward house)',
            type: 'toggle',
            value: activeModule.invertedEnabled,
            onChange: (v: string | boolean) => setModuleField('invertedEnabled', Boolean(v)),
            error: errors.invertedEnabled,
            helperText: 'Flip slope so fall runs toward the house',
          } satisfies FieldSchemaItem,
          ...(activeModule.invertedEnabled
            ? [
                {
                  id: 'invertedHouseGutter',
                  label: 'Use house gutter?',
                  type: 'toggle',
                  value: activeModule.invertedHouseGutter,
                  onChange: (v: string | boolean) => setModuleField('invertedHouseGutter', Boolean(v)),
                  helperText: activeModule.invertedHouseGutter
                    ? 'No gutter supplied by us (house gutter only)'
                    : 'Use SP gutter at house edge',
                } satisfies FieldSchemaItem,
              ]
            : []),
        ]
      : []),
    ...(!activeModule.boxPerimeterEnabled
      ? [
          {
            id: 'overhangEnabled',
            label: 'Overhang',
            type: 'toggle',
            value: activeModule.overhangEnabled,
            onChange: (v: string | boolean) => setModuleField('overhangEnabled', Boolean(v)),
            error: errors.overhangEnabled,
            helperText: 'Add overhang support beam + end stringer',
          } satisfies FieldSchemaItem,
          ...(activeModule.overhangEnabled
            ? [
                {
                  id: 'overhangAmountM',
                  label: 'Overhang amount (m)',
                  type: 'number',
                  value: activeModule.overhangAmountM,
                  onChange: (v: string | boolean) => setModuleField('overhangAmountM', String(v)),
                  error: errors.overhangAmountM,
                  helperText: 'Overhang is within the roof footprint (L×W unchanged). It moves the post beam inboard.',
                } satisfies FieldSchemaItem,
              ]
            : []),
        ]
      : []),
    ...(activeModule.boxPerimeterEnabled
      ? [
          {
            id: 'boxPerimeterBeamProfileOverride',
            label: 'Box perimeter beam override',
            type: 'select',
            value: moduleOverrides.boxPerimeterBeamProfile ?? '',
            onChange: (v) => setModuleOverride('boxPerimeterBeamProfile', String(v)),
            options: BOX_BEAM_PROFILE_OPTIONS,
            helperText: 'Overrides box perimeter beam profile (default 300x50)',
          } satisfies FieldSchemaItem,
        ]
      : []),
    {
      id: 'ledgerProfileOverride',
      label: 'Ledger override',
      type: 'select',
      value: moduleOverrides.ledgerProfile ?? '',
      onChange: (v) => setModuleOverride('ledgerProfile', String(v)),
      options: LEDGER_PROFILE_OPTIONS,
      helperText: 'Override ledger/stringer profile',
    },
    {
      id: 'rafterProfileOverride',
      label: 'Rafter override',
      type: 'select',
      value: moduleOverrides.rafterProfile ?? '',
      onChange: (v) => setModuleOverride('rafterProfile', String(v)),
      options: RAFTER_PROFILE_OPTIONS,
      helperText: 'Override auto rafter profile selection',
    },
    {
      id: 'postProfileOverride',
      label: 'Post override',
      type: 'select',
      value: moduleOverrides.postProfile ?? '',
      onChange: (v) => setModuleOverride('postProfile', String(v)),
      options: POST_PROFILE_OPTIONS,
      helperText: 'Override post profile (default 100x100)',
    },
    ...(!activeModule.boxPerimeterEnabled
      ? [
          {
            id: 'frontBeamProfileOverride',
            label: 'Front beam override',
            type: 'select',
            value: moduleOverrides.frontBeamProfile ?? '',
            onChange: (v) => setModuleOverride('frontBeamProfile', String(v)),
            options: FRONT_BEAM_PROFILE_OPTIONS,
            helperText: integratedGutterBeamUi
              ? 'SP gutter selected = integrated gutter beam'
              : 'Select a non‑gutter beam to allow a separate gutter',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(roofTypeForInputs === 'gable' || roofTypeForInputs === 'low_gable' || roofTypeForInputs === 'hip'
      ? [
          {
            id: 'ridgeBeamProfileOverride',
            label: 'Ridge beam override',
            type: 'select',
            value: moduleOverrides.ridgeBeamProfile ?? '',
            onChange: (v) => setModuleOverride('ridgeBeamProfile', String(v)),
            options: RIDGE_BEAM_PROFILE_OPTIONS,
            helperText: 'Overrides ridge beam profile when applicable',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(activeModule.pergolaStyle === 'gable'
      ? [
          {
            id: 'tieBeamProfileOverride',
            label: 'Tie beam override',
            type: 'select',
            value: moduleOverrides.tieBeamProfile ?? '',
            onChange: (v) => setModuleOverride('tieBeamProfile', String(v)),
            options: FRONT_BEAM_PROFILE_OPTIONS,
            helperText: 'Overrides tie beam profile when applicable',
          } satisfies FieldSchemaItem,
          {
            id: 'strutProfileOverride',
            label: 'King-post strut override',
            type: 'select',
            value: moduleOverrides.strutProfile ?? '',
            onChange: (v) => setModuleOverride('strutProfile', String(v)),
            options: STRUT_PROFILE_OPTIONS,
            helperText: 'Overrides king-post strut profile when applicable',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(activeModule.overhangEnabled
      ? [
          {
            id: 'overhangSupportBeamProfile',
            label: 'Overhang support beam profile',
            type: 'select',
            value: activeModule.overhangSupportBeamProfile,
            onChange: (v: string | boolean) =>
              setModuleField('overhangSupportBeamProfile', v as CalculatorModuleInputs['overhangSupportBeamProfile']),
            options: [
              { label: '150x50', value: '150x50' },
              { label: '200x50', value: '200x50' },
            ],
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(showSeparateGutterToggle
      ? [
          {
            id: 'separateGutterEnabled',
            label: 'Separate gutter (100x100 cut)',
            type: 'toggle',
            value: activeModule.separateGutterEnabled,
            onChange: (v: string | boolean) => setModuleField('separateGutterEnabled', Boolean(v)),
            helperText: 'Adds separate 100x100 cut‑down gutter (stock doubled for waste)',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...gableHintFields,
    {
      id: 'postCutHeightM',
      label: 'Ledger underside height (m)',
      type: 'number',
      value: activeModule.postCutHeightM,
      onChange: (v) => setModuleField('postCutHeightM', String(v)),
      error: errors.postCutHeightM,
      helperText: 'Clear height to underside of ledger',
    },
    { id: 'postCount', label: 'Post count', type: 'number', value: activeModule.postCount, onChange: (v) => setModuleField('postCount', String(v)), error: errors.postCount },

    {
      id: 'houseConnectionType',
      label: 'House connection',
      type: 'select',
      value: activeModule.houseConnectionType,
      onChange: (v) => setModuleField('houseConnectionType', v as CalculatorModuleInputs['houseConnectionType']),
      options: [
        { label: 'Soffit', value: 'soffit' },
        { label: 'Fascia', value: 'fascia' },
        { label: 'Facade', value: 'facade' },
        { label: 'None', value: 'none' },
      ],
    },
    {
      id: 'postConnectionType',
      label: 'Post connection',
      type: 'select',
      value: activeModule.postConnectionType,
      onChange: (v) => setModuleField('postConnectionType', v as CalculatorModuleInputs['postConnectionType']),
      options: [
        { label: 'Pile (1m)', value: 'pile_1m' },
        { label: 'Pile (1.5m)', value: 'pile_1_5m' },
        { label: 'Deck bracket', value: 'deck_bracket' },
        { label: 'Slab anchors', value: 'slab_anchors' },
      ],
    },
    ...(activeModule.postConnectionType === 'pile_1m' || activeModule.postConnectionType === 'pile_1_5m'
      ? [
          {
            id: 'ground',
            label: 'Ground',
            type: 'select',
            value: activeModule.ground,
            onChange: (v: string | boolean) => setModuleField('ground', v as CalculatorModuleInputs['ground']),
            options: [
              { label: 'Easy', value: 'easy' },
              { label: 'Hard', value: 'hard' },
            ],
            helperText: 'Applies to concrete pile actions',
          } satisfies FieldSchemaItem,
        ]
      : []),
    {
      id: 'access',
      label: 'Access',
      type: 'select',
      value: values.access,
      onChange: (v) => setJobField('access', v as CalculatorInputs['access']),
      options: [
        { label: 'Easy', value: 'easy' },
        { label: 'Normal', value: 'normal' },
        { label: 'Hard', value: 'hard' },
      ],
    },
    {
      id: 'height',
      label: 'Height',
      type: 'select',
      value: values.height,
      onChange: (v) => setJobField('height', v as CalculatorInputs['height']),
      options: [
        { label: 'Single storey', value: 'single_storey' },
        { label: 'Two storey', value: 'two_storey' },
      ],
    },

    ...(activeModule.boxPerimeterEnabled
      ? [
          {
            id: 'boxPitchDeg',
            label: 'Box pitch (deg)',
            type: 'readOnly',
            value: typeof derivedBoxPitch === 'number' ? derivedBoxPitch.toFixed(1) : '—',
            helperText: 'Computed from max fall envelope',
          } satisfies FieldSchemaItem,
          {
            id: 'boxRiseMm',
            label: 'Box fall (mm)',
            type: 'readOnly',
            value: typeof derivedBoxRiseMm === 'number' ? derivedBoxRiseMm.toFixed(0) : '—',
            helperText:
              typeof derivedBoxMaxFallMm === 'number' ? `Max allowed: ${Math.round(derivedBoxMaxFallMm)}mm` : 'Max allowed: 200mm',
          } satisfies FieldSchemaItem,
          {
            id: 'boxGutterHouseEdge',
            label: 'House edge gutter',
            type: 'select',
            value: activeModule.boxGutterHouseEdge,
            onChange: (v: string | boolean) => setModuleField('boxGutterHouseEdge', v as CalculatorModuleInputs['boxGutterHouseEdge']),
            options: [
              { label: 'House gutter', value: 'house' },
              { label: 'Our gutter', value: 'our' },
              { label: 'None', value: 'none' },
            ],
          } satisfies FieldSchemaItem,
          {
            id: 'boxGutterFarEdge',
            label: 'Far edge gutter',
            type: 'select',
            value: activeModule.boxGutterFarEdge,
            onChange: (v: string | boolean) => setModuleField('boxGutterFarEdge', v as CalculatorModuleInputs['boxGutterFarEdge']),
            options: [
              { label: 'House gutter', value: 'house' },
              { label: 'Our gutter', value: 'our' },
              { label: 'None', value: 'none' },
            ],
          } satisfies FieldSchemaItem,
        ]
      : []),

    {
      id: 'downpipeCount',
      label: 'Downpipes (count)',
      type: 'number',
      value: activeModule.downpipeCount,
      onChange: (v: string | boolean) => setModuleField('downpipeCount', String(v)),
      error: errors.downpipeCount,
      helperText: activeModule.boxPerimeterEnabled
        ? 'Default 1 when any "our" gutter edge is set'
        : 'Default 1 when any "our" gutter is used',
    } satisfies FieldSchemaItem,
    {
      id: 'downpipeJoinCount',
      label: 'DP joins',
      type: 'select',
      value: activeModule.downpipeJoinCount,
      onChange: (v: string | boolean) => setModuleField('downpipeJoinCount', String(v)),
      options: DP_JOIN_OPTIONS,
      error: errors.downpipeJoinCount,
      helperText: 'Joins/couplers for downpipe sections (10 min each).',
    } satisfies FieldSchemaItem,
    ...(hasOurGutterUi
      ? [
          {
            id: 'downpipeElbowCount',
            label: 'DP elbows',
            type: 'select',
            value: activeModule.downpipeElbowCount,
            onChange: (v: string | boolean) => setModuleField('downpipeElbowCount', String(v)),
            options: DP_ELBOW_OPTIONS,
            error: errors.downpipeElbowCount,
            helperText: 'Elbows/fittings (10 min each). Only applicable when our gutter is used.',
          } satisfies FieldSchemaItem,
        ]
      : []),

    {
      id: 'blindsList',
      label: 'Blinds',
      type: 'custom',
      content: blindsListContent,
      helperText: `${blindsState.items.length} blind${blindsState.items.length === 1 ? '' : 's'} · totals update live`,
    },

    {
      id: 'travelExGst',
      label: 'Travel (ex‑GST)',
      type: 'number',
      value: values.travelExGst,
      onChange: (v) => setJobField('travelExGst', String(v)),
    },
    {
      id: 'extrasAllowanceExGst',
      label: 'Extras allowance (ex‑GST)',
      type: 'number',
      value: values.extrasAllowanceExGst,
      onChange: (v) => setJobField('extrasAllowanceExGst', String(v)),
    },
    {
      id: 'quoteDiscountPct',
      label: 'Discount (%)',
      type: 'number',
      value: values.quoteDiscountPct,
      onChange: (v) => setJobField('quoteDiscountPct', String(v)),
      helperText: 'Quote-only (not in true cost)',
    },

    // === Computed outputs ===
    { id: 'areaM2', label: 'Area (m²)', type: 'readOnly', value: formatMaybeNumber(derivedArea) },
    { id: 'roofAreaM2', label: 'Roof area (m²)', type: 'readOnly', value: formatMaybeNumber(derivedRoofArea) },
    { id: 'acrylicAreaM2', label: 'Acrylic area (m²)', type: 'readOnly', value: formatMaybeNumber(derivedAcrylicArea) },
    { id: 'timberAreaM2', label: 'Timber area (m²)', type: 'readOnly', value: formatMaybeNumber(derivedTimberArea) },
    { id: 'acrylicBaysTotal', label: 'Acrylic bays total', type: 'readOnly', value: typeof derivedAcrylicBaysTotal === 'number' ? String(derivedAcrylicBaysTotal) : '—' },
    { id: 'pitchUsed', label: 'Pitch used (deg)', type: 'readOnly', value: typeof derivedPitchUsed === 'number' ? derivedPitchUsed.toFixed(0) : '—' },
    { id: 'slopeLengthM', label: 'Slope length (m)', type: 'readOnly', value: formatMaybeNumber(derivedSlopeLength) },
    { id: 'roofingProcurement', label: 'Roofing', type: 'readOnly', value: moduleResult ? roofingProcurementSummary : '—' },
    {
      id: 'rafters',
      label: 'Rafters',
      type: 'readOnly',
      value: rafterCountTotal && rafterProfile ? `${rafterCountTotal} × ${rafterProfile}` : '—',
      helperText: rafterHelperText,
    },
    { id: 'brackets', label: 'Brackets', type: 'readOnly', value: typeof bracketCount === 'number' ? String(bracketCount) : '—' },
    { id: 'crewHours', label: 'Crew hours', type: 'readOnly', value: typeof crewHours === 'number' ? String(crewHours) : '—' },
    { id: 'materialsEx', label: 'Materials (ex‑GST)', type: 'readOnly', value: formatMaybeMoney(materialsEx) },
    { id: 'installEx', label: 'Install payout (ex‑GST)', type: 'readOnly', value: formatMaybeMoney(installEx) },
    { id: 'overheadEx', label: 'Overhead (ex‑GST)', type: 'readOnly', value: formatMaybeMoney(overheadEx) },
    { id: 'totalEx', label: 'Total true cost (ex‑GST)', type: 'readOnly', value: formatMaybeMoney(totalEx) },
    { id: 'totalInc', label: 'Total true cost (inc‑GST)', type: 'readOnly', value: formatMaybeMoney(totalInc) },
    { id: 'blindsTotalEx', label: 'Blinds (ex‑GST)', type: 'readOnly', value: formatMaybeMoney(addonsTotals.blinds.ex) },
    { id: 'blindsTotalInc', label: 'Blinds (inc‑GST)', type: 'readOnly', value: formatMaybeMoney(addonsTotals.blinds.inc) },
    { id: 'coreTotalEx', label: 'Total (ex‑GST)', type: 'readOnly', value: formatMaybeMoney(coreTotalEx) },
    { id: 'coreTotalInc', label: 'Total (inc‑GST)', type: 'readOnly', value: formatMaybeMoney(coreTotalInc) },
    ...(issuesCount
      ? [
          {
            id: 'issues',
            label: 'Issues',
            type: 'action',
            actionLabel: `Errors (${issuesCount})`,
            onAction: () => setIssuesOpen(true),
            helperText: 'Click to jump to missing fields',
          } satisfies FieldSchemaItem,
        ]
      : []),
    {
      id: 'warnings',
      label: 'Warnings',
      type: 'readOnly',
      value: result ? String(warningsCount) : '—',
      helperText:
        warningsCount && criticalWarnings.length
          ? `Critical: ${criticalWarnings.length} (blocks estimate)`
          : warningsCount
            ? 'Review in Generate modal'
            : undefined,
    },
    {
      id: 'generate-estimate',
      label: 'Estimate',
      type: 'action',
      actionLabel: generateLabel,
      onAction: async () => {
        setGenerateError(null);

        if (!projectId) {
          setGenerateError('Select a project first (use Projects in the header).');
          return;
        }
        if (!project) {
          setGenerateError('Project not found.');
          return;
        }
        if (!readyToCalculate) {
          setGenerateError('Fix validation errors before generating.');
          return;
        }
        if (isCalculating) {
          setGenerateError('Please wait for calculation to finish.');
          return;
        }
        if (engineError) {
          setGenerateError('Fix cost engine error before generating.');
          return;
        }
        if (!result) {
          setGenerateError('No calculated result yet.');
          return;
        }

        setConfirmReady(false);
        setConfirmAcknowledgeWarnings(false);
        setConfirmOpen(true);
      },
      helperText: projectId ? 'Create immutable snapshot' : 'Requires project context',
      error: generateError ?? undefined,
      disabled: isGenerating,
    },
  ];

  const warningsField = schema.find((field) => field.id === 'warnings') ?? null;
  const generateField = schema.find((field) => field.id === 'generate-estimate') ?? null;
  const schemaWithoutFooter = schema.filter((field) => field.id !== 'warnings' && field.id !== 'generate-estimate');

  const schemaMap = useMemo(() => new Map(schema.map((field) => [field.id, field])), [schema]);
  const pickFields = (ids: string[]): FieldSchemaItem[] =>
    ids
      .map((id) => schemaMap.get(id))
      .filter(Boolean) as FieldSchemaItem[];

  const contextFields = pickFields([
    'engine-status',
    'project-context',
    'draft-notice',
    'projectName',
    'quoteRef',
    'moduleIndex',
    'addModule',
    'removeModule',
  ]);

  const structureFields = pickFields([
    'pergolaStyle',
    'boxPerimeterEnabled',
    'roofMaterial',
    'mixedAcrylicBaysMain',
    'mixedAcrylicBaysA',
    'mixedAcrylicBaysB',
    'timberSystemHeading',
    'timberNoteRafters',
    'timberNotePurlins',
    'timberNoteEdgeRafters',
    'timberRoofAboveType',
    'timberInsulatedPanelThicknessMm',
    'timberTrayWidthMm',
    'extrusionColour',
    'powdercoatStandardColour',
    'powdercoatIsCustom',
    'powdercoatCustomColour',
    'lengthM',
    'projectionM',
    'roofOrientation',
    'hipCornerLengthBM',
    'hipCornerProjectionBM',
    'roofPitchDeg',
    'gableEndFramesMode',
    'invertedEnabled',
    'invertedHouseGutter',
    'overhangEnabled',
    'overhangAmountM',
    'perSideSpanM',
    'slopedLengthPerSideM',
    'postCutHeightM',
    'postCount',
    'boxPitchDeg',
    'boxRiseMm',
    'boxGutterHouseEdge',
    'boxGutterFarEdge',
    'downpipeCount',
    'downpipeJoinCount',
    'downpipeElbowCount',
  ]);

  const overrideFields = pickFields([
    'ledgerProfileOverride',
    'rafterProfileOverride',
    'postProfileOverride',
    'frontBeamProfileOverride',
    'ridgeBeamProfileOverride',
    'tieBeamProfileOverride',
    'strutProfileOverride',
    'boxPerimeterBeamProfileOverride',
    'overhangSupportBeamProfile',
    'separateGutterEnabled',
  ]);

  const blindFields = pickFields(['blindsList']);

  const connectionFields = pickFields(['houseConnectionType', 'postConnectionType', 'ground', 'access', 'height']);

  const allowanceFields = pickFields(['travelExGst', 'extrasAllowanceExGst', 'quoteDiscountPct']);

  const bomPreview = useMemo(() => {
    const lines = result?.materials?.lines ?? [];
    if (!Array.isArray(lines) || lines.length === 0) return [];
    return lines
      .slice()
      .sort((a, b) => (b.line_cost_ex_gst ?? 0) - (a.line_cost_ex_gst ?? 0))
      .slice(0, 10);
  }, [result]);

  const labourPreview = useMemo(() => {
    const actions = result?.install?.actions ?? [];
    if (!Array.isArray(actions) || actions.length === 0) return [];
    return actions.slice().sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));
  }, [result]);

  const [gridHeightPx, setGridHeightPx] = useState(0);

  useLayoutEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return;

    let raf = 0;

    const compute = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const computedStyles = window.getComputedStyle(gridEl);

        const pagePad = Number.parseFloat(computedStyles.getPropertyValue('--page-pad')) || 8;
        const tileMinHeight = Number.parseFloat(computedStyles.getPropertyValue('--tile-min-height')) || 100;

        const rect = gridEl.getBoundingClientRect();
        const availableHeight = Math.max(tileMinHeight, window.innerHeight - rect.top - pagePad);
        setGridHeightPx((prev) => (prev === availableHeight ? prev : availableHeight));
      });
    };

    const ro = new ResizeObserver(compute);
    ro.observe(gridEl);
    window.addEventListener('resize', compute);
    compute();

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <main className={previewLayoutEnabled ? `${styles.page} ${styles.previewPage}` : styles.page}>
      <h1 className="visually-hidden">Calculator</h1>

      {previewLayoutEnabled ? (
        <div className={styles.previewFrame}>
          <div className={styles.split}>
            <div className={styles.leftCol}>
              <FieldGroup title="Context" fields={contextFields} />
              <FieldGroup title="Structure" fields={structureFields} />
              <FieldGroup title="Overrides" fields={overrideFields} />
              <FieldGroup title="Blinds" fields={blindFields} />
              <FieldGroup title="Connections & Site" fields={connectionFields} />
              <FieldGroup title="Allowances" fields={allowanceFields} />
            </div>

            <aside className={styles.rightCol} aria-label="Preview outputs">
              <div className={styles.previewSummary}>
                <div className={styles.previewSummaryHeader}>
                  <div>
                    <div className={styles.previewSummaryTitle}>Preview</div>
                    <div className={styles.previewSummarySub}>
                      {isCalculating ? 'Calculating…' : engineError ? 'Engine error' : result ? 'Live' : 'Waiting for inputs'}
                    </div>
                  </div>
                  {issuesCount ? (
                    <button type="button" className={styles.previewIssueButton} onClick={() => setIssuesOpen(true)}>
                      Errors ({issuesCount})
                    </button>
                  ) : null}
                </div>

                <div className={styles.previewStatGrid}>
                  <PreviewStat label="Total (ex‑GST)" value={formatMaybeMoney(coreTotalEx)} />
                  <PreviewStat label="Total (inc‑GST)" value={formatMaybeMoney(coreTotalInc)} />
                  <PreviewStat label="Materials" value={formatMaybeMoney(materialsEx)} />
                  <PreviewStat label="Install payout" value={formatMaybeMoney(installEx)} />
                  <PreviewStat label="Overhead" value={formatMaybeMoney(overheadEx)} />
                  <PreviewStat label="Crew hours" value={formatMaybeNumber(crewHours)} />
                  <PreviewStat label="Install days" value={formatMaybeNumber(crewDays, 0)} />
                </div>

                <div className={styles.previewCard} style={{ marginTop: 12, padding: 10, background: 'rgba(15, 15, 16, 0.02)' }}>
                  <div className={styles.previewCardTitle} style={{ marginBottom: 6 }}>
                    Add‑ons (informational)
                  </div>
                  <div className={styles.previewRow}>
                    <span className={styles.previewRowLabel}>Blinds (ex‑GST)</span>
                    <span className={styles.previewRowValue}>{formatMaybeMoney(addonsTotals.blinds.ex)}</span>
                  </div>
                  <div className={styles.previewRow}>
                    <span className={styles.previewRowLabel}>Blinds (inc‑GST)</span>
                    <span className={styles.previewRowValue}>{formatMaybeMoney(addonsTotals.blinds.inc)}</span>
                  </div>
                </div>

                {generateField ? (
                  <div className={styles.previewActions}>
                    <button
                      type="button"
                      className={styles.previewPrimaryAction}
                      onClick={generateField.onAction}
                      disabled={generateField.disabled}
                    >
                      {generateField.actionLabel ?? 'Generate'}
                    </button>
                    {generateField.error ? <p className={styles.previewError}>{generateField.error}</p> : null}
                  </div>
                ) : null}
              </div>

              <section className={styles.previewCard} aria-label="Warnings">
                <h2 className={styles.previewCardTitle}>Warnings</h2>
                {warningsTyped.length ? (
                  <ul className={styles.previewList}>
                    {warningsTyped.map((warn, idx) => (
                      <li key={`${warn.level}-${idx}`} className={warn.level === 'critical' ? styles.previewWarnCritical : undefined}>
                        {warn.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.previewMuted}>No warnings yet.</p>
                )}
              </section>

              <section className={styles.previewCard} aria-label="BOM preview">
                <h2 className={styles.previewCardTitle}>BOM preview</h2>
                {bomPreview.length ? (
                  <div className={styles.previewTable}>
                    {bomPreview.map((line) => (
                      <div key={`${line.id}-${line.label}`} className={styles.previewRow}>
                        <div className={styles.previewRowMain}>
                          <div className={styles.previewRowLabel}>{line.label}</div>
                          <div className={styles.previewRowMeta}>
                            {formatMaybeNumber(line.qty, 2)} {line.unit}
                          </div>
                        </div>
                        <div className={styles.previewRowValue}>{formatMaybeMoney(line.line_cost_ex_gst)}</div>
                      </div>
                    ))}
                    <div className={styles.previewRowTotal}>
                      <span>Total materials (ex‑GST)</span>
                      <span>{formatMaybeMoney(materialsEx)}</span>
                    </div>
                  </div>
                ) : (
                  <p className={styles.previewMuted}>No BOM yet.</p>
                )}
              </section>

              <details className={styles.previewDetails}>
                <summary>Labour breakdown</summary>
                {labourPreview.length ? (
                  <div className={styles.previewTable}>
                    {labourPreview.map((action) => (
                      <div key={action.id} className={styles.previewRow}>
                        <div className={styles.previewRowMain}>
                          <div className={styles.previewRowLabel}>{action.label}</div>
                          <div className={styles.previewRowMeta}>
                            {action.category} · {formatMaybeNumber(action.qty, 2)} {action.unit}
                          </div>
                        </div>
                        <div className={styles.previewRowValue}>{formatMaybeNumber(action.minutes, 0)} min</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.previewMuted}>No labour actions yet.</p>
                )}
              </details>

              <details className={styles.previewDetails}>
                <summary>Structure outputs</summary>
                <div className={styles.previewTable}>
                  <PreviewRow label="Area (m²)" value={formatMaybeNumber(derivedArea)} />
                  <PreviewRow label="Roof area (m²)" value={formatMaybeNumber(derivedRoofArea)} />
                  <PreviewRow label="Acrylic area (m²)" value={formatMaybeNumber(derivedAcrylicArea)} />
                  <PreviewRow label="Timber area (m²)" value={formatMaybeNumber(derivedTimberArea)} />
                  <PreviewRow label="Pitch used (deg)" value={typeof derivedPitchUsed === 'number' ? derivedPitchUsed.toFixed(0) : '—'} />
                  <PreviewRow label="Slope length (m)" value={formatMaybeNumber(derivedSlopeLength)} />
                  <PreviewRow label="Rafters" value={rafterCountTotal && rafterProfile ? `${rafterCountTotal} × ${rafterProfile}` : '—'} />
                  <PreviewRow label="Brackets" value={typeof bracketCount === 'number' ? String(bracketCount) : '—'} />
                </div>
              </details>
            </aside>
          </div>
        </div>
      ) : (
        <div
          ref={gridRef}
          className={styles.grid}
          role="form"
          aria-label="Calculator inputs"
          style={gridHeightPx ? { height: `${gridHeightPx}px` } : undefined}
        >
          {schemaWithoutFooter.map((field) => (
            <FieldTile
              key={field.id}
              id={field.id}
              label={field.label}
              type={field.type}
              value={field.value}
              content={field.content}
              onChange={field.onChange}
              options={field.options}
              disabled={field.disabled}
              helperText={field.helperText}
              error={field.error}
              onAction={field.onAction}
              actionLabel={field.actionLabel}
            />
          ))}

          {warningsField ? (
            <FieldTile
              key={warningsField.id}
              id={warningsField.id}
              label={warningsField.label}
              type={warningsField.type}
              value={warningsField.value}
              content={warningsField.content}
              onChange={warningsField.onChange}
              options={warningsField.options}
              disabled={warningsField.disabled}
              helperText={warningsField.helperText}
              error={warningsField.error}
              onAction={warningsField.onAction}
              actionLabel={warningsField.actionLabel}
            />
          ) : null}

          {generateField ? (
            <FieldTile
              key={generateField.id}
              id={generateField.id}
              label={generateField.label}
              type={generateField.type}
              value={generateField.value}
              content={generateField.content}
              onChange={generateField.onChange}
              options={generateField.options}
              disabled={generateField.disabled}
              helperText={generateField.helperText}
              error={generateField.error}
              onAction={generateField.onAction}
              actionLabel={generateField.actionLabel}
            />
          ) : null}
        </div>
      )}

	      {issuesOpen ? (
	        <Modal
	          open
	          ariaLabel="Validation issues"
	          onClose={() => setIssuesOpen(false)}
	          overlayClassName={styles.modalOverlay}
	          panelClassName={styles.modal}
	          maxWidthPx={720}
	        >
	          <div className={styles.modalHeader}>
	            <div>
	              <h2 className={styles.modalTitle}>Issues</h2>
	              <p className={styles.modalSubtitle}>Click an item to jump to the missing field.</p>
	            </div>
	            <button type="button" className={styles.modalClose} onClick={() => setIssuesOpen(false)}>
	              Close
	            </button>
	          </div>

	          <div className={styles.modalBody}>
	            <section className={styles.modalSection} aria-label="Validation errors">
	              <h3 className={styles.modalSectionTitle}>Errors</h3>
	              {issues.length ? (
	                <ul className={styles.issuesList}>
	                  {issues.map((issue) => (
	                    <li key={`${issue.moduleIndex}-${issue.fieldId}`}>
	                      <button
	                        type="button"
	                        className={styles.issueRow}
	                        onClick={() => {
	                          pendingIssueFocusRef.current = { moduleIndex: issue.moduleIndex, fieldId: issue.fieldId };
	                          setActiveModuleIndex(issue.moduleIndex);
	                          setIssuesOpen(false);
	                        }}
	                      >
	                        <div className={styles.issueMain}>
	                          <div className={styles.issueTitle}>{`Module ${issue.moduleIndex + 1} · ${issue.label}`}</div>
	                          <div className={styles.issueMessage}>{issue.message}</div>
	                        </div>
	                        <span className={styles.issueJump}>Jump</span>
	                      </button>
	                    </li>
	                  ))}
	                </ul>
	              ) : (
	                <p className={styles.modalNote}>No validation errors.</p>
	              )}
	            </section>
	          </div>
	        </Modal>
	      ) : null}

	      {confirmOpen ? (
	        <Modal
	          open
	          ariaLabel="Generate estimate confirmation"
	          onClose={() => {
	            setConfirmOpen(false);
	            setGenerateError(null);
	          }}
	          overlayClassName={styles.modalOverlay}
	          panelClassName={styles.modal}
	          maxWidthPx={720}
	        >
	          <div className={styles.modalHeader}>
	            <div>
	              <h2 className={styles.modalTitle}>Generate estimate</h2>
	              <p className={styles.modalSubtitle}>This will create an immutable snapshot for this project.</p>
	            </div>
	            <button
	              type="button"
	              className={styles.modalClose}
	              onClick={() => {
	                setConfirmOpen(false);
	                setGenerateError(null);
	              }}
	            >
	              Close
	            </button>
	          </div>

            <div className={styles.modalBody}>
              <section className={styles.modalSection} aria-label="Inputs summary">
                <h3 className={styles.modalSectionTitle}>Inputs</h3>
                <div className={styles.modalGrid}>
                  <div>
                    <div className={styles.modalKey}>Modules</div>
                    <div className={styles.modalVal}>{values.modules.length}</div>
                  </div>
                  <div>
                    <div className={styles.modalKey}>Active module</div>
                    <div className={styles.modalVal}>
                      {`Module ${activeModuleIndex + 1}: ${activeModule.pergolaStyle}`}
                      {activeModule.boxPerimeterEnabled ? ' + box perimeter' : ''}
                    </div>
                  </div>
                  <div>
                    <div className={styles.modalKey}>Roof length / roof span</div>
                    <div className={styles.modalVal}>
                      {activeModule.pergolaStyle === 'hip_corner'
                        ? `A: ${activeModule.lengthM}×${activeModule.projectionM}m, B: ${activeModule.hipCornerLengthBM}×${activeModule.hipCornerProjectionBM}m`
                        : `${activeModule.lengthM}m × ${activeModule.projectionM}m`}
                    </div>
                  </div>
                  <div>
                    <div className={styles.modalKey}>Roof material</div>
                    <div className={styles.modalVal}>{activeModule.roofMaterial}</div>
                  </div>
                  <div>
                    <div className={styles.modalKey}>Roof pitch</div>
                    <div className={styles.modalVal}>
                      {typeof derivedPitchUsed === 'number'
                        ? `${derivedPitchUsed.toFixed(0)}°`
                        : activeModule.roofPitchDeg.trim()
                          ? `${activeModule.roofPitchDeg}°`
                          : '—'}
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.modalSection} aria-label="Outputs summary">
                <h3 className={styles.modalSectionTitle}>Outputs</h3>
                <div className={styles.modalGrid}>
                  <div>
                    <div className={styles.modalKey}>Materials (ex‑GST)</div>
                    <div className={styles.modalVal}>{formatMaybeMoney(materialsEx)}</div>
                  </div>
                  <div>
                    <div className={styles.modalKey}>Install payout (ex‑GST)</div>
                    <div className={styles.modalVal}>{formatMaybeMoney(installEx)}</div>
                  </div>
                  <div>
                    <div className={styles.modalKey}>Overhead (ex‑GST)</div>
                    <div className={styles.modalVal}>{formatMaybeMoney(overheadEx)}</div>
                  </div>
                  <div>
                    <div className={styles.modalKey}>Total (ex‑GST)</div>
                    <div className={styles.modalVal}>{formatMaybeMoney(coreTotalEx)}</div>
                  </div>
                  <div>
                    <div className={styles.modalKey}>Blinds (ex‑GST)</div>
                    <div className={styles.modalVal}>{formatMaybeMoney(addonsTotals.blinds.ex)}</div>
                  </div>
                </div>
              </section>

              <section className={styles.modalSection} aria-label="Warnings">
                <h3 className={styles.modalSectionTitle}>Warnings</h3>
                {warningsTyped.length ? (
                  <>
                    {criticalWarnings.length ? (
                      <>
                        <div className={styles.modalKey} style={{ marginBottom: 6, color: 'rgb(185, 28, 28)' }}>
                          Critical (blocks generation)
                        </div>
                        <ul className={styles.modalWarnings}>
                          {criticalWarnings.map((w, idx) => (
                            <li key={`c-${idx}`}>{w.message}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {infoWarnings.length ? (
                      <>
                        <div className={styles.modalKey} style={{ marginTop: 10, marginBottom: 6 }}>
                          Info
                        </div>
                        <ul className={styles.modalWarnings}>
                          {infoWarnings.map((w, idx) => (
                            <li key={`i-${idx}`}>{w.message}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </>
                ) : (
                  <p className={styles.modalNote}>No warnings for this estimate.</p>
                )}
              </section>

              {infoWarnings.length ? (
                <label className={styles.modalCheckboxRow}>
                  <input
                    type="checkbox"
                    checked={confirmAcknowledgeWarnings}
                    onChange={(e) => setConfirmAcknowledgeWarnings(e.target.checked)}
                  />
                  <span>I acknowledge the warnings</span>
                </label>
              ) : null}

              <label className={styles.modalCheckboxRow}>
                <input type="checkbox" checked={confirmReady} onChange={(e) => setConfirmReady(e.target.checked)} />
                <span>I confirm this estimate is ready to generate</span>
              </label>

              {generateError ? <p className={styles.modalError}>{generateError}</p> : null}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalButtonSecondary}
                onClick={() => {
                  setConfirmOpen(false);
                  setGenerateError(null);
                }}
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalButtonPrimary}
                disabled={
                  criticalWarnings.length > 0 ||
                  !confirmReady ||
                  (infoWarnings.length > 0 && !confirmAcknowledgeWarnings) ||
                  isGenerating
                }
                onClick={async () => {
                  setGenerateError(null);

                  const fail = (msg: string) => {
                    setGenerateError(msg);
                    toast.error(msg);
                  };

                  if (!projectId) {
                    fail('Select a project first.');
                    return;
                  }
                  if (!project) {
                    fail('Project not found.');
                    return;
                  }
                  if (!result) {
                    fail('No calculated result yet.');
                    return;
                  }

                  setIsGenerating(true);
                  try {
                    if (criticalWarnings.length > 0) {
                      fail('Resolve critical warnings before generating.');
                      return;
                    }

                    const derivedSnapshot = moduleResult?.derived ?? result.modules[0]?.derived;
                    if (!derivedSnapshot) {
                      fail('No derived result available for the active module.');
                      return;
                    }

                    const meta = await getCostingMeta();
                    const contact = project.contactId ? await getContact(project.contactId) : null;
                    if (!contact) {
                      fail('Project is missing a contact (open the project and select/create one).');
                      return;
                    }

                    const projectNameSnapshot = project.projectName ?? project.name ?? values.projectName;
                    if (!projectNameSnapshot.trim()) {
                      fail('Project name is missing.');
                      return;
                    }

                    const estimate = await createEstimate(projectId, {
                      status: 'draft',
                      inputs: values,
                      derived: derivedSnapshot as any,
                      projectSnapshot: {
                        ...project,
                        updatedAt: project.updatedAt ?? project.createdAt,
                      },
                      snapshot: {
                        contact: {
                          displayName: contact.displayName,
                          email: contact.email,
                          phone: contact.phone,
                        },
                        project: {
                          projectName: projectNameSnapshot,
                          region: project.region,
                          siteAddress: project.siteAddress ?? project.address,
                          quoteRef: project.quoteRef,
                        },
                      },
                      outputs: {
                        materials: result.materials,
                        install: result.install,
                        overhead: result.overhead,
                        totals: result.totals,
                        warnings: warningsTyped,
                      },
                      configVersions: meta.configVersions,
                    });

                    await addProjectActivity(projectId, {
                      type: 'estimate_generated',
                      message: `Estimate v${estimate.version ?? '—'} generated (ex-GST: ${formatMoney(result.totals.cost_ex_gst)})`,
                      meta: { estimateId: estimate.id },
                    });

                    setConfirmOpen(false);
                    toast.success(`Estimate created (v${estimate.version ?? '—'}).`);
                    if (projectId) {
                      router.push(
                        `/staff/projects/${encodeURIComponent(projectId)}?tab=estimates&estimateId=${encodeURIComponent(estimate.id)}`,
                      );
                    }
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Failed to generate estimate';
                    setGenerateError(msg);
                    toast.error(msg);
                  } finally {
                    setIsGenerating(false);
                  }
                }}
              >
                Generate estimate
              </button>
            </div>
	        </Modal>
	      ) : null}
    </main>
  );
}

function FieldGroup({ title, fields }: { title: string; fields: FieldSchemaItem[] }) {
  if (!fields.length) return null;
  return (
    <section className={styles.previewCard} aria-label={title}>
      <h2 className={styles.previewCardTitle}>{title}</h2>
      <div className={styles.previewFieldGrid}>
        {fields.map((field) => (
          <FieldTile
            key={field.id}
            id={field.id}
            label={field.label}
            type={field.type}
            value={field.value}
            content={field.content}
            onChange={field.onChange}
            options={field.options}
            disabled={field.disabled}
            helperText={field.helperText}
            error={field.error}
            onAction={field.onAction}
            actionLabel={field.actionLabel}
          />
        ))}
      </div>
    </section>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.previewStat}>
      <span className={styles.previewStatLabel}>{label}</span>
      <span className={styles.previewStatValue}>{value}</span>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.previewRow}>
      <span className={styles.previewRowLabel}>{label}</span>
      <span className={styles.previewRowValue}>{value}</span>
    </div>
  );
}
