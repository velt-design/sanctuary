'use client';

import type { AttachmentSide, CostInputsV1, CostOutputV1, MaterialsExplainV1, RoofType, SiteInputsV1, SiteOutputV1 } from '@sp/costing';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import FieldTile, { type FieldOption, type FieldTileType } from './FieldTile';
import styles from './CalculatorGrid.module.css';
import type {
  BlindFabric as BlindFabricInput,
  BlindLineItem,
  BlindSystemType as BlindSystemInput,
  CalculatorBlindsState,
  CalculatorHouseFootprintParams,
  CalculatorFlashingBand,
  CalculatorFlashingPurpose,
  CalculatorFlashingsState,
  CalculatorInputs,
  CalculatorModuleInputs,
  CalculatorPergola,
  InfillLineItem,
} from '@/lib/types/calculator';
import {
  isCalculatorInputsV2,
  normalizeAttachmentSide,
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPreset,
  supportsHouseFootprints,
} from '@/lib/types/calculator';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { Project } from '@/lib/types/project';
import { apiJson } from '@/lib/repo/apiClient';
import { getProject } from '@/lib/repo/projectsRepo';
import { duplicateEstimateToDraft } from '@/lib/repo/estimatesRepo';
import type { DesignRequestPriorityTier } from '@/lib/designPackages/types';
import { useToast } from '@/components/ui/toast/ToastProvider';
import Modal from '@/components/ui/modal/Modal';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import RoofOrientationDiagram from './RoofOrientationDiagram';
import ConfirmDialog from './ConfirmDialog';
import InfillPreview from './InfillPreview';
import InfillActionsMenu from './InfillActionsMenu';
import InfillSectionNav, { type InfillEditorSectionId } from './InfillSectionNav';
import DuplicateDialog from './DuplicateDialog';
import InfillCutList from './InfillCutList';
import ResolveWarningsPanel from './ResolveWarningsPanel';
import PriceImpactPanel from './PriceImpactPanel';
import QuoteStatusCard, { type StatusItem } from './QuoteStatusCard';
import ModuleViewsCard, {
  canEditHouseFootprintPlan,
  type HouseFootprintEditorDragMeta,
  type HouseFootprintHandleId,
  type ModuleViewsStatus,
  type ModuleViewsTab,
} from './ModuleViewsCard';
import { buildModulePlanModel, buildModuleSectionModel } from './moduleViews';
import { useInfillClipboard } from './useInfillClipboard';
import { useInfillHotkeys } from './useInfillHotkeys';
import { trackInfillEvent } from './infillTelemetry';
import { buildImpactDiff, type ImpactDiff } from './diff';
import { buildAddonsTotals, computeDisplayTotals } from './calcTotals';
import {
  applyAcrylicVariantToInfillPayload,
  buildModulePayloadWithInfills,
  diffModuleCost,
  fetchModuleCost,
  removeInfillFromInfills,
  replaceInfillInPayload,
} from './infillDecision';
import {
  normalizeMonoSlopeAnchor,
  normalizeMonoSlopeMode,
  resolveMonoSlopeShape,
  resolveInfillUiState,
  infillFieldId,
  type InfillDraftEntry,
  type InfillDraftFieldKey,
  type InfillWarningFix,
  type InfillUiState,
  type InfillWarningItem,
} from './infillCompute';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { qk } from '@/lib/queries/keys';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import {
  type EstimateSaveMode,
  buildSiteInputsFromCalculatorInputs,
  deriveSiteResultWarnings,
} from '@/lib/estimates/costingPayload';
import {
  buildCalculatorDraftEntityKey,
  buildEstimateEntityKey,
  isLocalEstimateId,
} from '@/lib/localFirst/portalEntities';
import {
  ensureLocalFirstStoreReady,
  getLocalFirstWorkingCopy,
  resolveLocalFirstId,
  writeLocalFirstWorkingCopy,
} from '@/lib/localFirst/store';
import {
  buildInfillItemsForPreset,
  buildInfillPreset,
  calculatorDraftSessionKey,
  calculatorInputsFromEstimateDetail,
  clampInt,
  computeBayCountsForModule,
  computeHasOurGutter,
  defaultMixedAcrylicBays,
  formatFlashingLengthInput,
  formatInputNumber,
  getPergolaLabel,
  getPitchForModule,
  getRoofTypeForModule,
  isGutterBeamProfile,
  isPrimaryFlashingLengthAutoLinked,
  makeBlindId,
  makeDefaultBlindItem,
  makeDefaultBlinds,
  makeDefaultInfillItem,
  makeDefaultModule,
  makeDefaultPrimaryFlashingRow,
  makeFlashingId,
  makeInfillId,
  nextPergola,
  normalizeBlindsStateForUi,
  normalizeCalculatorInputsForUi,
  normalizeFlashingBand,
  normalizeFlashingPurpose,
  normalizeFlashingsStateForUi,
  normalizeInfillsStateForUi,
  normalizeOverrideValue,
  normalizePanelOrientation,
  normalizePergolasForUi,
  prunePergolasForModules,
  roofLengthForPrimaryFlashing,
  toNonNegativeInt,
  toNumber,
  type CalculatorDraftSessionSnapshot,
  type InfillPresetKey,
} from './calculatorInputs';
import {
  designRequestTierFromTotal,
} from './calculatorSaveWorkflow';
import { saveCalculatorEstimate } from './calculatorEstimateSave';
import {
  INFILL_DELETE_UNDO_MS,
  INFILL_PRESETS,
  acrylicSourceLabel,
  estimateRoofRafterSpacing,
  locationLabel,
  maxCentreForAcrylicSource,
  maxRunForAcrylicSource,
  parseInfillsForPayload,
  type InfillUiEstimate,
} from './calculatorInfillUi';
import {
  buildCalculatorInfillSummary,
  buildSelectedInfillSummaryCopy,
} from './calculatorInfillSummary';
import {
  FLASHING_BAND_OPTIONS,
  FLASHING_PURPOSE_OPTIONS,
  buildFlashingDefaultsForModule,
  calculateFlashingTotalLength,
  calculateFlashingTotalsByBand,
  isDuplicatePrimaryFlashingRow,
  selectVisibleFlashingBands,
} from './calculatorFlashingUi';
import {
  BLIND_FABRIC_OPTIONS,
  BLIND_SYSTEM_OPTIONS,
  buildCalculatorBlindsUi,
} from './calculatorBlindUi';
import {
  buildCalculatorQuoteStatusUi,
  buildCalculatorUiWarnings,
  groupCalculatorUiWarnings,
  resolveGenerateDesignPreflight,
  type CalculatorQuoteStatusActionKey,
} from './calculatorQuoteStatusUi';
import {
  CalculatorInfillRail,
  CalculatorInfillTile,
  InfillAddButton,
  InfillPresetMenu,
} from './CalculatorInfillOverview';
import CalculatorSaveDialogs, { type CalculatorIssue, type SaveDialogSummary } from './CalculatorSaveDialogs';

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

type MaterialsExplainApiResponse = {
  output: {
    materials: {
      lines: Array<{
        id: string;
        label: string;
        unit: string;
        qty: number;
        unit_cost_ex_gst: number;
        line_cost_ex_gst: number;
      }>;
    };
  };
  materials_explain: MaterialsExplainV1;
};

type HouseFootprintDragSession = HouseFootprintEditorDragMeta & {
  pointerId: number;
  startSvgX: number;
  startSvgY: number;
  startParams: CalculatorHouseFootprintParams;
};

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

function formatMaybeMoney(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return formatMoney(n);
}

function formatMaybeNumber(n: number | undefined, digits = 2): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function formatHouseFootprintParamValue(value: number): string {
  return value.toFixed(1);
}

function parseHouseFootprintParamValue(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function snapHouseFootprintValue(value: number): number {
  return Math.round(value * 10) / 10;
}

function clientPointToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

function formatSignedMoney(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '\u2014';
  if (Math.abs(n) < 0.005) return '$0.00';
  const sign = n > 0 ? '+' : '-';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function inferStockLengthFromLabel(label: string): number | null {
  const match = String(label ?? '').match(/(\d+(?:\.\d+)?)m\b/i);
  if (!match) return null;
  const n = Number.parseFloat(match[1] ?? '');
  return Number.isFinite(n) ? n : null;
}

type UiMode = 'basic' | 'advanced';
const UI_MODE_STORAGE_KEY = 'sanctuary-portal:calculator:uiMode:v1';
const PREVIEW_SPLIT_STORAGE_KEY = 'sanctuary-portal:calculator:previewRightWidthPx:v1';
const PREVIEW_SPLIT_STACK_BREAKPOINT_PX = 1100;
const PREVIEW_SPLIT_LEFT_MIN_PX = 640;
const PREVIEW_SPLIT_RIGHT_MIN_PX = 360;
const PREVIEW_SPLIT_RIGHT_DEFAULT_PX = 520;
const PREVIEW_SPLIT_HANDLE_WIDTH_PX = 18;

type InfillDeletedState = {
  infill: InfillLineItem;
  index: number;
  expiresAt: number;
  draft?: InfillDraftEntry;
};

type InfillSectionId = InfillEditorSectionId;

function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function maxPreviewRightWidth(frameWidthPx: number): number {
  if (!Number.isFinite(frameWidthPx) || frameWidthPx <= 0) return PREVIEW_SPLIT_RIGHT_DEFAULT_PX;
  const max = Math.floor(frameWidthPx - PREVIEW_SPLIT_LEFT_MIN_PX - PREVIEW_SPLIT_HANDLE_WIDTH_PX);
  return Math.max(PREVIEW_SPLIT_RIGHT_MIN_PX, max);
}

function hasNonEmptyValue(value: string | undefined): value is string {
  return value !== undefined && value !== null && String(value).trim() !== '';
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
    case 'gableHouseEdgeGutter':
      return 'House-side eave gutter';
    case 'gableOuterEdgeGutter':
      return 'Outer-side eave gutter';
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
    case 'flashings':
      return 'Flashings';
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
  { label: '80x50', value: '80x50' },
  { label: '100x50', value: '100x50' },
  { label: '150x100', value: '150x100' },
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
  { label: 'Steel RHS 150x50x3', value: 'RHS 150x50x3' },
];
const RIDGE_BEAM_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '100x50', value: '100x50' },
  { label: '150x50', value: '150x50' },
  { label: '200x50', value: '200x50' },
  { label: 'Steel RHS 150x50x3', value: 'RHS 150x50x3' },
];
const BOX_BEAM_PROFILE_OPTIONS: FieldOption[] = [
  DEFAULT_OVERRIDE_OPTION,
  { label: '300x50', value: '300x50' },
  { label: '250x50', value: '250x50' },
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
const GABLE_GUTTER_OPTIONS: FieldOption[] = [
  { label: 'House gutter', value: 'house' },
  { label: 'Our gutter (SP)', value: 'our' },
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

export default function CalculatorGridClient({
  email: emailProp,
  role: roleProp,
}: {
  email?: string;
  role?: 'admin' | 'staff';
}) {
  const { email: sessionEmail, role: sessionRole } = usePortalSession();
  const email = typeof emailProp === 'string' ? emailProp : (sessionEmail ?? '');
  const role = (roleProp ?? (sessionRole ?? 'staff')) === 'admin' ? 'admin' : 'staff';

  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const toast = useToast();
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const projectId = searchParams.get('projectId') ?? '';
  const fromEstimateId = searchParams.get('fromEstimateId') ?? '';
  const editEstimateId = searchParams.get('editEstimateId') ?? '';
  const projectEstimatesQuery = useQuery({
    ...estimateMetasByProjectQueryOptions(hostKey, projectId),
    enabled: Boolean(projectId),
  });
  const projectEstimates = projectEstimatesQuery.data ?? [];
  const activeDraftEstimateMeta = useMemo(
    () => projectEstimates.find((estimate) => estimate.isActiveDraft) ?? null,
    [projectEstimates],
  );
  const [editSessionEstimateId, setEditSessionEstimateId] = useState(() => editEstimateId.trim());
  const activeEditEstimateId = editSessionEstimateId || editEstimateId.trim();
  const isEditingDesign = activeEditEstimateId.length > 0;
  const draftSessionKey = useMemo(
    () => calculatorDraftSessionKey(projectId, fromEstimateId, activeEditEstimateId),
    [activeEditEstimateId, fromEstimateId, projectId],
  );
  const draftEntityKey = useMemo(() => buildCalculatorDraftEntityKey(draftSessionKey), [draftSessionKey]);
  const restoredDraftForKeyRef = useRef(false);
  const loadedEstimateDetailRef = useRef<EstimateDetail | null>(null);

  const [values, setValues] = useState<CalculatorInputs>(() => ({
    schemaVersion: 'v2',
    projectName: '',
    quoteRef: '',
    access: 'normal',
    height: 'single_storey',
    jobType: 'residential',
    travelExGst: '0',
    extrasAllowanceExGst: '0',
    quoteDiscountPct: '0',
    pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
    modules: [makeDefaultModule('pergola-1')],
    blinds: makeDefaultBlinds(),
  }));
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>('basic');
  const [moduleViewsTab, setModuleViewsTab] = useState<ModuleViewsTab>('plan');
  const [isFootprintEditing, setIsFootprintEditing] = useState(false);
  const [footprintHoveredAttachmentSide, setFootprintHoveredAttachmentSide] = useState<AttachmentSide | null>(null);
  const [footprintHoveredHandleId, setFootprintHoveredHandleId] = useState<HouseFootprintHandleId | null>(null);
  const [footprintActiveHandleId, setFootprintActiveHandleId] = useState<HouseFootprintHandleId | null>(null);
  const [footprintDragSession, setFootprintDragSession] = useState<HouseFootprintDragSession | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [showAllFlashingBands, setShowAllFlashingBands] = useState(false);
  const [previewRightWidthPx, setPreviewRightWidthPx] = useState(PREVIEW_SPLIT_RIGHT_DEFAULT_PX);
  const [previewRightWidthMaxPx, setPreviewRightWidthMaxPx] = useState(PREVIEW_SPLIT_RIGHT_DEFAULT_PX);
  const [isPreviewSplitDragging, setIsPreviewSplitDragging] = useState(false);
  const [pendingFlashingLengthFocusId, setPendingFlashingLengthFocusId] = useState<string | null>(null);
  const baselineResultRef = useRef<SiteOutputV1 | null>(null);
  const [impactDiff, setImpactDiff] = useState<ImpactDiff | null>(null);
  const previewSplitRef = useRef<HTMLDivElement | null>(null);
  const previewSplitPointerIdRef = useRef<number | null>(null);
  const previewSplitStorageReadyRef = useRef(false);
  const flashingLengthInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const primaryFlashingManualOverrideRef = useRef<Record<string, boolean>>({});
  const footprintCanvasSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    restoredDraftForKeyRef.current = false;
    loadedEstimateDetailRef.current = null;
    setDraftHydrated(false);

    if (typeof window === 'undefined') {
      setDraftHydrated(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await ensureLocalFirstStoreReady();
        const persistedDraft = getLocalFirstWorkingCopy<CalculatorDraftSessionSnapshot>(draftEntityKey)?.data ?? null;
        const raw = persistedDraft ? null : window.sessionStorage.getItem(draftSessionKey);
        const parsed = persistedDraft ?? (raw ? (JSON.parse(raw) as Partial<CalculatorDraftSessionSnapshot>) : null);
        if (!parsed || !isCalculatorInputsV2(parsed.values) || cancelled) return;

        const normalized = normalizeCalculatorInputsForUi(parsed.values);
        const parsedIndex = Number.isFinite(Number(parsed.activeModuleIndex)) ? Math.trunc(Number(parsed.activeModuleIndex)) : 0;
        const safeIndex = Math.max(0, Math.min(normalized.modules.length - 1, parsedIndex));

        setValues(normalized);
        setActiveModuleIndex(safeIndex);
        setDraftNotice('Restored unsaved calculator inputs.');
        restoredDraftForKeyRef.current = true;
      } catch {
        window.sessionStorage.removeItem(draftSessionKey);
      } finally {
        if (!cancelled) {
          setDraftHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftEntityKey, draftSessionKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(UI_MODE_STORAGE_KEY);
      if (raw === 'advanced' || raw === 'basic') {
        setUiMode(raw);
      }
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(UI_MODE_STORAGE_KEY, uiMode);
    } catch {
      void 0;
    }
  }, [uiMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(PREVIEW_SPLIT_STORAGE_KEY);
      if (raw) {
        const parsed = Number.parseFloat(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
          setPreviewRightWidthPx(Math.round(parsed));
        }
      }
    } catch {
      void 0;
    } finally {
      previewSplitStorageReadyRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!previewSplitStorageReadyRef.current) return;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PREVIEW_SPLIT_STORAGE_KEY, String(Math.round(previewRightWidthPx)));
    } catch {
      void 0;
    }
  }, [previewRightWidthPx]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const frame = previewSplitRef.current;
    if (!frame) return;

    const syncSplitBounds = () => {
      const width = frame.getBoundingClientRect().width;
      if (!Number.isFinite(width) || width <= 0) return;
      const maxWidth = maxPreviewRightWidth(width);
      setPreviewRightWidthMaxPx(maxWidth);
      setPreviewRightWidthPx((prev) => {
        const next = Math.round(clampNumber(prev, PREVIEW_SPLIT_RIGHT_MIN_PX, maxWidth));
        return next === prev ? prev : next;
      });
    };

    syncSplitBounds();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        syncSplitBounds();
      });
      observer.observe(frame);
    }

    window.addEventListener('resize', syncSplitBounds);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncSplitBounds);
    };
  }, []);

  const isAdvancedUi = uiMode === 'advanced';

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
    const nextEditEstimateId = editEstimateId.trim();
    if (!nextEditEstimateId) return;
    setEditSessionEstimateId(nextEditEstimateId);
  }, [editEstimateId]);

  useEffect(() => {
    if (!draftHydrated || !projectId || activeEditEstimateId || fromEstimateId) return;
    if (restoredDraftForKeyRef.current) return;
    if (!activeDraftEstimateMeta) return;
    const qs = new URLSearchParams(searchParams.toString());
    qs.set('projectId', projectId);
    qs.set('editEstimateId', activeDraftEstimateMeta.id);
    qs.delete('fromEstimateId');
    router.replace(`/staff/calculator?${qs.toString()}`);
  }, [activeDraftEstimateMeta, activeEditEstimateId, draftHydrated, fromEstimateId, projectId, router, searchParams]);

  useEffect(() => {
    if (!draftHydrated) return;

    if (!activeEditEstimateId && !fromEstimateId) {
      setDraftNotice(null);
      return;
    }

    void (async () => {
      try {
        if (activeEditEstimateId) {
          const resolvedEditEstimateId = resolveLocalFirstId(activeEditEstimateId);
          const cachedEstimate =
            getLocalFirstWorkingCopy<EstimateDetail>(buildEstimateEntityKey(activeEditEstimateId))?.data ??
            (resolvedEditEstimateId && resolvedEditEstimateId !== activeEditEstimateId
              ? getLocalFirstWorkingCopy<EstimateDetail>(buildEstimateEntityKey(resolvedEditEstimateId))?.data
              : null) ??
            queryClient.getQueryData<EstimateDetail>(qk.estimates.detail(hostKey, activeEditEstimateId)) ??
            (resolvedEditEstimateId && resolvedEditEstimateId !== activeEditEstimateId
              ? queryClient.getQueryData<EstimateDetail>(qk.estimates.detail(hostKey, resolvedEditEstimateId))
              : null);

          const estimate = cachedEstimate ?? (
            await apiJson<{ estimate: EstimateDetail }>(
              `/api/estimates/${encodeURIComponent(resolvedEditEstimateId || activeEditEstimateId)}`,
              {
                skipSaveTracking: true,
              },
            )
          ).estimate;
          if (!estimate) throw new Error('Design not found');
          loadedEstimateDetailRef.current = estimate;
          if (estimate.editability.isLocked) {
            const msg = `Design ${estimate.versionLabel} is locked and can no longer be edited.`;
            setDraftNotice(msg);
            toast.error(msg);
            if (projectId) {
              router.replace(
                `/staff/projects/${encodeURIComponent(projectId)}?tab=estimates&estimateId=${encodeURIComponent(
                  resolvedEditEstimateId || activeEditEstimateId,
                )}`,
              );
            }
            return;
          }

          if (restoredDraftForKeyRef.current) {
            setDraftNotice(`Restored unsaved edits for ${estimate.versionLabel}`);
            return;
          }

          const draft = calculatorInputsFromEstimateDetail(estimate);
          setValues(draft);
          setActiveModuleIndex(0);
          const msg =
            isLocalEstimateId(estimate.id) || (resolvedEditEstimateId ?? activeEditEstimateId).startsWith('local-estimate:')
              ? `Editing design ${estimate.versionLabel}. Changes will keep syncing in the background.`
              : `Editing design ${estimate.versionLabel}`;
          setDraftNotice(msg);
          toast.success(msg);
          return;
        }

        if (restoredDraftForKeyRef.current) return;

        const draft = await duplicateEstimateToDraft(fromEstimateId);
        const normalizedDraft = normalizeCalculatorInputsForUi({
          ...draft,
          schemaVersion: 'v2',
          modules: Array.isArray(draft.modules) ? draft.modules : [],
          blinds: normalizeBlindsStateForUi((draft as any).blinds),
        } as CalculatorInputs);

        setValues(normalizedDraft);
        setActiveModuleIndex(0);
        const msg = `Draft design started from ${fromEstimateId}`;
        setDraftNotice(msg);
        toast.success(msg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start design revision';
        setDraftNotice(msg);
        toast.error(msg);
      }
    })();
  }, [activeEditEstimateId, draftHydrated, fromEstimateId, hostKey, projectId, queryClient, router, toast]);

  useEffect(() => {
    if (!draftHydrated) return;
    if (typeof window === 'undefined') return;

    const snapshot: CalculatorDraftSessionSnapshot = {
      activeModuleIndex,
      updatedAt: Date.now(),
      values,
    };

    try {
      window.sessionStorage.setItem(draftSessionKey, JSON.stringify(snapshot));
    } catch {
      void 0;
    }
    void writeLocalFirstWorkingCopy({
      entityKey: draftEntityKey,
      data: snapshot,
    });
  }, [activeModuleIndex, draftEntityKey, draftHydrated, draftSessionKey, values]);

  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  useEffect(() => {
    setActiveModuleIndex((prev) => {
      const max = Math.max(0, values.modules.length - 1);
      return Math.min(prev, max);
    });
  }, [values.modules.length]);

  const pergolas = useMemo(() => normalizePergolasForUi(values.pergolas), [values.pergolas]);
  const fallbackPergolaId = pergolas[0]?.id ?? 'pergola-1';
  const knownPergolaIds = useMemo(() => new Set(pergolas.map((pergola) => pergola.id)), [pergolas]);
  const modulesWithPergola = useMemo(
    () =>
      values.modules.map((module) => {
        const pergolaId =
          typeof module.pergolaId === 'string' && knownPergolaIds.has(module.pergolaId) ? module.pergolaId : fallbackPergolaId;
        return { ...module, pergolaId };
      }),
    [values.modules, knownPergolaIds, fallbackPergolaId],
  );
  const moduleRoutes = useMemo(() => {
    const seenPerPergola = new Map<string, number>();
    return modulesWithPergola.map((module) => {
      const pergolaId = typeof module.pergolaId === 'string' ? module.pergolaId : fallbackPergolaId;
      const localModuleIndex = seenPerPergola.get(pergolaId) ?? 0;
      seenPerPergola.set(pergolaId, localModuleIndex + 1);
      return { pergolaId, localModuleIndex };
    });
  }, [modulesWithPergola, fallbackPergolaId]);
  const activeModule = modulesWithPergola[activeModuleIndex] ?? modulesWithPergola[0] ?? makeDefaultModule(fallbackPergolaId);
  const activeAttachmentSide = normalizeAttachmentSide(activeModule.attachmentSide);
  const activeDrawingRotationQuarterTurns = normalizeDrawingRotationQuarterTurns(activeModule.drawingRotationQuarterTurns);
  const activeHouseFootprintPreset = normalizeHouseFootprintPreset(activeModule.houseFootprintPreset);
  const activeHouseFootprintParams = normalizeHouseFootprintParams(activeModule.houseFootprintParams);
  const canEditHouseFootprintByInputs = activeModule.houseConnectionType !== 'none' && supportsHouseFootprints(activeModule.pergolaStyle);
  const activePergolaId =
    typeof activeModule.pergolaId === 'string' && knownPergolaIds.has(activeModule.pergolaId) ? activeModule.pergolaId : fallbackPergolaId;

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

      const flashings = normalizeFlashingsStateForUi(module.flashings, module);
      const hasInvalidLength = flashings.rows.some((row) => {
        const length = toNumber(row.lengthM);
        return !Number.isFinite(length) || length < 0;
      });
      if (hasInvalidLength) {
        next.flashings = 'Enter a flashing length of 0 or more.';
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
      const current = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
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
          if (nextHouseConnection === 'none') {
            updated.gableHouseEdgeGutter = 'our';
            updated.gableOuterEdgeGutter = 'our';
          } else if (current.houseConnectionType === 'none') {
            if (current.gableHouseEdgeGutter === 'our') updated.gableHouseEdgeGutter = 'house';
            if (current.gableOuterEdgeGutter === 'our') updated.gableOuterEdgeGutter = 'our';
          }

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

      if (key === 'pergolaStyle' && next === 'gable') {
        updated.gableHouseEdgeGutter = nextHouseConnection === 'none' ? 'our' : 'house';
        updated.gableOuterEdgeGutter = 'our';
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

      if (key === 'lengthM' || key === 'hipCornerLengthBM' || key === 'pergolaStyle') {
        const flashings = normalizeFlashingsStateForUi(current.flashings, current);
        const primary =
          flashings.rows.find((row) => row.kind === 'primary') ??
          flashings.rows[0] ??
          makeDefaultPrimaryFlashingRow(current);
        const manualOverride = primaryFlashingManualOverrideRef.current[primary.id] === true;

        if (!manualOverride || isPrimaryFlashingLengthAutoLinked(primary.lengthM, current)) {
          const nextAutoLength = formatFlashingLengthInput(roofLengthForPrimaryFlashing(updated));
          const synced: CalculatorFlashingsState = {
            rows: flashings.rows.map((row) => (row.id === primary.id ? { ...row, lengthM: nextAutoLength } : row)),
          };
          updated.flashings = normalizeFlashingsStateForUi(synced, updated);
          primaryFlashingManualOverrideRef.current[primary.id] = false;
        }
      }

      modules[activeModuleIndex] = updated;
      return { ...prev, modules };
    });
  };

  const setModuleOverride = (key: keyof NonNullable<CalculatorModuleInputs['overrides']>, value: string) => {
    setValues((prev) => {
      const modules = prev.modules.slice();
      const current = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
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

  const setHouseFootprintParam = (key: keyof CalculatorHouseFootprintParams, value: string) => {
    setValues((prev) => {
      const modules = prev.modules.slice();
      const current = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
      modules[activeModuleIndex] = {
        ...current,
        houseFootprintParams: {
          ...normalizeHouseFootprintParams(current.houseFootprintParams),
          [key]: value,
        },
      };
      return { ...prev, modules };
    });
  };

  const handleFootprintSvgMount = useCallback((node: SVGSVGElement | null) => {
    footprintCanvasSvgRef.current = node;
  }, []);

  const stopFootprintEditing = useCallback(() => {
    setIsFootprintEditing(false);
    setFootprintHoveredAttachmentSide(null);
    setFootprintHoveredHandleId(null);
    setFootprintActiveHandleId(null);
    setFootprintDragSession(null);
  }, []);

  useEffect(() => {
    stopFootprintEditing();
  }, [activeModuleIndex, stopFootprintEditing]);

  const startFootprintEditing = useCallback(() => {
    if (!canEditHouseFootprintByInputs || moduleViewsTab !== 'plan') return;
    setIsFootprintEditing(true);
  }, [canEditHouseFootprintByInputs, moduleViewsTab]);

  const handleFootprintPresetSelect = useCallback(
    (preset: CalculatorModuleInputs['houseFootprintPreset']) => {
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setModuleField('houseFootprintPreset', normalizeHouseFootprintPreset(preset) as CalculatorModuleInputs['houseFootprintPreset']);
    },
    [setModuleField],
  );

  const handleFootprintRotate = useCallback(
    (delta: -1 | 1) => {
      const nextTurns = normalizeDrawingRotationQuarterTurns(activeDrawingRotationQuarterTurns + delta);
      setFootprintHoveredAttachmentSide(null);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setModuleField('drawingRotationQuarterTurns', nextTurns as CalculatorModuleInputs['drawingRotationQuarterTurns']);
    },
    [activeDrawingRotationQuarterTurns, setModuleField],
  );

  const handleFootprintAttachmentSideSelect = useCallback(
    (side: AttachmentSide) => {
      setFootprintHoveredAttachmentSide(side);
      setFootprintHoveredHandleId(null);
      setFootprintActiveHandleId(null);
      setFootprintDragSession(null);
      setModuleField('attachmentSide', side as CalculatorModuleInputs['attachmentSide']);
    },
    [setModuleField],
  );

  const handleFootprintDragStart = useCallback(
    (meta: HouseFootprintEditorDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => {
      if (!canEditHouseFootprintByInputs || !isFootprintEditing) return;
      const svg = footprintCanvasSvgRef.current;
      if (!svg) return;
      const startPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!startPoint) return;
      setFootprintActiveHandleId(meta.handleId);
      setFootprintHoveredHandleId(meta.handleId);
      setFootprintDragSession({
        ...meta,
        pointerId: event.pointerId,
        startSvgX: startPoint.x,
        startSvgY: startPoint.y,
        startParams: normalizeHouseFootprintParams(activeModule.houseFootprintParams),
      });
    },
    [activeModule.houseFootprintParams, canEditHouseFootprintByInputs, isFootprintEditing],
  );

  useEffect(() => {
    if (!footprintDragSession) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== footprintDragSession.pointerId) return;
      const svg = footprintCanvasSvgRef.current;
      if (!svg) return;
      const nextPoint = clientPointToSvg(svg, event.clientX, event.clientY);
      if (!nextPoint) return;

      const deltaSvgX = nextPoint.x - footprintDragSession.startSvgX;
      const deltaSvgY = nextPoint.y - footprintDragSession.startSvgY;
      const deltaUnits = deltaSvgX * footprintDragSession.axisX + deltaSvgY * footprintDragSession.axisY;
      const deltaM = (deltaUnits / Math.max(footprintDragSession.scale, 0.001)) * footprintDragSession.deltaMultiplier;
      const minValueM = footprintDragSession.minValueM;
      const maxValueM = Math.max(minValueM, footprintDragSession.maxValueM);
      const startParams = footprintDragSession.startParams;

      let nextKey: keyof CalculatorHouseFootprintParams = 'bandDepthM';
      let nextValue = parseHouseFootprintParamValue(startParams.bandDepthM, 1.8) + deltaM;

      switch (footprintDragSession.handleId) {
        case 'returnRun':
          nextKey = 'returnRunM';
          nextValue = parseHouseFootprintParamValue(startParams.returnRunM, 2.4) + deltaM;
          nextValue = snapHouseFootprintValue(Math.min(Math.max(nextValue, minValueM), maxValueM));
          break;
        case 'recessWidth':
          nextKey = 'recessWidthM';
          nextValue = parseHouseFootprintParamValue(startParams.recessWidthM, 2.4) + deltaM;
          nextValue = snapHouseFootprintValue(Math.min(Math.max(nextValue, minValueM), maxValueM));
          break;
        case 'recessDepth':
          nextKey = 'recessDepthM';
          nextValue = parseHouseFootprintParamValue(startParams.recessDepthM, 1.2) + deltaM;
          nextValue = snapHouseFootprintValue(Math.min(Math.max(nextValue, minValueM), maxValueM));
          break;
        case 'leftLegRun':
          nextKey = 'leftLegRunM';
          nextValue = parseHouseFootprintParamValue(startParams.leftLegRunM, 2.4) + deltaM;
          nextValue = snapHouseFootprintValue(Math.min(Math.max(nextValue, minValueM), maxValueM));
          break;
        case 'rightLegRun':
          nextKey = 'rightLegRunM';
          nextValue = parseHouseFootprintParamValue(startParams.rightLegRunM, 2.4) + deltaM;
          nextValue = snapHouseFootprintValue(Math.min(Math.max(nextValue, minValueM), maxValueM));
          break;
        case 'sideRun':
          nextKey = 'sideRunM';
          nextValue = parseHouseFootprintParamValue(startParams.sideRunM, 2.4) + deltaM;
          nextValue = snapHouseFootprintValue(Math.min(Math.max(nextValue, minValueM), maxValueM));
          break;
        case 'bandDepth':
        default:
          nextKey = 'bandDepthM';
          nextValue = parseHouseFootprintParamValue(startParams.bandDepthM, 1.8) + deltaM;
          nextValue = snapHouseFootprintValue(Math.min(Math.max(nextValue, minValueM), maxValueM));
          break;
      }

      setHouseFootprintParam(nextKey, formatHouseFootprintParamValue(nextValue));
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== footprintDragSession.pointerId) return;
      setFootprintDragSession(null);
      setFootprintActiveHandleId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [footprintDragSession, setHouseFootprintParam]);

  const flashingsState = normalizeFlashingsStateForUi(activeModule.flashings, activeModule);
  const primaryFlashingRow =
    flashingsState.rows.find((row) => row.kind === 'primary') ??
    flashingsState.rows[0] ??
    makeDefaultPrimaryFlashingRow(activeModule);

  const setFlashingsState = (updater: (state: CalculatorFlashingsState) => CalculatorFlashingsState) => {
    setValues((prev) => {
      const modules = prev.modules.slice();
      const currentModule = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
      const currentFlashings = normalizeFlashingsStateForUi(currentModule.flashings, currentModule);
      const nextFlashings = normalizeFlashingsStateForUi(updater(currentFlashings), currentModule);
      modules[activeModuleIndex] = { ...currentModule, flashings: nextFlashings };
      return { ...prev, modules };
    });
  };

  const addExtraFlashingRow = () => {
    const id = makeFlashingId();
    const defaultLength = formatFlashingLengthInput(roofLengthForPrimaryFlashing(activeModule));
    setFlashingsState((state) => ({
      ...state,
      rows: [
        ...state.rows,
        {
          id,
          kind: 'extra',
          band: normalizeFlashingBand(primaryFlashingRow.band),
          lengthM: defaultLength || '1.0',
          purpose: 'CUSTOM',
        },
      ],
    }));
    setPendingFlashingLengthFocusId(id);
  };

  const updateFlashingRow = (
    id: string,
    patch: Partial<{
      band: CalculatorFlashingBand;
      lengthM: string;
      purpose: CalculatorFlashingPurpose;
    }>,
  ) => {
    if (patch.lengthM !== undefined) {
      const row = flashingsState.rows.find((entry) => entry.id === id);
      if (row?.kind === 'primary') {
        primaryFlashingManualOverrideRef.current[row.id] = !isPrimaryFlashingLengthAutoLinked(String(patch.lengthM), activeModule);
      }
    }
    setFlashingsState((state) => ({
      ...state,
      rows: state.rows.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          ...(patch.band !== undefined ? { band: normalizeFlashingBand(patch.band) } : null),
          ...(patch.lengthM !== undefined ? { lengthM: String(patch.lengthM) } : null),
          ...(patch.purpose !== undefined ? { purpose: normalizeFlashingPurpose(patch.purpose) } : null),
        };
      }),
    }));
  };

  const removeFlashingRow = (id: string) => {
    setFlashingsState((state) => ({
      ...state,
      rows: state.rows.filter((row) => row.id !== id || row.kind === 'primary'),
    }));
  };

  useEffect(() => {
    if (!pendingFlashingLengthFocusId) return;
    const target = flashingLengthInputRefs.current[pendingFlashingLengthFocusId];
    if (!target) return;
    target.focus();
    target.select();
    setPendingFlashingLengthFocusId(null);
  }, [flashingsState.rows, pendingFlashingLengthFocusId]);

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
      return { ...prev, blinds: { items } };
    });
  };

  const infillsState = normalizeInfillsStateForUi(activeModule.infills);

  const setInfillItems = (updater: (items: InfillLineItem[]) => InfillLineItem[]) => {
    setValues((prev) => {
      const modules = prev.modules.slice();
      const currentModule = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
      const currentInfills = normalizeInfillsStateForUi(currentModule.infills);
      const nextItems = updater(currentInfills.items).map((item) => makeDefaultInfillItem(item));
      modules[activeModuleIndex] = { ...currentModule, infills: { items: nextItems } };
      return { ...prev, modules };
    });
  };

  const setInfillItem = (id: string, patch: Partial<InfillLineItem>) => {
    setInfillItems((items) => items.map((item) => (item.id === id ? makeDefaultInfillItem({ ...item, ...patch, id }) : item)));
  };

  const setInfillLocation = (id: string, location: InfillLineItem['location']) => {
    setValues((prev) => {
      const modules = prev.modules.slice();
      const currentModule = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
      const currentInfills = normalizeInfillsStateForUi(currentModule.infills);
      const idx = currentInfills.items.findIndex((item) => item.id === id);
      if (idx < 0) return prev;

      const items = currentInfills.items.slice();
      const existing = items[idx];
      const preset = buildInfillPreset(currentModule, location);
      items[idx] = makeDefaultInfillItem({
        ...existing,
        ...preset,
        id: existing.id,
        location,
        support: { ...existing.support, ...(preset.support ?? {}) },
        shape: (preset.shape as any) ?? existing.shape,
      });

      modules[activeModuleIndex] = { ...currentModule, infills: { items } };
      return { ...prev, modules };
    });
    setInfillDraftById((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setInfillOpenSection('basic');
  };

  const setInfillDraftValue = (infillId: string, field: InfillDraftFieldKey, raw: string) => {
    setInfillDraftById((prev) => {
      const current = prev[infillId] ?? {};
      return { ...prev, [infillId]: { ...current, [field]: raw } };
    });
  };

  const clearInfillDraftField = (infillId: string, field: InfillDraftFieldKey) => {
    setInfillDraftById((prev) => {
      const current = prev[infillId];
      if (!current || current[field] === undefined) return prev;
      const nextDraft = { ...current };
      delete nextDraft[field];
      const next = { ...prev };
      if (Object.keys(nextDraft).length === 0) {
        delete next[infillId];
      } else {
        next[infillId] = nextDraft;
      }
      return next;
    });
  };

  const syncMonoSlopeShape = (shape: Extract<InfillLineItem['shape'], { type: 'mono_slope' }>): InfillLineItem['shape'] => {
    const resolved = resolveMonoSlopeShape(shape);
    return {
      ...shape,
      heightLowM: formatInputNumber(resolved.leftHeightM, 3),
      heightHighM: formatInputNumber(resolved.rightHeightM, 3),
      slopeMode: normalizeMonoSlopeMode(shape.slopeMode),
      slopeDeg: shape.slopeDeg ?? '',
      slopeAnchor: normalizeMonoSlopeAnchor(shape.slopeAnchor),
    };
  };

  const updateMonoSlopeShape = (
    infill: InfillLineItem,
    updater: (shape: Extract<InfillLineItem['shape'], { type: 'mono_slope' }>) => Extract<InfillLineItem['shape'], { type: 'mono_slope' }>,
  ) => {
    if (infill.shape.type !== 'mono_slope') return;
    setInfillItem(infill.id, { shape: syncMonoSlopeShape(updater(infill.shape)) });
  };

  const getInfillDraftValue = (infill: InfillLineItem, field: InfillDraftFieldKey): string => {
    const override = infillDraftById[infill.id]?.[field];
    if (typeof override === 'string') return override;
    if (field === 'widthM') return infill.shape.widthM;
    if (field === 'heightM') return infill.shape.type === 'rect' ? infill.shape.heightM : '';
    if (field === 'heightLowM') return infill.shape.type === 'mono_slope' ? infill.shape.heightLowM : '';
    return infill.shape.type === 'mono_slope' ? infill.shape.heightHighM : '';
  };

  const updateRequiredShapeField = (infill: InfillLineItem, field: InfillDraftFieldKey, raw: string) => {
    setInfillDraftValue(infill.id, field, raw);
  };

  const commitRequiredShapeField = (infill: InfillLineItem, field: InfillDraftFieldKey, rawInput?: string) => {
    const raw = typeof rawInput === 'string' ? rawInput : getInfillDraftValue(infill, field);
    if (raw.trim() === '') return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    if (infill.shape.type === 'rect') {
      if (field === 'widthM') {
        setInfillItem(infill.id, { shape: { ...infill.shape, widthM: raw } });
        clearInfillDraftField(infill.id, field);
        return;
      }
      if (field === 'heightM') {
        setInfillItem(infill.id, { shape: { ...infill.shape, heightM: raw } });
        clearInfillDraftField(infill.id, field);
        return;
      }
      return;
    }

    if (field === 'widthM') {
      updateMonoSlopeShape(infill, (shape) => ({ ...shape, widthM: raw }));
      clearInfillDraftField(infill.id, field);
      return;
    }
    if (field === 'heightLowM') {
      updateMonoSlopeShape(infill, (shape) => ({ ...shape, heightLowM: raw }));
      clearInfillDraftField(infill.id, field);
      return;
    }
    if (field === 'heightHighM') {
      updateMonoSlopeShape(infill, (shape) => ({ ...shape, heightHighM: raw }));
      clearInfillDraftField(infill.id, field);
    }
  };

  const addInfillItems = (itemsToAdd: InfillLineItem[]) => {
    if (!itemsToAdd.length) return;
    const nextSelectedId = itemsToAdd[0]?.id ?? null;
    setInfillItems((items) => [...items, ...itemsToAdd]);
    setInfillOpenSection('basic');
    if (nextSelectedId) {
      setPendingInfillSelectionId(nextSelectedId);
      setSelectedInfillId(nextSelectedId);
    }
  };

  const addInfill = (seed?: Partial<InfillLineItem>) => {
    const created = makeDefaultInfillItem(seed);
    addInfillItems([created]);
  };

  const addInfillPreset = (preset: InfillPresetKey) => {
    const additions = buildInfillItemsForPreset(activeModule, preset).map((item) =>
      makeDefaultInfillItem({
        ...item,
        targetPanelWidthM: formatInputNumber(maxCentreForAcrylicSource(item.acrylicSource), 2),
        maxPanelWidthM: formatInputNumber(maxCentreForAcrylicSource(item.acrylicSource), 2),
      }),
    );
    addInfillItems(additions);
    trackInfillEvent('infill_add', {
      source: preset === 'custom' ? 'custom' : 'preset',
      preset,
      count: additions.length,
    });
  };

  const duplicateInfill = (id: string) => {
    const current = infillsState.items.find((item) => item.id === id);
    if (!current) return;
    addInfill({ ...current, id: makeInfillId(), label: current.label ? `${current.label} (copy)` : undefined });
    trackInfillEvent('infill_duplicate', {
      infill_id: id,
      location: current.location,
      shape: current.shape.type,
    });
  };

  const duplicateInfillBulk = (id: string, count: number, labelPattern: string) => {
    const source = infillsState.items.find((item) => item.id === id);
    if (!source) return;

    const boundedCount = Math.max(1, Math.min(20, Math.round(count)));
    const sourceLabel = source.label?.trim() || 'Infill';
    const existingLabels = new Set(infillsState.items.map((item) => (item.label ?? '').trim().toLowerCase()).filter(Boolean));
    const created: InfillLineItem[] = [];

    const makeUniqueLabel = (candidate: string): string => {
      const normalized = candidate.trim();
      if (!normalized) return '';
      let nextLabel = normalized;
      let suffix = 2;
      while (existingLabels.has(nextLabel.toLowerCase())) {
        nextLabel = `${normalized} (${suffix})`;
        suffix += 1;
      }
      existingLabels.add(nextLabel.toLowerCase());
      return nextLabel;
    };

    for (let i = 1; i <= boundedCount; i += 1) {
      const rawLabel = (labelPattern || '{original} (copy {i})')
        .replaceAll('{original}', sourceLabel)
        .replaceAll('{i}', String(i));
      const label = makeUniqueLabel(rawLabel || `${sourceLabel} (copy ${i})`);
      created.push(
        makeDefaultInfillItem({
          ...source,
          id: makeInfillId(),
          label,
        }),
      );
    }

    if (!created.length) return;
    const nextSelectedId = created[created.length - 1]?.id ?? created[0]?.id ?? null;
    setInfillItems((items) => [...items, ...created]);
    if (nextSelectedId) {
      setPendingInfillSelectionId(nextSelectedId);
      setSelectedInfillId(nextSelectedId);
    }
    setInfillOpenSection('basic');
    trackInfillEvent('infill_duplicate_bulk', {
      infill_id: id,
      count: created.length,
      location: source.location,
      shape: source.shape.type,
    });
  };

  const moveInfill = (id: string, direction: -1 | 1) => {
    const currentIndex = infillsState.items.findIndex((item) => item.id === id);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= infillsState.items.length) return;

    setInfillItems((items) => {
      const next = items.slice();
      const [moved] = next.splice(currentIndex, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
    setPendingInfillSelectionId(id);
    setSelectedInfillId(id);
    trackInfillEvent('infill_reorder', {
      infill_id: id,
      from: currentIndex,
      to: nextIndex,
    });
  };

  const requestDeleteInfill = (id: string) => {
    setInfillDeleteTargetId(id);
  };

  const confirmDeleteInfill = () => {
    if (!infillDeleteTargetId) return;
    const currentIdx = infillsState.items.findIndex((item) => item.id === infillDeleteTargetId);
    const infill = currentIdx >= 0 ? infillsState.items[currentIdx] : null;
    if (!infill) {
      setInfillDeleteTargetId(null);
      return;
    }

    const nextSelection =
      currentIdx >= 0
        ? infillsState.items[currentIdx + 1]?.id ?? infillsState.items[currentIdx - 1]?.id ?? null
        : infillsState.items[0]?.id ?? null;

    const deletedDraft = infillDraftById[infill.id];
    setInfillItems((items) => items.filter((item) => item.id !== infill.id));
    if (selectedInfillId === infill.id) setSelectedInfillId(nextSelection);

    setInfillDraftById((prev) => {
      if (!prev[infill.id]) return prev;
      const next = { ...prev };
      delete next[infill.id];
      return next;
    });

    setDeletedInfill({
      infill,
      index: currentIdx,
      expiresAt: Date.now() + INFILL_DELETE_UNDO_MS,
      draft: deletedDraft,
    });
    trackInfillEvent('infill_delete', {
      infill_id: infill.id,
      location: infill.location,
      shape: infill.shape.type,
    });
    setInfillDeleteTargetId(null);
  };

  const undoDeleteInfill = () => {
    if (!deletedInfill) return;
    setInfillItems((items) => {
      const next = items.slice();
      const insertIndex = Math.max(0, Math.min(deletedInfill.index, next.length));
      next.splice(insertIndex, 0, deletedInfill.infill);
      return next;
    });
    if (deletedInfill.draft) {
      setInfillDraftById((prev) => ({ ...prev, [deletedInfill.infill.id]: deletedInfill.draft as InfillDraftEntry }));
    }
    setPendingInfillSelectionId(deletedInfill.infill.id);
    setSelectedInfillId(deletedInfill.infill.id);
    setInfillOpenSection('basic');
    trackInfillEvent('infill_undo_delete', {
      infill_id: deletedInfill.infill.id,
      location: deletedInfill.infill.location,
    });
    setDeletedInfill(null);
  };

  const readyToCalculate = values.modules.length > 0 && !hasModuleErrors;

  const requestPayload = useMemo<SiteInputsV1>(() => buildSiteInputsFromCalculatorInputs(values), [values]);

  const requestPayloadJson = useMemo(() => JSON.stringify(requestPayload), [requestPayload]);
  const activeModulePayload = useMemo<CostInputsV1 | null>(() => {
    const route = moduleRoutes[activeModuleIndex] ?? moduleRoutes[0];
    const fallbackPergola = requestPayload.pergolas?.[0];
    if (!route) return fallbackPergola?.modules?.[0] ?? null;
    const pergola = requestPayload.pergolas.find((entry) => entry.id === route.pergolaId) ?? fallbackPergola;
    return pergola?.modules?.[route.localModuleIndex] ?? pergola?.modules?.[0] ?? null;
  }, [requestPayload, activeModuleIndex, moduleRoutes]);
  const materialsDebugAvailable = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_COSTING_DEBUG_ENABLED === '1';

  const [result, setResult] = useState<SiteOutputV1 | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [materialsDebugEnabled, setMaterialsDebugEnabled] = useState(false);
  const [materialsDebugDetail, setMaterialsDebugDetail] = useState<'summary' | 'full'>('summary');
  const [materialsDebugFocusLineIndex, setMaterialsDebugFocusLineIndex] = useState<number | null>(null);
  const [materialsDebugData, setMaterialsDebugData] = useState<MaterialsExplainApiResponse | null>(null);
  const [materialsDebugLoading, setMaterialsDebugLoading] = useState(false);
  const [materialsDebugError, setMaterialsDebugError] = useState<string | null>(null);
  const [moduleBaseline, setModuleBaseline] = useState<CostOutputV1 | null>(null);
  const [moduleBaselineLoading, setModuleBaselineLoading] = useState(false);
  const [moduleBaselineError, setModuleBaselineError] = useState<string | null>(null);
  const [infillDecisionLoading, setInfillDecisionLoading] = useState(false);
  const [infillDecisionError, setInfillDecisionError] = useState<string | null>(null);
  const [infillWithoutCost, setInfillWithoutCost] = useState<CostOutputV1 | null>(null);
  const [compareSheetCost, setCompareSheetCost] = useState<CostOutputV1 | null>(null);
  const [compareStripCost, setCompareStripCost] = useState<CostOutputV1 | null>(null);
  const [infillsOpen, setInfillsOpen] = useState(false);
  const [selectedInfillId, setSelectedInfillId] = useState<string | null>(null);
  const [pendingInfillSelectionId, setPendingInfillSelectionId] = useState<string | null>(null);
  const [infillDraftById, setInfillDraftById] = useState<Record<string, InfillDraftEntry>>({});
  const [infillOpenSection, setInfillOpenSection] = useState<InfillSectionId>('basic');
  const [infillDeleteTargetId, setInfillDeleteTargetId] = useState<string | null>(null);
  const [deletedInfill, setDeletedInfill] = useState<InfillDeletedState | null>(null);
  const [infillDuplicateOpen, setInfillDuplicateOpen] = useState(false);
  const [infillResolveOpen, setInfillResolveOpen] = useState(false);
  const [infillSummaryOpen, setInfillSummaryOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  const [confirmAcknowledgeWarnings, setConfirmAcknowledgeWarnings] = useState(false);
  const [confirmRequestDesign, setConfirmRequestDesign] = useState(false);
  const [confirmRequestDesignPriority, setConfirmRequestDesignPriority] = useState<DesignRequestPriorityTier>('UNPRICED');
  const [issuesOpen, setIssuesOpen] = useState(false);
  const pendingIssueFocusRef = useRef<{ moduleIndex: number; fieldId: string } | null>(null);
  const infillRowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const infillListContainerRef = useRef<HTMLDivElement | null>(null);
  const lastValidInfillEstimateRef = useRef<Record<string, InfillUiEstimate>>({});
  const infillAutoSwitchByIdRef = useRef<Record<string, InfillLineItem['acrylicSource']>>({});
  const infillLastSelectionEventRef = useRef<string | null>(null);
  const infillModalOpenTrackedRef = useRef(false);
  const pendingInfillWarningJumpRef = useRef<{ infillId: string; warning: InfillWarningItem } | null>(null);
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
  const suggestedDesignRequestTier = useMemo(
    () => designRequestTierFromTotal(result?.totals?.cost_inc_gst ?? null),
    [result?.totals?.cost_inc_gst],
  );

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
    if (!pendingInfillSelectionId) return;
    if (!infillsState.items.some((item) => item.id === pendingInfillSelectionId)) return;
    setSelectedInfillId(pendingInfillSelectionId);
    setPendingInfillSelectionId(null);
  }, [infillsState.items, pendingInfillSelectionId]);

  useEffect(() => {
    if (!infillsOpen || !selectedInfillId) return;
    const selectedRow = infillRowRefs.current.get(selectedInfillId);
    if (!selectedRow) return;
    selectedRow.scrollIntoView({ block: 'nearest' });
  }, [infillsOpen, infillsState.items, selectedInfillId]);

  useEffect(() => {
    if (!infillsOpen) return;
    if (pendingInfillSelectionId) return;
    if (!infillsState.items.length) {
      if (selectedInfillId !== null) setSelectedInfillId(null);
      return;
    }
    if (!selectedInfillId || !infillsState.items.some((item) => item.id === selectedInfillId)) {
      setSelectedInfillId(infillsState.items[0].id);
    }
  }, [infillsOpen, infillsState.items, pendingInfillSelectionId, selectedInfillId]);

  useEffect(() => {
    const validIds = new Set(infillsState.items.map((item) => item.id));
    setInfillDraftById((prev) => {
      let changed = false;
      const next: Record<string, InfillDraftEntry> = {};
      Object.entries(prev).forEach(([id, draft]) => {
        if (validIds.has(id)) {
          next[id] = draft;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [infillsState.items]);

  useEffect(() => {
    if (!infillDeleteTargetId) return;
    if (infillsState.items.some((item) => item.id === infillDeleteTargetId)) return;
    setInfillDeleteTargetId(null);
  }, [infillDeleteTargetId, infillsState.items]);

  useEffect(() => {
    if (!deletedInfill) return;
    const remainingMs = deletedInfill.expiresAt - Date.now();
    if (remainingMs <= 0) {
      setDeletedInfill(null);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setDeletedInfill((current) => {
        if (!current) return null;
        return current.expiresAt <= Date.now() ? null : current;
      });
    }, remainingMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deletedInfill]);

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
        setResult(json as SiteOutputV1);
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

  useEffect(() => {
    setMaterialsDebugFocusLineIndex(null);
  }, [activeModuleIndex]);

  useEffect(() => {
    if (!materialsDebugAvailable) {
      setMaterialsDebugEnabled(false);
      setMaterialsDebugData(null);
      setMaterialsDebugError(null);
    }
  }, [materialsDebugAvailable]);

  useEffect(() => {
    if (uiMode !== 'advanced') {
      setMaterialsDebugEnabled(false);
    }
  }, [uiMode]);

  useEffect(() => {
    if (!materialsDebugEnabled || !materialsDebugAvailable || !readyToCalculate || !activeModulePayload) {
      setMaterialsDebugLoading(false);
      if (!materialsDebugEnabled) {
        setMaterialsDebugData(null);
        setMaterialsDebugError(null);
      }
      return;
    }

    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setMaterialsDebugLoading(true);
      setMaterialsDebugError(null);

      try {
        const params = new URLSearchParams();
        params.set('detail', materialsDebugDetail);
        if (materialsDebugFocusLineIndex !== null) {
          params.set('focus_line_index', String(materialsDebugFocusLineIndex));
        }

        const res = await fetch(`/api/staff/costing/v1/materials-explain?${params.toString()}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(activeModulePayload),
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(String(json?.error ?? 'Materials explain failed'));
        setMaterialsDebugData(json as MaterialsExplainApiResponse);
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Materials explain failed';
        setMaterialsDebugError(msg);
      } finally {
        if (!controller.signal.aborted) setMaterialsDebugLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [
    materialsDebugEnabled,
    materialsDebugAvailable,
    readyToCalculate,
    activeModulePayload,
    materialsDebugDetail,
    materialsDebugFocusLineIndex,
  ]);

  useEffect(() => {
    if (!infillsOpen || !activeModulePayload || !readyToCalculate || isCalculating || engineError) {
      setModuleBaseline(null);
      setModuleBaselineError(null);
      setModuleBaselineLoading(false);
      setInfillWithoutCost(null);
      setCompareSheetCost(null);
      setCompareStripCost(null);
      setInfillDecisionError(null);
      setInfillDecisionLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setModuleBaselineLoading(true);
      setModuleBaselineError(null);
      try {
        const out = await fetchModuleCost(activeModulePayload, controller.signal);
        if (controller.signal.aborted) return;
        setModuleBaseline(out);
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Failed to fetch module baseline';
        setModuleBaselineError(msg);
      } finally {
        if (!controller.signal.aborted) setModuleBaselineLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeModulePayload, engineError, infillsOpen, isCalculating, readyToCalculate]);

  const resultModules = useMemo(() => (result?.pergolas ?? []).flatMap((pergola) => pergola.modules ?? []), [result]);
  const moduleResult = useMemo(() => {
    const route = moduleRoutes[activeModuleIndex] ?? moduleRoutes[0];
    if (!route) return resultModules[0] ?? null;
    const fallbackPergola = result?.pergolas?.[0];
    const pergola = result?.pergolas?.find((entry) => entry.id === route.pergolaId) ?? fallbackPergola;
    return pergola?.modules?.[route.localModuleIndex] ?? resultModules[activeModuleIndex] ?? resultModules[0] ?? null;
  }, [result, resultModules, activeModuleIndex, moduleRoutes]);
  const activeModuleRoute = moduleRoutes[activeModuleIndex] ?? moduleRoutes[0] ?? null;
  const activeModulePergolaLabel = getPergolaLabel(
    pergolas,
    activeModuleRoute?.pergolaId ?? activePergolaId,
    activeModuleIndex,
  );
  const activeModuleLabel = `${activeModulePergolaLabel} - Module ${(activeModuleRoute?.localModuleIndex ?? 0) + 1}`;
  const modulePlanModel = useMemo(() => buildModulePlanModel(activeModule, moduleResult), [activeModule, moduleResult]);
  const moduleSectionModel = useMemo(() => buildModuleSectionModel(activeModule, moduleResult), [activeModule, moduleResult]);
  const canEditActiveHouseFootprint = canEditHouseFootprintPlan(modulePlanModel);
  const activeViewHasModel = moduleViewsTab === 'plan' ? Boolean(modulePlanModel) : Boolean(moduleSectionModel);
  const activeViewSource = moduleViewsTab === 'plan' ? modulePlanModel?.dataSource : moduleSectionModel?.dataSource;
  const moduleViewsStatus: ModuleViewsStatus =
    isCalculating && !activeViewHasModel
      ? 'loading'
      : activeViewHasModel
        ? 'ready'
        : engineError
          ? 'error'
          : 'empty';
  const moduleViewsStatusDetail =
    moduleViewsStatus === 'error'
      ? engineError ?? undefined
      : moduleViewsStatus === 'empty'
        ? 'Enter valid module dimensions to hydrate the view.'
        : moduleViewsStatus === 'ready'
          ? activeViewSource === 'derived'
            ? `Using derived geometry. Active style: ${activeModule.pergolaStyle}${activeModule.boxPerimeterEnabled ? ' (box perimeter)' : ''}`
            : `Using input fallback geometry. Active style: ${activeModule.pergolaStyle}${activeModule.boxPerimeterEnabled ? ' (box perimeter)' : ''}`
          : undefined;

  useEffect(() => {
    if (canEditActiveHouseFootprint && moduleViewsTab === 'plan') return;
    setIsFootprintEditing(false);
    setFootprintHoveredAttachmentSide(null);
    setFootprintHoveredHandleId(null);
    setFootprintActiveHandleId(null);
    setFootprintDragSession(null);
  }, [canEditActiveHouseFootprint, moduleViewsTab]);

  useEffect(() => {
    if (!result) return;
    const baseline = baselineResultRef.current;
    if (!baseline) {
      baselineResultRef.current = result;
      setImpactDiff(null);
      return;
    }
    setImpactDiff(buildImpactDiff(baseline, result));
  }, [result]);

  const resetImpactBaseline = () => {
    if (!result) return;
    baselineResultRef.current = result;
    setImpactDiff(null);
  };

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
  const siteDays = moduleResult?.derived?.site_days ?? resultModules?.[0]?.derived?.site_days;
  const hasOurGutterUi = typeof derivedHasOurGutter === 'boolean' ? derivedHasOurGutter : computeHasOurGutter(activeModule);
  const crewDays = typeof siteDays === 'number' ? siteDays : undefined;

  const materialsEx = result?.materials.totals.materials_ex_gst;
  const installEx = result?.install.totals.install_ex_gst;
  const overheadEx = result?.overhead.total_ex_gst;
  const totalEx = result?.totals.cost_ex_gst;
  const totalInc = result?.totals.cost_inc_gst;
  const materialsExplain = materialsDebugData?.materials_explain ?? null;
  const materialsExplainLines = materialsDebugData?.output.materials.lines ?? [];
  const selectedExplainLine =
    materialsDebugFocusLineIndex !== null && materialsDebugFocusLineIndex >= 0
      ? (materialsExplain?.lines[String(materialsDebugFocusLineIndex)] ?? null)
      : null;
  const selectedMaterialLine =
    materialsDebugFocusLineIndex !== null && materialsDebugFocusLineIndex >= 0
      ? (materialsExplainLines[materialsDebugFocusLineIndex] ?? null)
      : null;
  const materialsExplainJson = useMemo(
    () => (materialsExplain ? toPrettyJson(materialsExplain) : ''),
    [materialsExplain],
  );
  const selectedExplainJson = useMemo(
    () => (selectedExplainLine ? toPrettyJson(selectedExplainLine) : ''),
    [selectedExplainLine],
  );

  const blindsUi = useMemo(() => buildCalculatorBlindsUi(blindsState.items), [blindsState.items]);
  const addonsTotals = buildAddonsTotals(blindsUi.totalEx, blindsUi.totalInc);
  const { coreEx: coreTotalEx, coreInc: coreTotalInc } = computeDisplayTotals(totalEx, totalInc, addonsTotals);
  const engineWarningsRaw = useMemo(() => (result ? deriveSiteResultWarnings(result) : []), [result]);

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

  const generateLabel = isGenerating ? 'Saving…' : 'Save';

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
  const boxPerimeterBeamProfileUsedUi = normalizeOverrideValue(moduleOverrides.boxPerimeterBeamProfile) ?? '300x50';
  const frontBeamOverride = normalizeOverrideValue(moduleOverrides.frontBeamProfile);
  const frontBeamProfileUsed = frontBeamOverride ?? 'SP Gutter';
  const integratedGutterBeamUi = isGutterBeamProfile(frontBeamProfileUsed);
  const showSeparateGutterToggle =
    !activeModule.boxPerimeterEnabled && !activeModule.overhangEnabled && !activeModule.invertedEnabled && !integratedGutterBeamUi;
  const gableGutterOptions =
    activeModule.houseConnectionType === 'none' ? [GABLE_GUTTER_OPTIONS[1]] : GABLE_GUTTER_OPTIONS;

  const blindsListContent = (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blindsUi.rows.map((row, idx) => {
        const item = row.item;
        const statusClassName = row.statusTone === 'error' ? styles.error : styles.helper;
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 10 }}>
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
                options={BLIND_SYSTEM_OPTIONS}
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
                options={BLIND_FABRIC_OPTIONS}
              />
              <FieldTile
                id={`${domIdBase}-motor`}
                label="Motorised"
                type="toggle"
                value={item.motorised === 'YES'}
                onChange={(v) => setBlindItem(item.id, { motorised: v ? 'YES' : 'NONE' })}
              />
              <FieldTile id={`${domIdBase}-total-ex`} label="Blind total (ex‑GST)" type="readOnly" value={row.totalExLabel} />
              <FieldTile id={`${domIdBase}-total-inc`} label="Blind total (inc‑GST)" type="readOnly" value={row.totalIncLabel} />
            </div>
            {row.showStatus ? <div className={statusClassName}>{row.statusMessage}</div> : null}
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
          <span>{blindsUi.totalExLabel}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Blinds total (inc‑GST)</span>
          <span>{blindsUi.totalIncLabel}</span>
        </div>
        <div className={styles.helper}>Totals round to cents; pricing uses banded size lookup.</div>
      </div>
    </div>
  );

  const roofRafterSpacingEstimate = useMemo(
    () =>
      estimateRoofRafterSpacing(
        toNumber(activeModule.lengthM),
        typeof moduleResult?.derived?.rafter_count === 'number' ? moduleResult.derived.rafter_count : undefined,
      ),
    [activeModule.lengthM, moduleResult?.derived?.rafter_count],
  );

  const infillUiById = useMemo<Map<string, InfillUiState>>(
    () =>
      new Map(
        infillsState.items.map((item) => [
          item.id,
          resolveInfillUiState(item, roofRafterSpacingEstimate.spacingM, infillDraftById[item.id]),
        ]),
      ),
    [infillsState.items, roofRafterSpacingEstimate.spacingM, infillDraftById],
  );

  useEffect(() => {
    const next = { ...lastValidInfillEstimateRef.current };
    let changed = false;
    for (const item of infillsState.items) {
      const ui = infillUiById.get(item.id);
      if (!ui) continue;
      if (ui.status === 'valid') {
        next[item.id] = ui.estimate;
        changed = true;
      }
    }
    if (changed) lastValidInfillEstimateRef.current = next;
  }, [infillsState.items, infillUiById]);

  useEffect(() => {
    const next: Record<string, InfillLineItem['acrylicSource']> = {};
    for (const item of infillsState.items) {
      const used = infillUiById.get(item.id)?.estimate.acrylicSourceUsed ?? item.acrylicSource;
      const previous = infillAutoSwitchByIdRef.current[item.id];
      if (previous && previous !== used) {
        trackInfillEvent('infill_auto_switch_triggered', {
          infill_id: item.id,
          location: item.location,
          shape: item.shape.type,
          previous_used: previous,
          current_used: used,
        });
      }
      next[item.id] = used;
    }
    infillAutoSwitchByIdRef.current = next;
  }, [infillUiById, infillsState.items]);

  const selectedInfill = useMemo(
    () => (selectedInfillId ? infillsState.items.find((item) => item.id === selectedInfillId) ?? infillsState.items[0] ?? null : infillsState.items[0] ?? null),
    [infillsState.items, selectedInfillId],
  );

  const selectedInfillIndex = useMemo(
    () => (selectedInfill ? infillsState.items.findIndex((item) => item.id === selectedInfill.id) : -1),
    [infillsState.items, selectedInfill],
  );
  const infillDeleteTarget = useMemo(
    () => (infillDeleteTargetId ? infillsState.items.find((item) => item.id === infillDeleteTargetId) ?? null : null),
    [infillDeleteTargetId, infillsState.items],
  );

  const selectedInfillUi = useMemo(
    () => (selectedInfill ? infillUiById.get(selectedInfill.id) ?? null : null),
    [selectedInfill, infillUiById],
  );
  const selectedInfillEstimate = selectedInfillUi?.estimate ?? null;
  const selectedInfillValidation = selectedInfillUi?.validation ?? null;
  const selectedInfillIsDraft = selectedInfillUi?.status === 'draft';

  useEffect(() => {
    const selectedInfillId = selectedInfill?.id ?? null;
    if (!infillsOpen || !activeModulePayload || !moduleBaseline || !selectedInfillId || !readyToCalculate || isCalculating || engineError) {
      setInfillWithoutCost(null);
      setCompareSheetCost(null);
      setCompareStripCost(null);
      setInfillDecisionError(null);
      setInfillDecisionLoading(false);
      return;
    }

    const sourceInfills = activeModulePayload.infills;
    if (!Array.isArray(sourceInfills) || !sourceInfills.some((entry) => String(entry.id) === selectedInfillId)) {
      setInfillWithoutCost(null);
      setCompareSheetCost(null);
      setCompareStripCost(null);
      setInfillDecisionError(null);
      setInfillDecisionLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setInfillDecisionLoading(true);
      setInfillDecisionError(null);
      try {
        const withoutInfills = removeInfillFromInfills(sourceInfills, selectedInfillId);
        const withoutPayload = buildModulePayloadWithInfills(activeModulePayload, withoutInfills);

        const sheetInfills = replaceInfillInPayload(sourceInfills, selectedInfillId, (entry) =>
          applyAcrylicVariantToInfillPayload(entry, 'sheet_panels'),
        );
        const stripInfills = replaceInfillInPayload(sourceInfills, selectedInfillId, (entry) =>
          applyAcrylicVariantToInfillPayload(entry, 'strip_620'),
        );

        const sheetPayload = buildModulePayloadWithInfills(activeModulePayload, sheetInfills);
        const stripPayload = buildModulePayloadWithInfills(activeModulePayload, stripInfills);

        const [withoutOut, sheetOut, stripOut] = await Promise.all([
          fetchModuleCost(withoutPayload, controller.signal),
          fetchModuleCost(sheetPayload, controller.signal),
          fetchModuleCost(stripPayload, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setInfillWithoutCost(withoutOut);
        setCompareSheetCost(sheetOut);
        setCompareStripCost(stripOut);
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Failed to compare infill options';
        setInfillDecisionError(msg);
      } finally {
        if (!controller.signal.aborted) setInfillDecisionLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeModulePayload, engineError, infillsOpen, isCalculating, moduleBaseline, readyToCalculate, selectedInfill?.id]);

  const uiWarnings = useMemo(
    () =>
      buildCalculatorUiWarnings({
        engineWarnings: engineWarningsRaw,
        infillItems: infillsState.items,
        infillUiById,
      }),
    [engineWarningsRaw, infillUiById, infillsState.items],
  );
  const {
    criticalUiWarnings,
    reviewUiWarnings,
    infoUiWarnings,
    warningsCount,
    warningsHelperText,
  } = useMemo(() => groupCalculatorUiWarnings(uiWarnings), [uiWarnings]);
  const projectHasContact = Boolean((project as { contactId?: string | null } | null)?.contactId);
  const quoteStatusUi = useMemo(
    () =>
      buildCalculatorQuoteStatusUi({
        projectId,
        hasProject: Boolean(project),
        projectHasContact,
        hasModuleErrors,
        engineError,
        hasResult: Boolean(result),
        isCalculating,
        infillItems: infillsState.items,
        infillUiById,
      }),
    [engineError, hasModuleErrors, infillUiById, infillsState.items, isCalculating, project, projectHasContact, projectId, result],
  );
  const statusActionHandlers: Record<CalculatorQuoteStatusActionKey, () => void> = {
    selectProject: () => toast.error('Use Projects in the header to select/create one.'),
    openProject: () => {
      if (projectId) router.push(`/staff/projects/${encodeURIComponent(projectId)}`);
    },
    openIssues: () => setIssuesOpen(true),
    openInfills: () => setInfillsOpen(true),
  };
  const statusItems: StatusItem[] = quoteStatusUi.items.map((item) => ({
    id: item.id,
    label: item.label,
    level: item.level,
    detail: item.detail,
    actionLabel: item.actionLabel,
    onAction: item.actionKey ? statusActionHandlers[item.actionKey] : undefined,
  }));
  const hasStatusBlockers = quoteStatusUi.hasStatusBlockers;

  const saveDesign = useCallback(
    async ({
      createDesignRequest = null,
      saveMode,
    }: {
      createDesignRequest?: { priorityTier: DesignRequestPriorityTier } | null;
      saveMode?: EstimateSaveMode;
    } = {}) => {
      setGenerateError(null);
      await saveCalculatorEstimate({
        activeDraftEstimateMetaId: activeDraftEstimateMeta?.id,
        activeEditEstimateId,
        activeModuleIndex,
        callbacks: {
          closeConfirm: () => setConfirmOpen(false),
          fail: (msg) => {
            setGenerateError(msg);
            toast.error(msg);
          },
          pushRoute: (href) => router.push(href),
          setGenerating: setIsGenerating,
          setLoadedEstimateDetail: (estimate) => {
            loadedEstimateDetailRef.current = estimate;
          },
          success: (msg) => toast.success(msg),
        },
        criticalWarningCount: criticalUiWarnings.length,
        draftEntityKey,
        draftSessionKey,
        email,
        engineWarningsRaw,
        hasStatusBlockers,
        hostKey,
        isEditingDesign,
        loadedEstimateDetail: loadedEstimateDetailRef.current,
        project,
        projectId,
        queryClient,
        request: {
          createDesignRequest,
          saveMode,
        },
        result,
        resultModules,
        values,
      });
    },
    [
      activeModuleIndex,
      activeDraftEstimateMeta?.id,
      activeEditEstimateId,
      criticalUiWarnings.length,
      draftEntityKey,
      draftSessionKey,
      email,
      engineWarningsRaw,
      hasStatusBlockers,
      hostKey,
      isEditingDesign,
      project,
      projectId,
      queryClient,
      result,
      resultModules,
      router,
      toast,
      values,
    ],
  );

  const marginalInfillDelta = useMemo(() => diffModuleCost(moduleBaseline, infillWithoutCost), [moduleBaseline, infillWithoutCost]);
  const compareSheetDelta = useMemo(() => diffModuleCost(compareSheetCost, moduleBaseline), [compareSheetCost, moduleBaseline]);
  const compareStripDelta = useMemo(() => diffModuleCost(compareStripCost, moduleBaseline), [compareStripCost, moduleBaseline]);
  const sheetComplexityEstimate = useMemo(() => {
    if (!selectedInfill) return null;
    const variant = makeDefaultInfillItem({
      ...selectedInfill,
      id: selectedInfill.id,
      acrylicSource: 'sheet_panels',
      targetPanelWidthM: '1.2',
      maxPanelWidthM: '1.2',
    });
    return resolveInfillUiState(variant, roofRafterSpacingEstimate.spacingM, infillDraftById[selectedInfill.id])?.estimate ?? null;
  }, [infillDraftById, roofRafterSpacingEstimate.spacingM, selectedInfill]);
  const stripComplexityEstimate = useMemo(() => {
    if (!selectedInfill) return null;
    const variant = makeDefaultInfillItem({
      ...selectedInfill,
      id: selectedInfill.id,
      acrylicSource: 'strip_620',
      targetPanelWidthM: '0.64',
      maxPanelWidthM: '0.64',
    });
    return resolveInfillUiState(variant, roofRafterSpacingEstimate.spacingM, infillDraftById[selectedInfill.id])?.estimate ?? null;
  }, [infillDraftById, roofRafterSpacingEstimate.spacingM, selectedInfill]);

  const infillSummary = useMemo(
    () => buildCalculatorInfillSummary(infillsState.items, infillUiById),
    [infillsState.items, infillUiById],
  );
  const {
    totals: infillTotals,
    systemSummary: infillSystemSummary,
    usedSpacingSummary: infillUsedSpacingSummary,
    hasInfills,
    line1: infillsSummaryLine1,
    line2: infillsSummaryLine2,
    line3: infillsSummaryLine3,
    text: infillsSummaryText,
    chips: infillSummaryChips,
  } = infillSummary;

  const selectedInfillDomIdBase = selectedInfill ? `infill-${selectedInfill.id}` : 'infill-none';
  const selectedRectShape = selectedInfill?.shape.type === 'rect' ? selectedInfill.shape : null;
  const selectedMonoShape = selectedInfill?.shape.type === 'mono_slope' ? selectedInfill.shape : null;
  const selectedMonoResolved = selectedMonoShape ? resolveMonoSlopeShape(selectedMonoShape) : null;
  const selectedMonoPitchMode = selectedMonoShape ? normalizeMonoSlopeMode(selectedMonoShape.slopeMode) === 'pitch' : false;
  const selectedMonoAnchorField = selectedMonoResolved?.slopeAnchor === 'right' ? 'heightHighM' : 'heightLowM';
  const selectedMonoDerivedHeight =
    selectedMonoResolved?.slopeAnchor === 'right' ? selectedMonoResolved.leftHeightM : selectedMonoResolved?.rightHeightM;
  const selectedComputedWarnings = selectedInfillUi?.warnings ?? [];
  const selectedLastValidEstimate = selectedInfill ? lastValidInfillEstimateRef.current[selectedInfill.id] ?? null : null;
  const computedOrDraftDash = (value: string): string => (selectedInfillIsDraft ? 'Incomplete' : value);
  const {
    selectedDraftGhostLine,
    infillRunConstraintLine,
    infillSpacingConstraintLine,
    selectedAutoSwitchInlineHint,
  } = useMemo(
    () =>
      buildSelectedInfillSummaryCopy({
        selectedInfillEstimate,
        selectedInfillIsDraft,
        selectedLastValidEstimate,
      }),
    [selectedInfillEstimate, selectedInfillIsDraft, selectedLastValidEstimate],
  );
  const showInfillAdvancedSection = false;
  const getVisibleInfillSection = (section: InfillSectionId): InfillSectionId =>
    section === 'advanced' && !showInfillAdvancedSection ? 'basic' : section;

  const { hasClipboard: infillHasClipboard, copyGeometry: copyInfillGeometry, pasteGeometry: pasteInfillGeometry } = useInfillClipboard();

  const setInfillAcrylicPreference = (infillId: string, source: InfillLineItem['acrylicSource']) => {
    const targetWidth = source === 'sheet_panels' ? '1.2' : '0.64';
    setInfillItem(infillId, {
      acrylicSource: source,
      targetPanelWidthM: targetWidth,
      maxPanelWidthM: targetWidth,
    });
  };

  const applyInfillWarningFix = (fix: InfillWarningFix) => {
    if (!selectedInfill) return;
    if (fix.type === 'setPreferredAcrylic') {
      setInfillAcrylicPreference(selectedInfill.id, fix.value);
      return;
    }
    if (fix.type === 'setCentreLimit') {
      setInfillItem(selectedInfill.id, { maxPanelWidthM: String(fix.value), targetPanelWidthM: String(fix.value) });
      return;
    }
    setInfillItem(selectedInfill.id, {
      support: {
        ...selectedInfill.support,
        [fix.key]: fix.value,
      },
    });
  };

  const handleCopyInfillGeometry = async () => {
    if (!selectedInfill) return;
    await copyInfillGeometry(selectedInfill);
    trackInfillEvent('infill_copy_geometry', {
      infill_id: selectedInfill.id,
      location: selectedInfill.location,
      shape: selectedInfill.shape.type,
    });
    toast.success('Geometry copied.');
  };

  const handlePasteInfillGeometry = () => {
    if (!selectedInfill) return;
    const patch = pasteInfillGeometry(selectedInfill);
    if (!patch) {
      toast.error('No geometry copied yet.');
      return;
    }
    setInfillItem(selectedInfill.id, patch);
    setInfillOpenSection('basic');
    trackInfillEvent('infill_paste_geometry', {
      infill_id: selectedInfill.id,
      location: selectedInfill.location,
      shape: selectedInfill.shape.type,
    });
    toast.success('Geometry pasted.');
  };

  useEffect(() => {
    if (selectedComputedWarnings.length > 0) return;
    if (!infillResolveOpen) return;
    setInfillResolveOpen(false);
  }, [infillResolveOpen, selectedComputedWarnings.length]);

  const flashInfillTarget = (el: HTMLElement | null) => {
    if (!el) return;
    el.classList.add(styles.infillJumpFlash);
    window.setTimeout(() => {
      el.classList.remove(styles.infillJumpFlash);
    }, 900);
  };

  const jumpToInfillWarningTarget = (warning: InfillWarningItem) => {
    if (!selectedInfill) return;
    const targetSection = getVisibleInfillSection(warning.target.section);
    setInfillOpenSection(targetSection);
    trackInfillEvent('infill_warning_clicked', {
      infill_id: selectedInfill.id,
      warning_id: warning.id,
      severity: warning.severity,
      section: targetSection,
    });
    window.requestAnimationFrame(() => {
      const fieldId = infillFieldId(selectedInfill.id, warning.target.fieldKey);
      const element = document.getElementById(fieldId) as HTMLElement | null;
      if (!element) return;
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      try {
        element.focus({ preventScroll: true });
      } catch {
        element.focus();
      }
      flashInfillTarget(element);
    });
  };

  const jumpToInfillWarningGlobal = (infillId: string, warning: InfillWarningItem) => {
    setInfillsOpen(true);
    setPendingInfillSelectionId(infillId);
    setSelectedInfillId(infillId);
    pendingInfillWarningJumpRef.current = { infillId, warning };
  };

  useEffect(() => {
    const pending = pendingInfillWarningJumpRef.current;
    if (!pending) return;
    if (!infillsOpen) return;
    if (selectedInfill?.id !== pending.infillId) return;
    pendingInfillWarningJumpRef.current = null;
    jumpToInfillWarningTarget(pending.warning);
  }, [infillsOpen, selectedInfill?.id]);

  const focusInfillPrimaryField = (infillId: string) => {
    setInfillOpenSection('basic');
    window.requestAnimationFrame(() => {
      const field = document.getElementById(`infill-${infillId}-label`) as HTMLElement | null;
      if (!field) return;
      try {
        field.focus({ preventScroll: true });
      } catch {
        field.focus();
      }
    });
  };

  useEffect(() => {
    if (!infillsOpen) {
      infillLastSelectionEventRef.current = null;
      infillModalOpenTrackedRef.current = false;
      return;
    }
    if (infillModalOpenTrackedRef.current) return;
    infillModalOpenTrackedRef.current = true;
    trackInfillEvent('infill_modal_open', {
      infill_count: infillsState.items.length,
      module_index: activeModuleIndex + 1,
    });
  }, [activeModuleIndex, infillsOpen, infillsState.items.length]);

  useEffect(() => {
    if (showInfillAdvancedSection) return;
    if (infillOpenSection !== 'advanced') return;
    setInfillOpenSection('basic');
  }, [infillOpenSection, showInfillAdvancedSection]);

  useEffect(() => {
    if (!infillsOpen || !selectedInfill) return;
    if (infillLastSelectionEventRef.current === selectedInfill.id) return;
    infillLastSelectionEventRef.current = selectedInfill.id;
    trackInfillEvent('infill_select', {
      infill_id: selectedInfill.id,
      location: selectedInfill.location,
      shape: selectedInfill.shape.type,
      panel_count: selectedInfillEstimate?.panelCountEach ?? 0,
      joiners: selectedInfillEstimate?.internalJoinerLinesEach ?? 0,
    });
  }, [infillsOpen, selectedInfill, selectedInfillEstimate?.internalJoinerLinesEach, selectedInfillEstimate?.panelCountEach]);

  const closeInfillModal = () => {
    trackInfillEvent('infill_done', {
      infill_count: infillsState.items.length,
      warnings: selectedComputedWarnings.length,
    });
    setInfillsOpen(false);
    setInfillSummaryOpen(false);
    setInfillResolveOpen(false);
  };

  useInfillHotkeys({
    enabled: infillsOpen && Boolean(selectedInfill),
    disableEsc: Boolean(infillDeleteTarget || infillDuplicateOpen),
    onDuplicate: () => {
      if (!selectedInfill) return;
      duplicateInfill(selectedInfill.id);
    },
    onDuplicateBulk: () => {
      if (!selectedInfill) return;
      setInfillDuplicateOpen(true);
    },
    onCopyGeometry: () => {
      void handleCopyInfillGeometry();
    },
    onPasteGeometry: handlePasteInfillGeometry,
    onMoveUp: () => {
      if (!selectedInfill) return;
      moveInfill(selectedInfill.id, -1);
    },
    onMoveDown: () => {
      if (!selectedInfill) return;
      moveInfill(selectedInfill.id, 1);
    },
    onClose: closeInfillModal,
    onDone: closeInfillModal,
  });

  const infillPresetCards = INFILL_PRESETS.filter((preset) => preset.key !== 'custom');

  const addCustomInfillFromOverview = (openModal = false) => {
    addInfillPreset('custom');
    if (openModal) setInfillsOpen(true);
  };

  const addInfillPresetFromOverview = (preset: InfillPresetKey, openModal = false) => {
    addInfillPreset(preset);
    if (openModal) setInfillsOpen(true);
  };

  const setInfillRowRef = (id: string, node: HTMLButtonElement | null) => {
    if (node) infillRowRefs.current.set(id, node);
    else infillRowRefs.current.delete(id);
  };

  const infillsTileContent = (
    <CalculatorInfillTile
      hasInfills={hasInfills}
      summaryLine1={infillsSummaryLine1}
      summaryChips={infillSummaryChips}
      systemSummary={infillSystemSummary}
      totals={infillTotals}
      presets={infillPresetCards}
      onAddCustom={addCustomInfillFromOverview}
      onAddPreset={addInfillPresetFromOverview}
      onOpenInfills={() => setInfillsOpen(true)}
    />
  );

  const flashingExtraRows = useMemo(
    () => flashingsState.rows.filter((row) => row.kind === 'extra'),
    [flashingsState.rows],
  );

  const flashingTotalsPreview = useMemo(() => calculateFlashingTotalsByBand(flashingsState.rows), [flashingsState.rows]);

  const flashingTotalLengthPreview = useMemo(
    () => calculateFlashingTotalLength(flashingTotalsPreview),
    [flashingTotalsPreview],
  );

  const flashingVisibleBands = useMemo(
    () => selectVisibleFlashingBands(flashingTotalsPreview, showAllFlashingBands),
    [showAllFlashingBands, flashingTotalsPreview],
  );

  const flashingTileContent = (
    <div className={styles.flashingsTileContent}>
      <div className={styles.flashingsHeader}>
        <strong>Flashings</strong>
        <span className={styles.helper}>Defaults auto-apply by roof type; override each row or add extras.</span>
      </div>

      <div className={styles.flashingsTable}>
        <div className={styles.flashingsGridHeader}>
          <div>Item</div>
          <div title="This sets the flashing girth band.">Girth (mm)</div>
          <div>Length (m)</div>
          <div>Purpose</div>
          <div>Remove</div>
        </div>

        {flashingsState.rows.map((row) => {
          const isPrimary = row.kind === 'primary';
          const extraIndex = isPrimary ? -1 : flashingExtraRows.findIndex((extra) => extra.id === row.id) + 1;
          const parsedLength = toNumber(row.lengthM);
          const invalidLength = !Number.isFinite(parsedLength) || parsedLength < 0;
          const zeroLength = Number.isFinite(parsedLength) && parsedLength === 0;
          const duplicatePrimary = isDuplicatePrimaryFlashingRow(row, primaryFlashingRow);

          return (
            <div key={row.id} className={isPrimary ? styles.flashingsRowPrimary : styles.flashingsRow}>
              <div className={styles.flashingsCellItem}>
                <div className={styles.flashingsItemBadge}>{isPrimary ? 'Primary' : `Extra ${extraIndex}`}</div>
                {isPrimary ? <div className={styles.flashingsItemMeta}>Default from roof type; editable.</div> : null}
                {invalidLength ? <div className={styles.flashingsWarning}>Enter a length &gt; 0.</div> : null}
                {!invalidLength && zeroLength ? <div className={styles.flashingsWarning}>0 length will be ignored.</div> : null}
                {duplicatePrimary ? <div className={styles.flashingsWarning}>May double-count primary flashing.</div> : null}
              </div>

              <select
                id={`flashing-row-band-${row.id}`}
                className={styles.control}
                value={row.band}
                onChange={(event) => updateFlashingRow(row.id, { band: event.target.value as CalculatorFlashingBand })}
              >
                {FLASHING_BAND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className={styles.flashingsLengthCell}>
                <input
                  id={`flashing-row-length-${row.id}`}
                  className={styles.control}
                  type="number"
                  min={0}
                  step="0.1"
                  value={row.lengthM}
                  ref={(node) => {
                    if (node) flashingLengthInputRefs.current[row.id] = node;
                    else delete flashingLengthInputRefs.current[row.id];
                  }}
                  onChange={(event) => updateFlashingRow(row.id, { lengthM: event.target.value })}
                />
                <span className={styles.flashingsLengthSuffix}>m</span>
              </div>

              <select
                id={`flashing-row-purpose-${row.id}`}
                className={styles.control}
                value={normalizeFlashingPurpose(row.purpose)}
                onChange={(event) => updateFlashingRow(row.id, { purpose: event.target.value as CalculatorFlashingPurpose })}
              >
                {FLASHING_PURPOSE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {isPrimary ? (
                <div className={styles.flashingsRemovePlaceholder} />
              ) : (
                <button
                  type="button"
                  className={styles.flashingsRemoveButton}
                  title="Remove row"
                  aria-label="Remove row"
                  onClick={() => removeFlashingRow(row.id)}
                >
                  x
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className={styles.flashingsAddButton} onClick={addExtraFlashingRow}>
        + Add flashing row
      </button>

      <div className={styles.flashingsTotalsCard}>
        <div className={styles.flashingsTotalsTitle}>Totals</div>
        <div className={styles.flashingsTotalsRow}>
          <span>Total</span>
          <span>{`${formatMaybeNumber(flashingTotalLengthPreview, 1)} m`}</span>
        </div>
        {flashingVisibleBands.map((band) => (
          <div key={band} className={styles.flashingsTotalsRow}>
            <span>{band}</span>
            <span>{`${formatMaybeNumber(flashingTotalsPreview[band], 1)} m`}</span>
          </div>
        ))}
        <button type="button" className={styles.flashingsTotalsToggle} onClick={() => setShowAllFlashingBands((prev) => !prev)}>
          {showAllFlashingBands ? 'Show non-zero bands only' : 'Show all bands'}
        </button>
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
      options: modulesWithPergola.map((module, idx) => ({
        label: `${getPergolaLabel(pergolas, module.pergolaId, idx)} · Module ${idx + 1}`,
        value: String(idx),
      })),
      helperText:
        values.modules.length > 1
          ? `${values.modules.length} modules across ${pergolas.length} pergola${pergolas.length === 1 ? '' : 's'}`
          : 'Single module job',
    },
    {
      id: 'modulePergolaId',
      label: 'Pergola',
      type: 'select',
      value: activePergolaId,
      onChange: (v) => {
        const targetPergolaId = String(v);
        setValues((prev) => {
          const nextPergolas = normalizePergolasForUi(prev.pergolas);
          if (!nextPergolas.some((pergola) => pergola.id === targetPergolaId)) return prev;
          const modules = prev.modules.slice();
          const current = modules[activeModuleIndex] ?? makeDefaultModule(targetPergolaId);
          modules[activeModuleIndex] = { ...current, pergolaId: targetPergolaId };
          return { ...prev, modules };
        });
      },
      options: pergolas.map((pergola) => ({ label: pergola.label, value: pergola.id })),
      helperText: 'Move this module to another pergola',
    },
    {
      id: 'addModule',
      label: 'Add module to pergola',
      type: 'action',
      actionLabel: 'Add',
      onAction: () => {
        setValues((prev) => {
          const base = prev.modules[activeModuleIndex] ?? prev.modules[0] ?? makeDefaultModule(activePergolaId);
          return { ...prev, modules: [...prev.modules, { ...base, pergolaId: activePergolaId }] };
        });
        setActiveModuleIndex(values.modules.length);
      },
      helperText: 'Duplicates the current module inside this pergola',
    },
    {
      id: 'addPergola',
      label: 'Add pergola',
      type: 'action',
      actionLabel: 'Add',
      onAction: () => {
        setValues((prev) => {
          const createdPergola = nextPergola(prev);
          const base = prev.modules[activeModuleIndex] ?? prev.modules[0] ?? makeDefaultModule(createdPergola.id);
          return {
            ...prev,
            pergolas: [...normalizePergolasForUi(prev.pergolas), createdPergola],
            modules: [...prev.modules, { ...base, pergolaId: createdPergola.id }],
          };
        });
        setActiveModuleIndex(values.modules.length);
      },
      helperText: 'Creates a separate pergola with a starter module',
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
                const normalizedPergolas = prunePergolasForModules(prev.pergolas, nextModules);
                const fallbackId = normalizedPergolas[0]?.id ?? 'pergola-1';
                const nextModulesWithPergola = nextModules.map((module) => {
                  const validPergola = typeof module.pergolaId === 'string' && normalizedPergolas.some((pergola) => pergola.id === module.pergolaId);
                  return validPergola ? module : { ...module, pergolaId: fallbackId };
                });
                return { ...prev, pergolas: normalizedPergolas, modules: nextModulesWithPergola };
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
          const current = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
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
            ? `Box beam = ${boxPerimeterBeamProfileUsedUi}`
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
          const current = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
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
    {
      id: 'roofOrientation',
      label: 'Orientation',
      type: 'custom',
      content: <RoofOrientationDiagram />,
      helperText: 'Length = parallel to ridge. Span = eave‑to‑eave.',
    } satisfies FieldSchemaItem,
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
    {
      id: 'flashings',
      label: 'Flashings',
      type: 'custom',
      content: flashingTileContent,
      error: errors.flashings,
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
          {
            id: 'gableHouseEdgeGutter',
            label: 'House-side eave gutter',
            type: 'select',
            value: activeModule.gableHouseEdgeGutter,
            onChange: (v) => setModuleField('gableHouseEdgeGutter', v as CalculatorModuleInputs['gableHouseEdgeGutter']),
            options: gableGutterOptions,
            helperText: 'Choose whether the house-side eave uses house gutter or our SP gutter support.',
          } satisfies FieldSchemaItem,
          {
            id: 'gableOuterEdgeGutter',
            label: 'Outer-side eave gutter',
            type: 'select',
            value: activeModule.gableOuterEdgeGutter,
            onChange: (v) => setModuleField('gableOuterEdgeGutter', v as CalculatorModuleInputs['gableOuterEdgeGutter']),
            options: gableGutterOptions,
            helperText: 'Choose whether the outer eave uses house gutter or our SP gutter support.',
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
              { label: 'Steel RHS 150x50x3', value: 'RHS 150x50x3' },
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
    ...(activeModule.houseConnectionType !== 'none' && supportsHouseFootprints(activeModule.pergolaStyle)
        ? [
          {
            id: 'attachmentSide',
            label: 'Attachment side',
            type: 'select',
            value: activeAttachmentSide,
            onChange: (v) => setModuleField('attachmentSide', v as CalculatorModuleInputs['attachmentSide']),
            options: [
              { label: 'Rear', value: 'rear' },
              { label: 'Front', value: 'front' },
              { label: 'Left', value: 'left' },
              { label: 'Right', value: 'right' },
            ],
            helperText: 'Select which pergola edge connects to the house in drawings and connection counts.',
          } satisfies FieldSchemaItem,
          {
            id: 'drawingRotationQuarterTurns',
            label: 'Drawing rotation',
            type: 'select',
            value: String(activeDrawingRotationQuarterTurns),
            onChange: (v) =>
              setModuleField(
                'drawingRotationQuarterTurns',
                normalizeDrawingRotationQuarterTurns(v) as CalculatorModuleInputs['drawingRotationQuarterTurns'],
              ),
            options: [
              { label: '0 deg', value: '0' },
              { label: '90 deg', value: '1' },
              { label: '180 deg', value: '2' },
              { label: '270 deg', value: '3' },
            ],
            helperText: 'Rotates the drawing preview in 90 degree increments without changing pricing drivers.',
          } satisfies FieldSchemaItem,
          {
            id: 'houseFootprintPreset',
            label: 'House footprint',
            type: 'select',
            value: activeHouseFootprintPreset,
            onChange: (v) => setModuleField('houseFootprintPreset', normalizeHouseFootprintPreset(v) as CalculatorModuleInputs['houseFootprintPreset']),
            options: [
              { label: 'Straight', value: 'straight' },
              { label: 'L left', value: 'l_left' },
              { label: 'L right', value: 'l_right' },
              { label: 'Recess left', value: 'recess_left' },
              { label: 'Recess right', value: 'recess_right' },
              { label: 'U shape', value: 'u_shape' },
              { label: 'Wrap left', value: 'wrap_left' },
              { label: 'Wrap right', value: 'wrap_right' },
            ],
            helperText: 'Preset house outline used for the plan preview and drawing sheet.',
          } satisfies FieldSchemaItem,
          {
            id: 'houseFootprintBandDepthM',
            label: 'Footprint band depth (m)',
            type: 'number',
            value: activeHouseFootprintParams.bandDepthM,
            onChange: (v) => setHouseFootprintParam('bandDepthM', String(v)),
            helperText: 'Depth of the main hatched house band.',
          } satisfies FieldSchemaItem,
          {
            id: 'houseFootprintWidthM',
            label: 'House width (m)',
            type: 'number',
            value: activeHouseFootprintParams.widthM,
            onChange: (v) => setHouseFootprintParam('widthM', String(v)),
            helperText: 'Blank matches the pergola length.',
          } satisfies FieldSchemaItem,
          {
            id: 'houseFootprintOffsetXM',
            label: 'House offset X (m)',
            type: 'number',
            value: activeHouseFootprintParams.offsetXM,
            onChange: (v) => setHouseFootprintParam('offsetXM', String(v)),
            helperText: 'Negative values extend left of the pergola.',
          } satisfies FieldSchemaItem,
          {
            id: 'houseFootprintSetbackM',
            label: 'Facade setback (m)',
            type: 'number',
            value: activeHouseFootprintParams.setbackM,
            onChange: (v) => setHouseFootprintParam('setbackM', String(v)),
            helperText: 'Visual house context only; pergola attachment stays fixed.',
          } satisfies FieldSchemaItem,
          ...((activeHouseFootprintPreset === 'l_left' || activeHouseFootprintPreset === 'l_right')
            ? [
                {
                  id: 'houseFootprintReturnRunM',
                  label: 'Return run (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.returnRunM,
                  onChange: (v) => setHouseFootprintParam('returnRunM', String(v)),
                } satisfies FieldSchemaItem,
              ]
            : []),
          ...((activeHouseFootprintPreset === 'recess_left' || activeHouseFootprintPreset === 'recess_right')
            ? [
                {
                  id: 'houseFootprintRecessWidthM',
                  label: 'Recess width (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.recessWidthM,
                  onChange: (v) => setHouseFootprintParam('recessWidthM', String(v)),
                } satisfies FieldSchemaItem,
                {
                  id: 'houseFootprintRecessDepthM',
                  label: 'Recess depth (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.recessDepthM,
                  onChange: (v) => setHouseFootprintParam('recessDepthM', String(v)),
                } satisfies FieldSchemaItem,
              ]
            : []),
          ...(activeHouseFootprintPreset === 'u_shape'
            ? [
                {
                  id: 'houseFootprintLeftLegRunM',
                  label: 'Left leg run (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.leftLegRunM,
                  onChange: (v) => setHouseFootprintParam('leftLegRunM', String(v)),
                } satisfies FieldSchemaItem,
                {
                  id: 'houseFootprintRightLegRunM',
                  label: 'Right leg run (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.rightLegRunM,
                  onChange: (v) => setHouseFootprintParam('rightLegRunM', String(v)),
                } satisfies FieldSchemaItem,
              ]
            : []),
          ...((activeHouseFootprintPreset === 'wrap_left' || activeHouseFootprintPreset === 'wrap_right')
            ? [
                {
                  id: 'houseFootprintSideRunM',
                  label: 'Side run (m)',
                  type: 'number',
                  value: activeHouseFootprintParams.sideRunM,
                  onChange: (v) => setHouseFootprintParam('sideRunM', String(v)),
                } satisfies FieldSchemaItem,
              ]
            : []),
        ]
      : []),
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
    {
      id: 'jobType',
      label: 'Job type',
      type: 'select',
      value: values.jobType,
      onChange: (v) => setJobField('jobType', v as CalculatorInputs['jobType']),
      options: [
        { label: 'Residential', value: 'residential' },
        { label: 'Commercial', value: 'commercial' },
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
      helperText: blindsUi.summaryText,
    },
    {
      id: 'infillsEditor',
      label: 'Infills',
      type: 'custom',
      content: infillsTileContent,
      helperText: infillsSummaryText,
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
      helperText: warningsHelperText,
    },
    {
      id: 'generate-estimate',
      label: 'Design',
      type: 'action',
      actionLabel: generateLabel,
      onAction: async () => {
        setGenerateError(null);

        const preflight = resolveGenerateDesignPreflight({
          projectId,
          hasProject: Boolean(project),
          readyToCalculate,
          hasStatusBlockers,
          isCalculating,
          isEditingDesign,
          engineError,
          hasResult: Boolean(result),
          warningCount: warningsCount,
        });
        if (preflight.kind === 'error') {
          setGenerateError(preflight.message);
          return;
        }
        if (preflight.kind === 'save') {
          await saveDesign();
          return;
        }

        setConfirmReady(false);
        setConfirmAcknowledgeWarnings(false);
        setConfirmRequestDesign(false);
        setConfirmRequestDesignPriority(suggestedDesignRequestTier);
        setConfirmOpen(true);
      },
      helperText: projectId ? 'Save current design draft' : 'Requires project context',
      error: generateError ?? undefined,
      disabled: isGenerating || hasStatusBlockers,
    },
  ];

  const generateField = schema.find((field) => field.id === 'generate-estimate') ?? null;

  const schemaMap = useMemo(() => new Map(schema.map((field) => [field.id, field])), [schema]);
  const pickFields = (ids: string[]): FieldSchemaItem[] =>
    ids
      .map((id) => schemaMap.get(id))
      .filter(Boolean) as FieldSchemaItem[];

  const contextFields = pickFields([
    'project-context',
    'draft-notice',
    'moduleIndex',
    'modulePergolaId',
    'addModule',
    'addPergola',
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
    'gableHouseEdgeGutter',
    'gableOuterEdgeGutter',
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

  const flashingsFields = pickFields(['flashings']);

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

  const addonFields = pickFields(['blindsList', 'infillsEditor']);

  const connectionFields = pickFields(['houseConnectionType', 'postConnectionType', 'ground', 'access', 'height', 'jobType']);

  const allowanceFields = pickFields(['travelExGst', 'extrasAllowanceExGst', 'quoteDiscountPct']);

  const houseFootprintFields = pickFields([
    'attachmentSide',
    'drawingRotationQuarterTurns',
    'houseFootprintPreset',
    'houseFootprintBandDepthM',
    'houseFootprintReturnRunM',
    'houseFootprintRecessWidthM',
    'houseFootprintRecessDepthM',
    'houseFootprintLeftLegRunM',
    'houseFootprintRightLegRunM',
    'houseFootprintSideRunM',
  ]);

  const copyMaterialsExplainJson = async () => {
    if (!materialsExplainJson) return;
    try {
      await navigator.clipboard.writeText(materialsExplainJson);
      toast.success('Materials trace JSON copied.');
    } catch {
      toast.error('Failed to copy materials trace JSON.');
    }
  };

  const downloadMaterialsExplainJson = () => {
    if (!materialsExplainJson) return;
    try {
      const blob = new Blob([materialsExplainJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `materials-explain-${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download materials trace JSON.');
    }
  };

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

  const splitStyle = useMemo(
    () =>
      ({
        ['--preview-right-width' as '--preview-right-width']: `${previewRightWidthPx}px`,
      }) as CSSProperties,
    [previewRightWidthPx],
  );

  const updatePreviewSplitFromClientX = (clientX: number) => {
    const frame = previewSplitRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || rect.width <= 0) return;
    const maxWidth = maxPreviewRightWidth(rect.width);
    const candidate = rect.right - clientX;
    setPreviewRightWidthMaxPx(maxWidth);
    setPreviewRightWidthPx(Math.round(clampNumber(candidate, PREVIEW_SPLIT_RIGHT_MIN_PX, maxWidth)));
  };

  const stopPreviewSplitDrag = () => {
    previewSplitPointerIdRef.current = null;
    setIsPreviewSplitDragging(false);
  };

  const handlePreviewSplitPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    if (typeof window !== 'undefined' && window.innerWidth <= PREVIEW_SPLIT_STACK_BREAKPOINT_PX) return;
    previewSplitPointerIdRef.current = event.pointerId;
    setIsPreviewSplitDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePreviewSplitFromClientX(event.clientX);
    event.preventDefault();
  };

  const handlePreviewSplitPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (previewSplitPointerIdRef.current !== event.pointerId) return;
    updatePreviewSplitFromClientX(event.clientX);
  };

  const handlePreviewSplitPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (previewSplitPointerIdRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopPreviewSplitDrag();
  };

  const handlePreviewSplitLostPointerCapture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (previewSplitPointerIdRef.current !== null && previewSplitPointerIdRef.current !== event.pointerId) return;
    stopPreviewSplitDrag();
  };

  const handlePreviewSplitKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (typeof window !== 'undefined' && window.innerWidth <= PREVIEW_SPLIT_STACK_BREAKPOINT_PX) return;
    const step = event.shiftKey ? 48 : 16;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPreviewRightWidthPx((prev) => Math.round(clampNumber(prev + step, PREVIEW_SPLIT_RIGHT_MIN_PX, previewRightWidthMaxPx)));
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPreviewRightWidthPx((prev) => Math.round(clampNumber(prev - step, PREVIEW_SPLIT_RIGHT_MIN_PX, previewRightWidthMaxPx)));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setPreviewRightWidthPx(PREVIEW_SPLIT_RIGHT_MIN_PX);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setPreviewRightWidthPx(previewRightWidthMaxPx);
    }
  };

  const saveDialogSummary: SaveDialogSummary = {
    modules: String(values.modules.length),
    activeModule: `Module ${activeModuleIndex + 1}: ${activeModule.pergolaStyle}${activeModule.boxPerimeterEnabled ? ' + box perimeter' : ''}`,
    roofSize:
      activeModule.pergolaStyle === 'hip_corner'
        ? `A: ${activeModule.lengthM}×${activeModule.projectionM}m, B: ${activeModule.hipCornerLengthBM}×${activeModule.hipCornerProjectionBM}m`
        : `${activeModule.lengthM}m × ${activeModule.projectionM}m`,
    roofMaterial: activeModule.roofMaterial,
    roofPitch:
      typeof derivedPitchUsed === 'number'
        ? `${derivedPitchUsed.toFixed(0)}°`
        : activeModule.roofPitchDeg.trim()
          ? `${activeModule.roofPitchDeg}°`
          : '—',
    materialsEx: formatMaybeMoney(materialsEx),
    installEx: formatMaybeMoney(installEx),
    overheadEx: formatMaybeMoney(overheadEx),
    coreTotalEx: formatMaybeMoney(coreTotalEx),
    blindsEx: formatMaybeMoney(addonsTotals.blinds.ex),
  };

  const closeSaveConfirmDialog = () => {
    setConfirmOpen(false);
    setGenerateError(null);
  };

  const handleIssueDialogClick = (issue: CalculatorIssue) => {
    pendingIssueFocusRef.current = { moduleIndex: issue.moduleIndex, fieldId: issue.fieldId };
    setActiveModuleIndex(issue.moduleIndex);
    setIssuesOpen(false);
  };

  return (
    <main className={`${styles.page} ${styles.previewPage}${isPreviewSplitDragging ? ` ${styles.previewPageResizing}` : ''}`}>
      <h1 className="visually-hidden">Calculator</h1>

      <div className={styles.previewFrame}>
        <div className={`${styles.modeToggleRow} ${styles.modeToggleFloating}`}>
          <button
            type="button"
            className={uiMode === 'basic' ? `${styles.modeToggleButton} ${styles.modeToggleButtonActive}` : styles.modeToggleButton}
            onClick={() => setUiMode('basic')}
          >
            Basic
          </button>
          <button
            type="button"
            className={uiMode === 'advanced' ? `${styles.modeToggleButton} ${styles.modeToggleButtonActive}` : styles.modeToggleButton}
            onClick={() => setUiMode('advanced')}
          >
            Advanced
          </button>
        </div>
        <div className={styles.split} ref={previewSplitRef} style={splitStyle}>
          <div className={styles.leftCol}>
            <FieldGroup title="Context" fields={contextFields} />
            <FieldGroup title="Connections & Site" fields={connectionFields} />
            <FieldGroup title="Structure" fields={structureFields} />
            {isAdvancedUi ? <FieldGroup title="Flashings" fields={flashingsFields} /> : null}
            {isAdvancedUi ? <FieldGroup title="Overrides" fields={overrideFields} /> : null}
            <FieldGroup title="Add-ons" fields={addonFields} />
            <FieldGroup title="Allowances" fields={allowanceFields} />
            {isAdvancedUi ? <FieldGroup title="House Footprint" fields={houseFootprintFields} /> : null}
          </div>

          <button
            type="button"
            className={isPreviewSplitDragging ? `${styles.columnResizeHandle} ${styles.columnResizeHandleActive}` : styles.columnResizeHandle}
            onPointerDown={handlePreviewSplitPointerDown}
            onPointerMove={handlePreviewSplitPointerMove}
            onPointerUp={handlePreviewSplitPointerUp}
            onPointerCancel={handlePreviewSplitPointerUp}
            onLostPointerCapture={handlePreviewSplitLostPointerCapture}
            onKeyDown={handlePreviewSplitKeyDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview panel width"
            aria-valuemin={PREVIEW_SPLIT_RIGHT_MIN_PX}
            aria-valuemax={previewRightWidthMaxPx}
            aria-valuenow={Math.round(clampNumber(previewRightWidthPx, PREVIEW_SPLIT_RIGHT_MIN_PX, previewRightWidthMaxPx))}
            title="Drag to resize preview panel"
          />

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

              <PriceImpactPanel diff={impactDiff} isAdvancedUi={isAdvancedUi} onResetBaseline={resetImpactBaseline} />
              <ModuleViewsCard
                moduleLabel={activeModuleLabel}
                view={moduleViewsTab}
                onViewChange={setModuleViewsTab}
                status={moduleViewsStatus}
                statusDetail={moduleViewsStatusDetail}
                planModel={modulePlanModel}
                sectionModel={moduleSectionModel}
                footprintEditor={
                  canEditActiveHouseFootprint
                    ? {
                        available: true,
                        isEditing: isFootprintEditing,
                        allowAttachmentSideCanvasSelect: true,
                        allowResizeEdgeDrag: true,
                        hoveredAttachmentSide: footprintHoveredAttachmentSide,
                        hoveredHandleId: footprintHoveredHandleId,
                        activeHandleId: footprintActiveHandleId,
                        onStartEditing: startFootprintEditing,
                        onDoneEditing: stopFootprintEditing,
                        onAttachmentSideHover: setFootprintHoveredAttachmentSide,
                        onAttachmentSideSelect: handleFootprintAttachmentSideSelect,
                        onHandleHover: setFootprintHoveredHandleId,
                        onHandleDragStart: handleFootprintDragStart,
                        onPresetSelect: handleFootprintPresetSelect,
                        onRotate: handleFootprintRotate,
                        onSvgMount: handleFootprintSvgMount,
                      }
                    : undefined
                }
              />

              <div className={styles.previewCard} style={{ marginTop: 12, padding: 10, background: 'rgba(var(--portal-text-rgb), 0.02)' }}>
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
                <div className={styles.previewRow}>
                  <span className={styles.previewRowLabel}>Infills</span>
                  <span className={styles.previewRowValue}>{infillsState.items.length ? 'Configured (see BOM)' : 'Not configured'}</span>
                </div>
              </div>

              <QuoteStatusCard items={statusItems} />

              {generateField ? (
                <div className={styles.previewActions}>
                  <button
                    type="button"
                    className={styles.previewPrimaryAction}
                    onClick={generateField.onAction}
                    disabled={generateField.disabled}
                  >
                    {generateField.actionLabel ?? 'Save'}
                  </button>
                  {generateField.error ? <p className={styles.previewError}>{generateField.error}</p> : null}
                </div>
              ) : null}
            </div>

            <section className={styles.previewCard} aria-label="Warnings">
              <h2 className={styles.previewCardTitle}>Warnings</h2>
              {uiWarnings.length ? (
                <ul className={styles.warningList}>
                  {uiWarnings.map((warning) => (
                    <li key={warning.id} className={styles.warningRow}>
                      <span
                        className={
                          warning.severity === 'critical'
                            ? styles.warningBadgeCritical
                            : warning.severity === 'review'
                              ? styles.warningBadgeReview
                              : styles.warningBadgeInfo
                        }
                      >
                        {warning.severity === 'critical' ? 'Critical' : warning.severity === 'review' ? 'Review' : 'Info'}
                      </span>
                      <span className={styles.warningMessage}>{warning.message}</span>
                      {warning.source === 'infill' ? (
                        <button
                          type="button"
                          className={styles.warningJumpButton}
                          onClick={() => jumpToInfillWarningGlobal(warning.infillId, warning.warning)}
                        >
                          Jump
                        </button>
                      ) : null}
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
                  {bomPreview.map((line, idx) => (
                    <div key={`${line.id}-${line.label}-${idx}`} className={styles.previewRow}>
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

            {isAdvancedUi ? (
            <>
            <section className={styles.previewCard} aria-label="Materials debug">
              <div className={styles.materialsDebugHeader}>
                <h2 className={styles.previewCardTitle} style={{ margin: 0 }}>
                  Materials debug
                </h2>
                {!materialsDebugAvailable ? <span className={styles.previewMuted}>Disabled</span> : null}
              </div>
              {materialsDebugAvailable ? (
                <>
                  <div className={styles.materialsDebugControls}>
                    <label className={styles.toggleRow}>
                      <input
                        type="checkbox"
                        className={styles.toggleBox}
                        checked={materialsDebugEnabled}
                        onChange={(e) => setMaterialsDebugEnabled(e.target.checked)}
                      />
                      <span className={styles.toggleText}>Materials Debug</span>
                    </label>
                    <label className={styles.materialsDebugDetail}>
                      <span>Detail</span>
                      <select
                        className={styles.control}
                        value={materialsDebugDetail}
                        onChange={(e) => setMaterialsDebugDetail(e.target.value === 'full' ? 'full' : 'summary')}
                        disabled={!materialsDebugEnabled}
                      >
                        <option value="summary">summary</option>
                        <option value="full">full</option>
                      </select>
                    </label>
                  </div>

                  {materialsDebugEnabled ? (
                    <>
                      {materialsDebugLoading ? <p className={styles.previewMuted}>Loading materials trace…</p> : null}
                      {materialsDebugError ? <p className={styles.previewError}>{materialsDebugError}</p> : null}

                      {materialsExplainLines.length ? (
                        <div className={styles.materialsDebugList}>
                          {materialsExplainLines.map((line, idx) => {
                            const isSelected = materialsDebugFocusLineIndex === idx;
                            return (
                              <button
                                key={`${line.id}-${idx}`}
                                type="button"
                                className={isSelected ? styles.materialsDebugRowActive : styles.materialsDebugRow}
                                onClick={() => setMaterialsDebugFocusLineIndex(idx)}
                              >
                                <span>{`${idx}. ${line.label}`}</span>
                                <span>{`${formatMaybeNumber(line.qty, 2)} ${line.unit}`}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className={styles.previewMuted}>No materials trace lines yet.</p>
                      )}

                      {selectedExplainLine && selectedMaterialLine ? (
                        <div className={styles.materialsDebugExplain}>
                          <div className={styles.previewRow}>
                            <span className={styles.previewRowLabel}>{`${selectedExplainLine.line_index}. ${selectedMaterialLine.label}`}</span>
                            <span className={styles.previewRowValue}>{formatMaybeMoney(selectedMaterialLine.line_cost_ex_gst)}</span>
                          </div>
                          <div className={styles.previewRowMeta}>
                            {formatMaybeNumber(selectedMaterialLine.qty, 2)} {selectedMaterialLine.unit} @{' '}
                            {formatMaybeMoney(selectedMaterialLine.unit_cost_ex_gst)}
                          </div>
                          {selectedExplainLine.kind === 'extrusion_bar' ? (
                            <div className={styles.previewRowMeta}>{`cut_group_key: ${selectedExplainLine.cut_group_key}`}</div>
                          ) : null}
                          {selectedExplainLine.kind === 'rule_hardware' ? (
                            <div className={styles.previewRowMeta}>{`rule: ${selectedExplainLine.rule_id} | expr: ${selectedExplainLine.expr}`}</div>
                          ) : null}
                          <pre className={styles.materialsDebugJson}>{selectedExplainJson}</pre>
                        </div>
                      ) : null}

                      {materialsExplain ? (
                        <div className={styles.materialsDebugActions}>
                          <button type="button" className={styles.drawerClose} onClick={copyMaterialsExplainJson}>
                            Copy JSON
                          </button>
                          <button type="button" className={styles.drawerClose} onClick={downloadMaterialsExplainJson}>
                            Download JSON
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className={styles.previewMuted}>Enable to load line-by-line materials formulas and trace output.</p>
                  )}
                </>
              ) : (
                <p className={styles.previewMuted}>Available only outside production (or with COSTING_DEBUG_ENABLED=1).</p>
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
            </>
            ) : null}
          </aside>
        </div>
      </div>

      {infillsOpen ? (
        <>
        <Modal
          open
          ariaLabel="Infills"
          onClose={closeInfillModal}
          closeOnEsc={!infillDeleteTarget && !infillDuplicateOpen}
          overlayClassName={styles.infillDrawerOverlay}
          panelClassName={styles.infillDrawerPanel}
          maxWidthPx={1520}
        >
          <div className={styles.infillDrawer}>
            <div className={styles.infillDrawerHeader}>
              <div>
                <h2 className={styles.infillDrawerTitle}>Infills</h2>
                <p className={styles.infillDrawerSubtitle}>Acrylic infill modules for this pergola module.</p>
              </div>
              <button type="button" className={styles.infillDrawerClose} onClick={closeInfillModal}>
                Close
              </button>
            </div>

            <div className={styles.infillDrawerBody}>
              <CalculatorInfillRail
                items={infillsState.items}
                selectedInfillId={selectedInfill?.id ?? null}
                uiById={infillUiById}
                rafterSpacingM={roofRafterSpacingEstimate.spacingM}
                listRef={infillListContainerRef}
                summaryLine1={infillsSummaryLine1}
                summaryLine2={infillsSummaryLine2}
                summaryLine3={infillsSummaryLine3}
                hasInfills={hasInfills}
                presets={infillPresetCards}
                onAddCustom={addCustomInfillFromOverview}
                onAddPreset={addInfillPresetFromOverview}
                onSelectInfill={setSelectedInfillId}
                onFocusPrimaryField={focusInfillPrimaryField}
                onMoveInfill={moveInfill}
                onRowRef={setInfillRowRef}
              />

              <section className={styles.infillEditor} aria-label="Selected infill editor">
                {selectedInfill && selectedInfillEstimate && selectedInfillValidation ? (
                  <>
                    <div className={styles.infillEditorHeader}>
                      <div>
                        <h3 className={styles.infillEditorTitle}>{selectedInfill.label?.trim() || `Infill ${selectedInfillIndex + 1}`}</h3>
                        <p className={styles.infillEditorSubtitle}>{locationLabel(selectedInfill.location)}</p>
                        <label className={styles.infillMobileSelectLabel} htmlFor="infill-mobile-select">
                          Infill
                        </label>
                        <select
                          id="infill-mobile-select"
                          className={styles.infillMobileSelect}
                          value={selectedInfill.id}
                          onChange={(event) => setSelectedInfillId(event.target.value)}
                        >
                          {infillsState.items.map((item, idx) => (
                            <option key={item.id} value={item.id}>
                              {item.label?.trim() || `Infill ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.infillEditorActions}>
                        <InfillAddButton label="Add infill" onAddCustom={addCustomInfillFromOverview} />
                        <button
                          type="button"
                          className={`${styles.infillIconButton} ${styles.infillSummaryToggleButton}`}
                          onClick={() => setInfillSummaryOpen((prev) => !prev)}
                        >
                          Summary
                        </button>
                        <InfillActionsMenu
                          disableMoveUp={selectedInfillIndex <= 0}
                          disableMoveDown={selectedInfillIndex >= infillsState.items.length - 1}
                          disablePaste={!infillHasClipboard}
                          onDuplicate={() => duplicateInfill(selectedInfill.id)}
                          onDuplicateBulk={() => setInfillDuplicateOpen(true)}
                          onCopyGeometry={() => {
                            void handleCopyInfillGeometry();
                          }}
                          onPasteGeometry={handlePasteInfillGeometry}
                          onMoveUp={() => moveInfill(selectedInfill.id, -1)}
                          onMoveDown={() => moveInfill(selectedInfill.id, 1)}
                          onDelete={() => requestDeleteInfill(selectedInfill.id)}
                        />
                        <button
                          type="button"
                          className={`${styles.infillIconButton} ${styles.infillDeleteButton}`}
                          onClick={() => requestDeleteInfill(selectedInfill.id)}
                          aria-label={`Delete ${selectedInfill.label?.trim() || `Infill ${selectedInfillIndex + 1}`}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <InfillSectionNav
                      value={infillOpenSection}
                      warningsCount={selectedComputedWarnings.length}
                      showAdvanced={showInfillAdvancedSection}
                      onChange={(next) => {
                        const nextSection = getVisibleInfillSection(next);
                        setInfillOpenSection(nextSection);
                        if (nextSection === 'preview' || nextSection === 'cut_list') setInfillSummaryOpen(true);
                      }}
                    />

                    <div className={styles.infillEditorGrid}>
                      <div className={styles.infillEditorForm}>
                    <details
                      className={styles.infillSection}
                      open={infillOpenSection === 'basic'}
                      onToggle={(event) => {
                        if ((event.currentTarget as HTMLDetailsElement).open) setInfillOpenSection('basic');
                      }}
                    >
                      <summary className={styles.infillSectionSummary}>Basic</summary>
                      <div className={styles.infillBasicGrid}>
                        <div className={styles.span6}>
                          <FieldTile
                            id={`${selectedInfillDomIdBase}-label`}
                            label="Label"
                            type="text"
                            value={selectedInfill.label ?? ''}
                            onChange={(v) => setInfillItem(selectedInfill.id, { label: String(v) })}
                          />
                        </div>
                        <div className={styles.span2}>
                          <FieldTile
                            id={`${selectedInfillDomIdBase}-qty`}
                            label="Qty"
                            type="number"
                            value={selectedInfill.qty}
                            onChange={(v) => setInfillItem(selectedInfill.id, { qty: String(v) })}
                            error={selectedInfillValidation.errors.qty}
                          />
                        </div>
                        <div className={styles.span4}>
                          <FieldTile
                            id={`${selectedInfillDomIdBase}-location`}
                            label="Location"
                            type="select"
                            value={selectedInfill.location}
                            onChange={(v) => setInfillLocation(selectedInfill.id, v as InfillLineItem['location'])}
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
                        <div className={styles.span4}>
                          <FieldTile
                            id={`${selectedInfillDomIdBase}-acrylic`}
                            label="Acrylic type (preferred)"
                            type="select"
                            value={selectedInfill.acrylicSource}
                            onChange={(v) => setInfillAcrylicPreference(selectedInfill.id, v as InfillLineItem['acrylicSource'])}
                            options={[
                              { label: 'Sheet panels', value: 'sheet_panels' },
                              { label: '620 strips', value: 'strip_620' },
                            ]}
                            helperText={selectedAutoSwitchInlineHint ?? infillRunConstraintLine}
                            error={selectedInfillValidation.errors.acrylicSource}
                          />
                          {selectedInfillEstimate?.acrylicSourceAutoSwitched ? (
                            <button
                              type="button"
                              className={styles.infillInlineAction}
                              onClick={() => setInfillAcrylicPreference(selectedInfill.id, selectedInfillEstimate.acrylicSourceUsed)}
                            >
                              {`Set preferred acrylic to ${acrylicSourceLabel(selectedInfillEstimate.acrylicSourceUsed)}`}
                            </button>
                          ) : null}
                        </div>
                        <div className={styles.span4}>
                          <FieldTile
                            id={`${selectedInfillDomIdBase}-joiner-direction`}
                            label="Joiner direction"
                            type="select"
                            value={selectedInfill.panelOrientation}
                            onChange={(v) => setInfillItem(selectedInfill.id, { panelOrientation: normalizePanelOrientation(v) })}
                            options={[
                              { label: 'Auto (recommended)', value: 'auto' },
                              { label: 'Vertical joiners', value: 'vertical' },
                              { label: 'Horizontal joiners', value: 'horizontal' },
                            ]}
                            helperText="Auto chooses the direction that minimizes joiners and extra supports."
                          />
                        </div>
                        <div className={styles.span4}>
                          <FieldTile
                            id={`${selectedInfillDomIdBase}-run-across`}
                            label="Long side / Subdivided side (m)"
                            type="readOnly"
                            value={computedOrDraftDash(
                              `${formatMaybeNumber(selectedInfillEstimate.runSideM, 2)} / ${formatMaybeNumber(selectedInfillEstimate.acrossSideM, 2)}`,
                            )}
                            helperText="Subdivided side is split into bays at the max spacing."
                          />
                        </div>
                        <div className={styles.span4}>
                          <FieldTile
                            id={`${selectedInfillDomIdBase}-centre-limit`}
                            label="Max bay spacing (m)"
                            type="readOnly"
                            value={computedOrDraftDash(formatMaybeNumber(selectedInfillEstimate.maxCentreM, 2))}
                            helperText={infillSpacingConstraintLine}
                          />
                        </div>
                        <div className={styles.span4}>
                          <FieldTile
                            id={`${selectedInfillDomIdBase}-shape-type`}
                            label="Shape"
                            type="select"
                            value={selectedInfill.shape.type}
                            onChange={(v) => {
                              const nextType = v as InfillLineItem['shape']['type'];
                              if (nextType === selectedInfill.shape.type) return;
                              const shapeWidth = selectedInfill.shape.widthM;
                              const shapeBottom = selectedInfill.shape.bottomOffsetM ?? '0';
                              setInfillDraftById((prev) => {
                                if (!prev[selectedInfill.id]) return prev;
                                const next = { ...prev };
                                delete next[selectedInfill.id];
                                return next;
                              });
                              if (nextType === 'rect') {
                                const rectHeight = selectedInfill.shape.type === 'rect' ? selectedInfill.shape.heightM : selectedInfill.shape.heightHighM;
                                setInfillItem(selectedInfill.id, {
                                  shape: { type: 'rect', widthM: shapeWidth, heightM: rectHeight, bottomOffsetM: shapeBottom },
                                });
                                return;
                              }
                              const low = selectedInfill.shape.type === 'rect' ? selectedInfill.shape.heightM : selectedInfill.shape.heightLowM;
                              const high = selectedInfill.shape.type === 'rect' ? selectedInfill.shape.heightM : selectedInfill.shape.heightHighM;
                              setInfillItem(selectedInfill.id, {
                                shape: {
                                  type: 'mono_slope',
                                  widthM: shapeWidth,
                                  heightLowM: low,
                                  heightHighM: high,
                                  bottomOffsetM: shapeBottom,
                                  slopeMode: 'heights',
                                  slopeDeg: '',
                                  slopeAnchor: 'left',
                                },
                              });
                            }}
                            options={[
                              { label: 'Rect', value: 'rect' },
                              { label: 'Mono-slope', value: 'mono_slope' },
                            ]}
                          />
                        </div>

                        {selectedRectShape ? (
                          <>
                            <div className={styles.span4}>
                              <FieldTile
                                id={`${selectedInfillDomIdBase}-shape-width`}
                                label="Width (m)"
                                type="number"
                                value={getInfillDraftValue(selectedInfill, 'widthM')}
                                onChange={(v) => updateRequiredShapeField(selectedInfill, 'widthM', String(v))}
                                onBlur={(v) => commitRequiredShapeField(selectedInfill, 'widthM', String(v))}
                                onEnter={(v) => commitRequiredShapeField(selectedInfill, 'widthM', String(v))}
                                error={selectedInfillValidation.errors.widthM}
                              />
                            </div>
                            <div className={styles.span4}>
                              <FieldTile
                                id={`${selectedInfillDomIdBase}-shape-height`}
                                label="Height (m)"
                                type="number"
                                value={getInfillDraftValue(selectedInfill, 'heightM')}
                                onChange={(v) => updateRequiredShapeField(selectedInfill, 'heightM', String(v))}
                                onBlur={(v) => commitRequiredShapeField(selectedInfill, 'heightM', String(v))}
                                onEnter={(v) => commitRequiredShapeField(selectedInfill, 'heightM', String(v))}
                                error={selectedInfillValidation.errors.heightM}
                              />
                            </div>
                          </>
                        ) : selectedMonoShape ? (
                          <>
                            <div className={styles.span4}>
                              <FieldTile
                                id={`${selectedInfillDomIdBase}-shape-width`}
                                label="Width (m)"
                                type="number"
                                value={getInfillDraftValue(selectedInfill, 'widthM')}
                                onChange={(v) => updateRequiredShapeField(selectedInfill, 'widthM', String(v))}
                                onBlur={(v) => commitRequiredShapeField(selectedInfill, 'widthM', String(v))}
                                onEnter={(v) => commitRequiredShapeField(selectedInfill, 'widthM', String(v))}
                                error={selectedInfillValidation.errors.widthM}
                              />
                            </div>
                            <div className={styles.span4}>
                              <FieldTile
                                id={`${selectedInfillDomIdBase}-shape-mode`}
                                label="Mono-slope input"
                                type="select"
                                value={selectedMonoPitchMode ? 'pitch' : 'heights'}
                                onChange={(v) => {
                                  const nextMode = normalizeMonoSlopeMode(v);
                                  updateMonoSlopeShape(selectedInfill, (shape) => {
                                    const resolved = resolveMonoSlopeShape(shape);
                                    return {
                                      ...shape,
                                      heightLowM: formatInputNumber(resolved.leftHeightM, 3),
                                      heightHighM: formatInputNumber(resolved.rightHeightM, 3),
                                      slopeMode: nextMode,
                                      slopeDeg:
                                        nextMode === 'pitch'
                                          ? resolved.slopeDeg !== null
                                            ? formatInputNumber(resolved.slopeDeg, 2)
                                            : shape.slopeDeg ?? ''
                                          : shape.slopeDeg ?? '',
                                      slopeAnchor: nextMode === 'pitch' ? (resolved.leftHeightM <= resolved.rightHeightM ? 'left' : 'right') : shape.slopeAnchor ?? 'left',
                                    };
                                  });
                                }}
                                options={[
                                  { label: 'Heights', value: 'heights' },
                                  { label: 'Slope (deg)', value: 'pitch' },
                                ]}
                              />
                            </div>
                            {selectedMonoPitchMode ? (
                              <>
                                <div className={styles.span4}>
                                  <FieldTile
                                    id={`${selectedInfillDomIdBase}-shape-anchor`}
                                    label="Lower side"
                                    type="select"
                                    value={selectedMonoResolved?.slopeAnchor ?? 'left'}
                                    onChange={(v) =>
                                      updateMonoSlopeShape(selectedInfill, (shape) => ({
                                        ...shape,
                                        slopeAnchor: normalizeMonoSlopeAnchor(v),
                                      }))
                                    }
                                    options={[
                                      { label: 'Left edge', value: 'left' },
                                      { label: 'Right edge', value: 'right' },
                                    ]}
                                  />
                                </div>
                                <div className={styles.span4}>
                                  <FieldTile
                                    id={`${selectedInfillDomIdBase}-${selectedMonoResolved?.slopeAnchor === 'right' ? 'shape-high' : 'shape-low'}`}
                                    label={selectedMonoResolved?.slopeAnchor === 'right' ? 'Right height (m)' : 'Left height (m)'}
                                    type="number"
                                    value={getInfillDraftValue(selectedInfill, selectedMonoAnchorField as InfillDraftFieldKey)}
                                    onChange={(v) => updateRequiredShapeField(selectedInfill, selectedMonoAnchorField as InfillDraftFieldKey, String(v))}
                                    onBlur={(v) => commitRequiredShapeField(selectedInfill, selectedMonoAnchorField as InfillDraftFieldKey, String(v))}
                                    onEnter={(v) => commitRequiredShapeField(selectedInfill, selectedMonoAnchorField as InfillDraftFieldKey, String(v))}
                                    error={
                                      selectedMonoResolved?.slopeAnchor === 'right'
                                        ? selectedInfillValidation.errors.heightHighM
                                        : selectedInfillValidation.errors.heightLowM
                                    }
                                  />
                                </div>
                                <div className={styles.span4}>
                                  <FieldTile
                                    id={`${selectedInfillDomIdBase}-shape-slope`}
                                    label="Slope (deg)"
                                    type="number"
                                    value={selectedMonoShape.slopeDeg ?? ''}
                                    onChange={(v) =>
                                      updateMonoSlopeShape(selectedInfill, (shape) => ({
                                        ...shape,
                                        slopeDeg: String(v),
                                      }))
                                    }
                                    error={selectedInfillValidation.errors.slopeDeg}
                                    helperText="Positive degrees. The opposite edge height is derived from the lower side and width."
                                  />
                                </div>
                                <div className={styles.span4}>
                                  <FieldTile
                                    id={`${selectedInfillDomIdBase}-${selectedMonoResolved?.slopeAnchor === 'right' ? 'shape-low' : 'shape-high'}`}
                                    label={selectedMonoResolved?.slopeAnchor === 'right' ? 'Left height (derived)' : 'Right height (derived)'}
                                    type="readOnly"
                                    value={formatMaybeNumber(selectedMonoDerivedHeight, 3)}
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div className={styles.span4}>
                                  <FieldTile
                                    id={`${selectedInfillDomIdBase}-shape-low`}
                                    label="Left height (m)"
                                    type="number"
                                    value={getInfillDraftValue(selectedInfill, 'heightLowM')}
                                    onChange={(v) => updateRequiredShapeField(selectedInfill, 'heightLowM', String(v))}
                                    onBlur={(v) => commitRequiredShapeField(selectedInfill, 'heightLowM', String(v))}
                                    onEnter={(v) => commitRequiredShapeField(selectedInfill, 'heightLowM', String(v))}
                                    error={selectedInfillValidation.errors.heightLowM}
                                  />
                                </div>
                                <div className={styles.span4}>
                                  <FieldTile
                                    id={`${selectedInfillDomIdBase}-shape-high`}
                                    label="Right height (m)"
                                    type="number"
                                    value={getInfillDraftValue(selectedInfill, 'heightHighM')}
                                    onChange={(v) => updateRequiredShapeField(selectedInfill, 'heightHighM', String(v))}
                                    onBlur={(v) => commitRequiredShapeField(selectedInfill, 'heightHighM', String(v))}
                                    onEnter={(v) => commitRequiredShapeField(selectedInfill, 'heightHighM', String(v))}
                                    error={selectedInfillValidation.errors.heightHighM}
                                  />
                                </div>
                              </>
                            )}
                          </>
                        ) : null}

                        <div className={styles.span4}>
                          <FieldTile
                            id={`${selectedInfillDomIdBase}-shape-bottom`}
                            label="Bottom offset (m)"
                            type="number"
                            value={selectedInfill.shape.bottomOffsetM ?? '0'}
                            onChange={(v) =>
                              setInfillItem(selectedInfill.id, {
                                shape:
                                  selectedInfill.shape.type === 'rect'
                                    ? { ...selectedInfill.shape, bottomOffsetM: String(v) }
                                    : { ...selectedInfill.shape, bottomOffsetM: String(v) },
                              })
                            }
                            error={selectedInfillValidation.errors.bottomOffsetM}
                          />
                        </div>
                      </div>
                    </details>

                    <details
                      className={`${styles.infillSection} ${styles.infillSectionSecondary}`}
                      open={infillOpenSection === 'supports'}
                      onToggle={(event) => {
                        if ((event.currentTarget as HTMLDetailsElement).open) setInfillOpenSection('supports');
                      }}
                    >
                      <summary className={styles.infillSectionSummary}>Supports (existing fixing members)</summary>
                      <div className={styles.infillFieldGrid}>
                        <FieldTile
                          id={`${selectedInfillDomIdBase}-support-top`}
                          label="Top support exists"
                          type="toggle"
                          value={selectedInfill.support.hasTop}
                          onChange={(v) => setInfillItem(selectedInfill.id, { support: { ...selectedInfill.support, hasTop: Boolean(v) } })}
                        />
                        <FieldTile
                          id={`${selectedInfillDomIdBase}-support-bottom`}
                          label="Bottom support exists"
                          type="toggle"
                          value={selectedInfill.support.hasBottom}
                          onChange={(v) => setInfillItem(selectedInfill.id, { support: { ...selectedInfill.support, hasBottom: Boolean(v) } })}
                          helperText="Never slab; if unchecked we assume additional member required."
                        />
                        <FieldTile
                          id={`${selectedInfillDomIdBase}-support-left`}
                          label="Left support exists"
                          type="toggle"
                          value={selectedInfill.support.hasLeft}
                          onChange={(v) => setInfillItem(selectedInfill.id, { support: { ...selectedInfill.support, hasLeft: Boolean(v) } })}
                        />
                        <FieldTile
                          id={`${selectedInfillDomIdBase}-support-right`}
                          label="Right support exists"
                          type="toggle"
                          value={selectedInfill.support.hasRight}
                          onChange={(v) => setInfillItem(selectedInfill.id, { support: { ...selectedInfill.support, hasRight: Boolean(v) } })}
                        />
                        <FieldTile
                          id={`${selectedInfillDomIdBase}-support-internal-mode`}
                          label="Internal support mode"
                          type="select"
                          value={selectedInfill.support.internalSupportMode ?? 'none'}
                          onChange={(v) =>
                            setInfillItem(selectedInfill.id, {
                              support: { ...selectedInfill.support, internalSupportMode: String(v) as InfillLineItem['support']['internalSupportMode'] },
                            })
                          }
                          options={[
                            { label: 'None', value: 'none' },
                            { label: 'Match roof rafters', value: 'match_roof_rafters' },
                            { label: 'Center', value: 'center' },
                            { label: 'Custom positions', value: 'custom' },
                          ]}
                        />
                        {(selectedInfill.support.internalSupportMode ?? 'none') === 'custom' ? (
                          <FieldTile
                            id={`${selectedInfillDomIdBase}-support-internal-pos`}
                            label="Custom internal positions (m)"
                            type="text"
                            value={(selectedInfill.support.internalSupportPositionsM ?? []).join(', ')}
                            onChange={(v) =>
                              setInfillItem(selectedInfill.id, {
                                support: {
                                  ...selectedInfill.support,
                                  internalSupportPositionsM: String(v)
                                    .split(',')
                                    .map((token) => token.trim())
                                    .filter(Boolean),
                                },
                              })
                            }
                            helperText="Offsets along the subdivided side (m). Example: 0.8, 1.6"
                            error={selectedInfillValidation.errors.internalSupportPositionsM}
                          />
                        ) : null}
                      </div>
                    </details>

                    {showInfillAdvancedSection ? (
                      <details
                        className={`${styles.infillSection} ${styles.infillSectionSecondary}`}
                        open={infillOpenSection === 'advanced'}
                        onToggle={(event) => {
                          if ((event.currentTarget as HTMLDetailsElement).open) setInfillOpenSection('advanced');
                        }}
                      >
                        <summary className={styles.infillSectionSummary}>Advanced</summary>
                        <p className={styles.modalNote}>No advanced infill options configured yet.</p>
                      </details>
                    ) : null}

                      </div>

                      <aside
                        id="infill-summary-panel"
                        className={`${styles.infillEditorSummary} ${infillSummaryOpen ? styles.infillEditorSummaryOpen : ''}`.trim()}
                      >
                    <section className={styles.infillComputedPanel} aria-label="Computed infill summary">
                      <div className={styles.infillSummaryTabs}>
                        <button
                          type="button"
                          className={
                            infillOpenSection === 'cut_list'
                              ? styles.infillSummaryTabButton
                              : `${styles.infillSummaryTabButton} ${styles.infillSummaryTabButtonActive}`
                          }
                          onClick={() => setInfillOpenSection('preview')}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className={
                            infillOpenSection === 'cut_list'
                              ? `${styles.infillSummaryTabButton} ${styles.infillSummaryTabButtonActive}`
                              : styles.infillSummaryTabButton
                          }
                          onClick={() => setInfillOpenSection('cut_list')}
                        >
                          Cut list
                        </button>
                      </div>
                      {infillOpenSection === 'cut_list' ? (
                        <InfillCutList status={selectedInfillIsDraft ? 'draft' : 'valid'} rows={selectedInfillEstimate.cutListRows ?? []} />
                      ) : (
                        <>
                          <InfillPreview
                            status={selectedInfillIsDraft ? 'draft' : 'valid'}
                            shape={selectedInfill.shape}
                            orientationUsed={selectedInfillEstimate.panelOrientationUsed}
                            panelCountEach={selectedInfillEstimate.panelCountEach}
                            unsupportedJoinerIndicesEach={selectedInfillEstimate.unsupportedInternalIndicesEach}
                            supports={selectedInfill.support}
                            bayBoundariesM={selectedInfillEstimate.bayBoundariesM}
                            bayWidthsM={selectedInfillEstimate.bayWidthsM}
                            joinerLines={selectedInfillEstimate.joinerLines}
                            runSideM={selectedInfillEstimate.runSideM}
                            acrossSideM={selectedInfillEstimate.acrossSideM}
                            centreLimitM={selectedInfillEstimate.maxCentreM}
                          />
                          <div className={styles.infillComputedGroup}>
                            <div className={styles.infillComputedGroupTitle}>Decision support</div>
                            {moduleBaselineLoading ? <p className={styles.infillComputedNote}>Loading module baseline...</p> : null}
                            {moduleBaselineError ? <p className={styles.previewError}>{moduleBaselineError}</p> : null}
                            {infillDecisionLoading ? <p className={styles.infillComputedNote}>Running option comparison...</p> : null}
                            {infillDecisionError ? <p className={styles.previewError}>{infillDecisionError}</p> : null}
                            <div className={styles.infillDecisionCard}>
                              <div className={styles.infillDecisionTitle}>Marginal cost (this infill)</div>
                              <PreviewRow label="Delta total (ex-GST)" value={formatSignedMoney(marginalInfillDelta?.total_ex)} />
                              <PreviewRow label="Delta total (inc-GST)" value={formatSignedMoney(marginalInfillDelta?.total_inc)} />
                              <PreviewRow label="Delta materials (ex-GST)" value={formatSignedMoney(marginalInfillDelta?.materials_ex)} />
                              <PreviewRow label="Delta install (ex-GST)" value={formatSignedMoney(marginalInfillDelta?.install_ex)} />
                              <p className={styles.infillComputedNote}>Marginal vs current module; pooling across job not represented.</p>
                            </div>
                            <div className={styles.infillDecisionCard}>
                              <div className={styles.infillDecisionTitle}>Compare sheet vs 620 strips</div>
                              <div className={styles.infillDecisionRow}>
                                <div className={styles.infillDecisionMain}>
                                  <div className={styles.infillDecisionLabel}>Sheet panels</div>
                                  <div className={styles.infillDecisionMeta}>
                                    {`Delta total ${formatSignedMoney(compareSheetDelta?.total_ex)} | Delta materials ${formatSignedMoney(compareSheetDelta?.materials_ex)} | Delta install ${formatSignedMoney(compareSheetDelta?.install_ex)}`}
                                  </div>
                                  <div className={styles.infillDecisionMeta}>
                                    {`Complexity: panels ~${sheetComplexityEstimate?.panelCountTotal ?? '—'}, 50x50 ~${sheetComplexityEstimate?.estimatedMullionsTotal ?? '—'}`}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.infillDecisionApply}
                                  onClick={() => setInfillAcrylicPreference(selectedInfill.id, 'sheet_panels')}
                                >
                                  Apply
                                </button>
                              </div>
                              <div className={styles.infillDecisionRow}>
                                <div className={styles.infillDecisionMain}>
                                  <div className={styles.infillDecisionLabel}>620 strips</div>
                                  <div className={styles.infillDecisionMeta}>
                                    {`Delta total ${formatSignedMoney(compareStripDelta?.total_ex)} | Delta materials ${formatSignedMoney(compareStripDelta?.materials_ex)} | Delta install ${formatSignedMoney(compareStripDelta?.install_ex)}`}
                                  </div>
                                  <div className={styles.infillDecisionMeta}>
                                    {`Complexity: panels ~${stripComplexityEstimate?.panelCountTotal ?? '—'}, 50x50 ~${stripComplexityEstimate?.estimatedMullionsTotal ?? '—'}`}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.infillDecisionApply}
                                  onClick={() => setInfillAcrylicPreference(selectedInfill.id, 'strip_620')}
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          </div>
                          <h3 className={styles.infillComputedTitle}>Computed summary</h3>
                          {selectedDraftGhostLine ? <p className={styles.infillComputedGhost}>{selectedDraftGhostLine}</p> : null}

                      <div className={styles.infillComputedGroup}>
                        <div className={styles.infillComputedGroupTitle}>Layout</div>
                        <PreviewRow
                          label="Joiner direction used"
                          value={computedOrDraftDash(
                            selectedInfillEstimate.panelOrientationUsed === 'vertical' ? 'Vertical joiners' : 'Horizontal joiners',
                          )}
                        />
                        <PreviewRow
                          label="Acrylic used"
                          value={computedOrDraftDash(
                            `${acrylicSourceLabel(selectedInfillEstimate.acrylicSourceUsed)}${
                              selectedInfillEstimate.acrylicSourceAutoSwitched ? ' (auto-switched)' : ''
                            }`,
                          )}
                        />
                        {selectedInfillEstimate.acrylicSourceAutoSwitched ? (
                          <details className={styles.infillAutoSwitchWhy}>
                            <summary>Why?</summary>
                            <p>
                              {`Auto-switch triggered because run ${formatMaybeNumber(selectedInfillEstimate.runSideM, 2)}m exceeds ${acrylicSourceLabel(
                                selectedInfillEstimate.preferredAcrylicSource,
                              )} max ${formatMaybeNumber(maxRunForAcrylicSource(selectedInfillEstimate.preferredAcrylicSource), 2)}m.`}
                            </p>
                          </details>
                        ) : null}
                        <PreviewRow
                          label="Long side / Subdivided side"
                          value={computedOrDraftDash(
                            `${formatMaybeNumber(selectedInfillEstimate.runSideM, 2)}m / ${formatMaybeNumber(selectedInfillEstimate.acrossSideM, 2)}m`,
                          )}
                        />
                        <PreviewRow label="Max bay spacing" value={computedOrDraftDash(`${formatMaybeNumber(selectedInfillEstimate.maxCentreM, 2)}m`)} />
                        <PreviewRow
                          label="Panels across"
                          value={computedOrDraftDash(`${selectedInfillEstimate.panelCountEach} each / ${selectedInfillEstimate.panelCountTotal} total`)}
                        />
                        <PreviewRow
                          label="Internal joiner lines"
                          value={computedOrDraftDash(
                            `${selectedInfillEstimate.internalJoinerLinesEach} each / ${selectedInfillEstimate.internalJoinerLinesTotal} total`,
                          )}
                        />
                      </div>

                      <div className={styles.infillComputedGroup}>
                        <div className={styles.infillComputedGroupTitle}>Support impact</div>
                        <PreviewRow
                          label="Joiners needing support"
                          value={computedOrDraftDash(
                            `${selectedInfillEstimate.unsupportedInternalEach} each / ${selectedInfillEstimate.unsupportedInternalTotal} total`,
                          )}
                        />
                        <PreviewRow
                          label="Estimated 50x50 mullions"
                          value={computedOrDraftDash(
                            `${selectedInfillEstimate.estimatedMullionsEach} each / ${selectedInfillEstimate.estimatedMullionsTotal} total`,
                          )}
                        />
                        <PreviewRow
                          label="Missing boundary supports"
                          value={computedOrDraftDash(
                            `${selectedInfillEstimate.missingJambsEach} each / ${selectedInfillEstimate.missingJambsTotal} total`,
                          )}
                        />
                      </div>

                      <div className={styles.infillComputedGroup}>
                        <div className={styles.infillComputedGroupTitle}>Acrylic procurement estimate</div>
                        {selectedInfillEstimate.acrylicSourceUsed === 'strip_620' ? (
                          <>
                            <PreviewRow label="Strip width" value={computedOrDraftDash('0.62m')} />
                            <PreviewRow
                              label="Required cut lengths"
                              value={computedOrDraftDash(
                                selectedInfillEstimate.stripCutMinM !== null && selectedInfillEstimate.stripCutMaxM !== null
                                  ? `${formatMaybeNumber(selectedInfillEstimate.stripCutMinM, 2)}m to ${formatMaybeNumber(selectedInfillEstimate.stripCutMaxM, 2)}m`
                                  : 'No cuts calculated',
                              )}
                            />
                          </>
                        ) : (
                          <PreviewRow
                            label="Area"
                            value={computedOrDraftDash(
                              `${formatMaybeNumber(selectedInfillEstimate.sheetAreaEachM2, 2)}m2 each / ${formatMaybeNumber(selectedInfillEstimate.sheetAreaTotalM2, 2)}m2 total`,
                            )}
                          />
                        )}
                      </div>

                      {selectedComputedWarnings.length ? (
                        <div className={styles.infillComputedGroup}>
                          <div className={styles.infillComputedGroupHeader}>
                            <div className={styles.infillComputedGroupTitle}>Warnings</div>
                            <button
                              type="button"
                              className={styles.infillIconButton}
                              onClick={() => {
                                setInfillResolveOpen(true);
                                trackInfillEvent('infill_resolve_mode_open', {
                                  infill_id: selectedInfill.id,
                                  warnings: selectedComputedWarnings.length,
                                });
                              }}
                            >
                              Resolve warnings ({selectedComputedWarnings.length})
                            </button>
                          </div>
                          <ul className={styles.infillWarningList}>
                            {selectedComputedWarnings.map((warning) => (
                              <li key={warning.id}>
                                <button type="button" className={styles.infillWarningButton} onClick={() => jumpToInfillWarningTarget(warning)}>
                                  <span>{warning.message}</span>
                                  <span className={styles.infillWarningJump}>Jump</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                          <ResolveWarningsPanel
                            open={infillResolveOpen}
                            warnings={selectedComputedWarnings}
                            onClose={() => setInfillResolveOpen(false)}
                            onJumpToField={jumpToInfillWarningTarget}
                            onApplyFix={(fix, warning) => {
                              applyInfillWarningFix(fix);
                              trackInfillEvent('infill_resolve_apply_fix', {
                                infill_id: selectedInfill.id,
                                warning_id: warning.id,
                                fix_type: fix.type,
                              });
                            }}
                          />
                        </div>
                      ) : null}
                        </>
                      )}
                    </section>
                      </aside>
                    </div>
                  </>
                ) : infillsState.items.length === 0 ? (
                  <div className={styles.infillEditorEmpty}>
                    <strong className={styles.infillEditorEmptyTitle}>Choose how you want to start</strong>
                    <p>Use a preset for the fastest setup, or create a custom infill if this layout is unique.</p>
                    <div className={styles.infillEditorEmptySectionTitle}>Use a preset</div>
                    <div className={styles.infillPresetCardGrid}>
                      {infillPresetCards.map((preset) => (
                        <button key={preset.key} type="button" className={styles.infillPresetCard} onClick={() => addInfillPreset(preset.key)}>
                          <strong>{preset.label}</strong>
                        </button>
                      ))}
                    </div>
                    <button type="button" className={styles.infillPrimaryButton} onClick={() => addInfillPreset('custom')}>
                      Add custom infill
                    </button>
                    <p className={styles.infillEditorEmptyNote}>
                      Presets are the quickest way to begin. You can edit panel layout, supports, and dimensions afterwards.
                    </p>
                  </div>
                ) : (
                  <div className={styles.infillEditorEmpty}>
                    <strong className={styles.infillEditorEmptyTitle}>Select an infill to edit it</strong>
                    <p>Pick one from the list, or add a new infill to this module.</p>
                    <div className={styles.infillEditorActions}>
                      <InfillPresetMenu label="Presets" presets={infillPresetCards} onAddPreset={addInfillPresetFromOverview} />
                      <button type="button" className={styles.infillSecondaryButton} onClick={() => addInfillPreset('custom')}>
                        Add custom infill
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className={styles.infillDrawerFooter}>
              <span className={styles.infillDrawerFooterNote}>Changes save automatically.</span>
              <button type="button" className={styles.modalButtonPrimary} onClick={closeInfillModal}>
                Done
              </button>
            </div>

            {deletedInfill ? (
              <div className={styles.infillUndoToast} role="status" aria-live="polite">
                <span>Infill deleted.</span>
                <button type="button" className={styles.infillUndoButton} onClick={undoDeleteInfill}>
                  Undo
                </button>
              </div>
            ) : null}
          </div>
        </Modal>
        <DuplicateDialog
          open={infillDuplicateOpen && Boolean(selectedInfill)}
          sourceLabel={selectedInfill?.label?.trim() || `Infill ${Math.max(1, selectedInfillIndex + 1)}`}
          onCancel={() => setInfillDuplicateOpen(false)}
          onConfirm={({ count, labelPattern }) => {
            if (!selectedInfill) return;
            duplicateInfillBulk(selectedInfill.id, count, labelPattern);
            setInfillDuplicateOpen(false);
          }}
        />
        <ConfirmDialog
          open={Boolean(infillDeleteTarget)}
          title="Delete infill?"
          body={
            infillDeleteTarget
              ? `Delete "${infillDeleteTarget.label?.trim() || 'this infill'}"? You can undo this for a few seconds.`
              : 'Delete this infill?'
          }
          confirmLabel="Delete"
          danger
          onConfirm={confirmDeleteInfill}
          onCancel={() => setInfillDeleteTargetId(null)}
        />
        </>
      ) : null}

      <CalculatorSaveDialogs
        issuesOpen={issuesOpen}
        issues={issues}
        onCloseIssues={() => setIssuesOpen(false)}
        onIssueClick={handleIssueDialogClick}
        confirmOpen={confirmOpen}
        onCloseConfirm={closeSaveConfirmDialog}
        saveConfirmation={{
          isEditingDesign,
          summary: saveDialogSummary,
          warnings: {
            uiWarnings,
            criticalUiWarnings,
            reviewUiWarnings,
            infoUiWarnings,
          },
          confirmReady,
          confirmAcknowledgeWarnings,
          confirmRequestDesign,
          confirmRequestDesignPriority,
          generateError,
          isGenerating,
          hasStatusBlockers,
          hasResult: Boolean(result),
          onConfirmReadyChange: setConfirmReady,
          onConfirmAcknowledgeWarningsChange: setConfirmAcknowledgeWarnings,
          onConfirmRequestDesignChange: (checked) => {
            setConfirmRequestDesign(checked);
            if (checked) setConfirmRequestDesignPriority(suggestedDesignRequestTier);
          },
          onConfirmRequestDesignPriorityChange: setConfirmRequestDesignPriority,
          onSave: () =>
            void saveDesign({
              createDesignRequest: confirmRequestDesign ? { priorityTier: confirmRequestDesignPriority } : null,
              saveMode: isEditingDesign ? 'preserve_current' : 'reprice_latest',
            }),
          onRepriceLatest: () => void saveDesign({ saveMode: 'reprice_latest' }),
        }}
      />
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
