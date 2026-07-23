'use client';

import type { CostInputsV1, RoofType, SiteInputsV1, SiteOutputV1 } from '@sp/costing';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './CalculatorGrid.module.css';
import type {
  BlindLineItem,
  CalculatorBlindsState,
  CalculatorFlashingBand,
  CalculatorFlashingPurpose,
  CalculatorFlashingsState,
  CalculatorInputs,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import {
  supportsHouseFootprints,
} from '@/lib/types/calculator';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { Project } from '@/lib/types/project';
import { apiJson } from '@/lib/repo/apiClient';
import { getProject } from '@/lib/repo/projectsRepo';
import { duplicateEstimateToDraft } from '@/lib/repo/estimatesRepo';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import InfillPreview from './InfillPreview';
import {
  addedSupportSummary,
  canOfferRafterMatching,
  infillResultStatus,
  isInfillOpeningComplete,
} from './infillConfiguratorPresentation';
import type { StatusItem } from './QuoteStatusCard';
import {
  canEditHouseFootprintPlan,
  type ModuleViewsStatus,
  type ModuleViewsTab,
} from './ModuleViewsCard';
import { buildModulePlanModel, buildModuleSectionModel } from './moduleViews';
import { buildImpactDiff, type ImpactDiff } from './diff';
import {
  resolveInfillUiState,
  type InfillUiState,
} from './infillCompute';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { qk } from '@/lib/queries/keys';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import {
  buildSiteInputsFromCalculatorInputs,
  deriveSiteResultWarnings,
} from '@/lib/estimates/costingPayload';
import {
  buildCalculatorDraftEntityKey,
  buildEstimateEntityKey,
  isLocalEstimateId,
} from '@/lib/localFirst/portalEntities';
import {
  getLocalFirstWorkingCopy,
  resolveLocalFirstId,
} from '@/lib/localFirst/store';
import {
  calculatorDraftSessionKey,
  calculatorInputsFromEstimateDetail,
  clampInt,
  computeBayCountsForModule,
  computeHasOurGutter,
  formatFlashingLengthInput,
  getPitchForModule,
  getRoofTypeForModule,
  isGutterBeamProfile,
  isPrimaryFlashingLengthAutoLinked,
  makeBlindId,
  makeDefaultBlindItem,
  makeDefaultModule,
  makeDefaultPrimaryFlashingRow,
  makeFlashingId,
  normalizeBlindsStateForUi,
  normalizeCalculatorInputsForUi,
  normalizeFlashingBand,
  normalizeFlashingPurpose,
  normalizeFlashingsStateForUi,
  normalizeInfillsStateForUi,
  normalizeOverrideValue,
  roofLengthForPrimaryFlashing,
  toNonNegativeInt,
  toNumber,
} from './calculatorInputs';
import { useCalculatorDraftSession } from './useCalculatorDraftSession';
import { applyCalculatorJobTemplate, type CalculatorJobTemplateKey } from './calculatorJobTemplates';
import {
  addCalculatorModule,
  addCalculatorPergola,
  buildCalculatorModuleNavigatorModel,
  calculatorPergolaOptions,
  duplicateCalculatorModule,
  moveCalculatorModule,
  renameCalculatorPergola,
  removeCalculatorModule,
} from './calculatorModuleNavigation';
import {
  designRequestTierFromTotal,
} from './calculatorSaveWorkflow';
import {
  acrylicSourceLabel,
  estimateRoofRafterSpacing,
  locationLabel,
  parseInfillsForPayload,
} from './calculatorInfillUi';
import { buildCalculatorInfillSummary } from './calculatorInfillSummary';
import {
  buildFlashingDefaultsForModule,
} from './calculatorFlashingUi';
import {
  buildCalculatorBlindsUi,
  formatBlindMetresInput,
  parseBlindMetresInputToMmString,
} from './calculatorBlindUi';
import CalculatorBlindsEditor, { type BlindDimensionField } from './CalculatorBlindsEditor';
import CalculatorFlashingsEditor from './CalculatorFlashingsEditor';
import {
  buildCalculatorQuoteStatusUi,
  buildCalculatorUiWarnings,
  groupCalculatorUiWarnings,
  type CalculatorQuoteStatusActionKey,
} from './calculatorQuoteStatusUi';
import { CalculatorInfillTile } from './CalculatorInfillOverview';
import type { SaveDialogSummary } from './CalculatorSaveDialogs';
import { buildCalculatorIssues } from './calculatorIssueNavigation';
import type { CalculatorUiMode } from './CalculatorCommandBar';
import type { CalculatorConfigurationField as FieldSchemaItem } from './calculatorConfigurationSections';
import { buildCalculatorSiteFields } from './calculatorSiteFields';
import { buildCalculatorStructureFields } from './calculatorStructureFields';
import {
  buildCalculatorContextFields,
  buildCalculatorWorkflowFields,
} from './calculatorWorkflowFields';
import type { CalculatorPricingSummaryProps } from './CalculatorPricingSummary';
import { useCalculatorPricingPreview } from './calculatorPricingPreview';
import { useCalculatorPreviewSplit } from './useCalculatorPreviewSplit';
import { buildCalculatorPricingComparison } from './calculatorPricingComparison';
import {
  deriveCalculatorResultFreshness,
} from './calculatorResultFreshness';
import { useCalculatorCostingRequest } from './useCalculatorCostingRequest';
import { useCalculatorInfillController } from './useCalculatorInfillController';
import { useCalculatorIssueNavigation } from './useCalculatorIssueNavigation';
import {
  useCalculatorSaveController,
  type CalculatorSaveContext,
} from './useCalculatorSaveController';
import { useCalculatorMaterialsDebug } from './useCalculatorMaterialsDebug';
import { useCalculatorInfillCostComparison } from './useCalculatorInfillCostComparison';
import { useCalculatorInfillActions } from './useCalculatorInfillActions';
import { useCalculatorHouseFootprintController } from './useCalculatorHouseFootprintController';
import CalculatorWorkspaceView, { type CalculatorWorkspaceViewProps } from './CalculatorWorkspaceView';
import type { CalculatorInfillWorkspaceProps } from './CalculatorInfillWorkspace';
import {
  resolveCalculatorWorkspaceRoute,
  type CalculatorProjectWorkspace,
} from './calculatorWorkspace';

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}
function blindDimensionDraftKey(id: string, field: BlindDimensionField): string {
  return `${id}:${field}`;
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

const UI_MODE_STORAGE_KEY = 'sanctuary-portal:calculator:uiMode:v1';


export default function CalculatorGridClient({
  email: emailProp,
  role: roleProp,
  workspace,
}: {
  email?: string;
  role?: 'admin' | 'staff';
  workspace?: CalculatorProjectWorkspace;
}) {
  const { email: sessionEmail, role: sessionRole } = usePortalSession();
  const email = typeof emailProp === 'string' ? emailProp : (sessionEmail ?? '');
  const role = (roleProp ?? (sessionRole ?? 'staff')) === 'admin' ? 'admin' : 'staff';
  const canViewInternalCosts = role === 'admin';

  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const toast = useToast();
  const workspaceRoute = resolveCalculatorWorkspaceRoute(searchParams, workspace);
  const hostKey = useMemo(
    () => workspaceRoute.host || supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown',
    [workspaceRoute.host],
  );
  const {
    createNewEstimate,
    editEstimateId,
    fromEstimateId,
    projectId,
    shouldOpenActiveDraft,
  } = workspaceRoute;
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
  const [loadedEstimateDetail, setLoadedEstimateDetail] = useState<EstimateDetail | null>(null);
  const {
    values,
    setValues,
    activeModuleIndex,
    setActiveModuleIndex,
    draftHydrated,
    restoredFromLocalDraft,
    localDraftStatus,
    acceptExternalDraft,
  } = useCalculatorDraftSession({
    draftEntityKey,
    draftSessionKey,
    awaitsExternalDraft: Boolean(activeEditEstimateId || fromEstimateId),
  });
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [uiMode, setUiMode] = useState<CalculatorUiMode>('basic');
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [moduleViewsTab, setModuleViewsTab] = useState<ModuleViewsTab>('plan');
  const previewSplit = useCalculatorPreviewSplit();
  const [blindDimensionDraftsM, setBlindDimensionDraftsM] = useState<Record<string, string>>({});
  const baselineResultRef = useRef<SiteOutputV1 | null>(null);
  const [impactDiff, setImpactDiff] = useState<ImpactDiff | null>(null);
  const primaryFlashingManualOverrideRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    setLoadedEstimateDetail(null);
  }, [draftEntityKey]);

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
    if (!nextEditEstimateId && !workspace) return;
    setEditSessionEstimateId(nextEditEstimateId);
  }, [editEstimateId, workspace]);

  useEffect(() => {
    if (workspace) return;
    if (!draftHydrated || !projectId || activeEditEstimateId || fromEstimateId) return;
    if (restoredFromLocalDraft && !shouldOpenActiveDraft) return;
    if (!activeDraftEstimateMeta) return;
    const qs = new URLSearchParams(searchParams.toString());
    qs.set('projectId', projectId);
    qs.set('editEstimateId', activeDraftEstimateMeta.id);
    qs.delete('fromEstimateId');
    qs.delete('openActiveDraft');
    router.replace(`/staff/calculator?${qs.toString()}`);
  }, [activeDraftEstimateMeta, activeEditEstimateId, draftHydrated, fromEstimateId, projectId, restoredFromLocalDraft, router, searchParams, shouldOpenActiveDraft, workspace]);

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
          setLoadedEstimateDetail(estimate);
          if (estimate.editability.isLocked) {
            const msg = `Design ${estimate.versionLabel} is locked and can no longer be edited.`;
            setDraftNotice(msg);
            toast.error(msg);
            if (projectId && !workspace) {
              router.replace(
                `/staff/projects/${encodeURIComponent(projectId)}?tab=estimates&estimateId=${encodeURIComponent(
                  resolvedEditEstimateId || activeEditEstimateId,
                )}`,
              );
            }
            return;
          }

          if (restoredFromLocalDraft) {
            setDraftNotice(`Restored unsaved edits for ${estimate.versionLabel}`);
            return;
          }

          const draft = calculatorInputsFromEstimateDetail(estimate);
          acceptExternalDraft(draft);
          const msg =
            isLocalEstimateId(estimate.id) || (resolvedEditEstimateId ?? activeEditEstimateId).startsWith('local-estimate:')
              ? `Editing design ${estimate.versionLabel}. Changes will keep syncing in the background.`
              : `Editing design ${estimate.versionLabel}`;
          setDraftNotice(msg);
          toast.success(msg);
          return;
        }

        if (restoredFromLocalDraft) return;

        const draft = await duplicateEstimateToDraft(fromEstimateId);
        const normalizedDraft = normalizeCalculatorInputsForUi({
          ...draft,
          schemaVersion: 'v2',
          modules: Array.isArray(draft.modules) ? draft.modules : [],
          blinds: normalizeBlindsStateForUi((draft as any).blinds),
        } as CalculatorInputs);

        acceptExternalDraft(normalizedDraft);
        const msg = `Draft design started from ${fromEstimateId}`;
        setDraftNotice(msg);
        toast.success(msg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start design revision';
        setDraftNotice(msg);
        toast.error(msg);
      }
    })();
  }, [acceptExternalDraft, activeEditEstimateId, draftHydrated, fromEstimateId, hostKey, projectId, queryClient, restoredFromLocalDraft, router, toast, workspace]);

  const pergolas = useMemo(() => calculatorPergolaOptions(values), [values]);
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

  const moduleNavigatorModel = useMemo(
    () => buildCalculatorModuleNavigatorModel({ values, activeModuleIndex, errorsByModule }),
    [activeModuleIndex, errorsByModule, values],
  );

  const commitModuleMutation = useCallback((result: ReturnType<typeof addCalculatorModule>) => {
    setValues(result.values);
    setActiveModuleIndex(result.activeModuleIndex);
  }, [setActiveModuleIndex, setValues]);

  const handleAddModule = useCallback((pergolaId: string) => {
    commitModuleMutation(addCalculatorModule(values, activeModuleIndex, pergolaId));
  }, [activeModuleIndex, commitModuleMutation, values]);

  const handleAddPergola = useCallback(() => {
    commitModuleMutation(addCalculatorPergola(values, activeModuleIndex));
  }, [activeModuleIndex, commitModuleMutation, values]);

  const handleRenamePergola = useCallback((pergolaId: string, label: string) => {
    setValues(renameCalculatorPergola(values, pergolaId, label));
  }, [setValues, values]);

  const handleApplyJobTemplate = useCallback((templateKey: CalculatorJobTemplateKey) => {
    setValues(applyCalculatorJobTemplate(values, activeModuleIndex, templateKey));
  }, [activeModuleIndex, setValues, values]);

  const handleDuplicateModule = useCallback((moduleIndex: number) => {
    commitModuleMutation(duplicateCalculatorModule(values, activeModuleIndex, moduleIndex));
  }, [activeModuleIndex, commitModuleMutation, values]);

  const handleMoveModule = useCallback((moduleIndex: number, targetPergolaId: string) => {
    commitModuleMutation(moveCalculatorModule(values, activeModuleIndex, moduleIndex, targetPergolaId));
  }, [activeModuleIndex, commitModuleMutation, values]);

  const handleRemoveModule = useCallback((moduleIndex: number) => {
    commitModuleMutation(removeCalculatorModule(values, activeModuleIndex, moduleIndex));
  }, [activeModuleIndex, commitModuleMutation, values]);

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
    return id;
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

  const blindsState = normalizeBlindsStateForUi(values.blinds);

  useEffect(() => {
    if (values.blinds !== blindsState) {
      setValues((prev) => ({ ...prev, blinds: blindsState }));
    }
  }, [values.blinds, blindsState]);

  useEffect(() => {
    setBlindDimensionDraftsM((prev) => {
      const validKeys = new Set(
        blindsState.items.flatMap((item) => [
          blindDimensionDraftKey(item.id, 'widthMm'),
          blindDimensionDraftKey(item.id, 'coverLengthMm'),
        ]),
      );
      const nextEntries = Object.entries(prev).filter(([key]) => validKeys.has(key));
      if (nextEntries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(nextEntries);
    });
  }, [blindsState.items]);

  const setBlindItem = (id: string, patch: Partial<BlindLineItem>) => {
    setValues((prev) => {
      const current = normalizeBlindsStateForUi(prev.blinds);
      const items = current.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
      return { ...prev, blinds: { items } };
    });
  };

  const updateBlindDimensionInput = (id: string, field: BlindDimensionField, nextMetresValue: string) => {
    const draftKey = blindDimensionDraftKey(id, field);
    setBlindDimensionDraftsM((prev) => {
      if (prev[draftKey] === nextMetresValue) return prev;
      return { ...prev, [draftKey]: nextMetresValue };
    });
    setBlindItem(id, { [field]: parseBlindMetresInputToMmString(nextMetresValue) } as Pick<BlindLineItem, BlindDimensionField>);
  };

  const commitBlindDimensionInput = (id: string, field: BlindDimensionField) => {
    const draftKey = blindDimensionDraftKey(id, field);
    setBlindDimensionDraftsM((prev) => {
      if (!(draftKey in prev)) return prev;
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
  };

  const displayBlindDimensionInput = (item: BlindLineItem, field: BlindDimensionField) => {
    const draftKey = blindDimensionDraftKey(item.id, field);
    return blindDimensionDraftsM[draftKey] ?? formatBlindMetresInput(item[field]);
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
  const materialsDebugAvailable = canViewInternalCosts
    && (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_COSTING_DEBUG_ENABLED === '1');

  const {
    result,
    lastSuccessfulRequestPayloadJson,
    engineError,
    isCalculating,
  } = useCalculatorCostingRequest({
    readyToCalculate,
    requestPayloadJson,
  });
  const blindFieldPrefix = useId();

  const resultFreshness = useMemo(
    () =>
      deriveCalculatorResultFreshness({
        readyToCalculate,
        isCalculating,
        engineError,
        hasResult: Boolean(result),
        requestPayloadJson,
        lastSuccessfulRequestPayloadJson,
      }),
    [engineError, isCalculating, lastSuccessfulRequestPayloadJson, readyToCalculate, requestPayloadJson, result],
  );

  const materialsDebug = useCalculatorMaterialsDebug({
    available: materialsDebugAvailable,
    isAdvancedUi,
    activeModuleIndex,
    readyToCalculate,
    activeModulePayload,
    onSuccess: (message) => toast.success(message),
    onError: (message) => toast.error(message),
  });

  const issues = useMemo(
    () =>
      buildCalculatorIssues({
        errorsByModule,
        moduleLabels: moduleNavigatorModel.items.map((item) => item.label),
      }),
    [errorsByModule, moduleNavigatorModel.items],
  );

  const issuesCount = issues.length;
  const suggestedDesignRequestTier = useMemo(
    () => designRequestTierFromTotal(result?.totals?.cost_inc_gst ?? null),
    [result?.totals?.cost_inc_gst],
  );

  const {
    issuesOpen,
    openIssues,
    closeIssues,
    selectIssue,
  } = useCalculatorIssueNavigation({ activeModuleIndex, setActiveModuleIndex });

  const {
    infillsOpen,
    openInfills,
    closeInfills,
    selectedInfillId,
    selectInfill,
    requestInfillSelection,
    infillDraftById,
    setInfillDraftValue,
    clearInfillDraftField,
    clearInfillDraft,
    getInfillDraftValue,
    infillStage,
    setInfillStage,
    deletedInfill,
    deleteInfillState,
    restoreDeletedInfill,
    infillDuplicateOpen,
    openInfillDuplicate,
    closeInfillDuplicate,
    infillCostDetailsOpen,
    setInfillCostDetailsOpen,
    infillListContainerRef,
    setInfillRowRef,
  } = useCalculatorInfillController({ items: infillsState.items });

  const resultModules = useMemo(() => (result?.pergolas ?? []).flatMap((pergola) => pergola.modules ?? []), [result]);
  const moduleResult = useMemo(() => {
    const route = moduleRoutes[activeModuleIndex] ?? moduleRoutes[0];
    if (!route) return resultModules[0] ?? null;
    const fallbackPergola = result?.pergolas?.[0];
    const pergola = result?.pergolas?.find((entry) => entry.id === route.pergolaId) ?? fallbackPergola;
    return pergola?.modules?.[route.localModuleIndex] ?? resultModules[activeModuleIndex] ?? resultModules[0] ?? null;
  }, [result, resultModules, activeModuleIndex, moduleRoutes]);
  const activeModuleLabel = moduleNavigatorModel.activeModuleLabel;
  const modulePlanModel = useMemo(() => buildModulePlanModel(activeModule, moduleResult), [activeModule, moduleResult]);
  const moduleSectionModel = useMemo(() => buildModuleSectionModel(activeModule, moduleResult), [activeModule, moduleResult]);
  const canEditActiveHouseFootprint = canEditHouseFootprintPlan(modulePlanModel);
  const {
    drawingRotationQuarterTurns: activeDrawingRotationQuarterTurns,
    setHouseFootprintParam,
    editor: houseFootprintEditor,
  } = useCalculatorHouseFootprintController({
    activeModule,
    activeModuleIndex,
    activePergolaId,
    canEditByInputs: canEditHouseFootprintByInputs,
    editorAvailable: canEditActiveHouseFootprint,
    moduleViewsTab,
    setValues,
    setModuleField,
  });
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
  const blindsUi = useMemo(() => buildCalculatorBlindsUi(blindsState.items), [blindsState.items]);
  const pricingPreview = useCalculatorPricingPreview({
    result,
    inputs: values,
    blindPricing: blindsUi.pricing,
    estimateSnapshot: loadedEstimateDetail?.calculatorSnapshot,
    resultFreshness,
  });
  const pricingComparison = useMemo(
    () =>
      isEditingDesign
        ? buildCalculatorPricingComparison({
            estimate: loadedEstimateDetail,
            values,
            liveResult: result,
          })
        : null,
    [isEditingDesign, loadedEstimateDetail, result, values],
  );
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


  const blindsListContent = (
    <CalculatorBlindsEditor
      ui={blindsUi}
      fieldPrefix={blindFieldPrefix}
      displayDimensionInput={displayBlindDimensionInput}
      onDimensionChange={updateBlindDimensionInput}
      onDimensionCommit={commitBlindDimensionInput}
      onItemChange={setBlindItem}
      onDuplicate={duplicateBlind}
      onRemove={removeBlind}
      onAdd={addBlind}
    />
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
          resolveInfillUiState(item, roofRafterSpacingEstimate.spacingM, infillDraftById[item.id], toNumber(activeModule.lengthM)),
        ]),
      ),
    [activeModule.lengthM, infillsState.items, roofRafterSpacingEstimate.spacingM, infillDraftById],
  );

  const selectedInfill = useMemo(
    () => (selectedInfillId ? infillsState.items.find((item) => item.id === selectedInfillId) ?? infillsState.items[0] ?? null : infillsState.items[0] ?? null),
    [infillsState.items, selectedInfillId],
  );

  const selectedInfillIndex = useMemo(
    () => (selectedInfill ? infillsState.items.findIndex((item) => item.id === selectedInfill.id) : -1),
    [infillsState.items, selectedInfill],
  );
  const selectedInfillUi = useMemo(
    () => (selectedInfill ? infillUiById.get(selectedInfill.id) ?? null : null),
    [selectedInfill, infillUiById],
  );
  const selectedInfillEstimate = selectedInfillUi?.estimate ?? null;
  const selectedInfillValidation = selectedInfillUi?.validation ?? null;
  const selectedInfillIsDraft = selectedInfillUi?.status === 'draft';

  const infillCostComparison = useCalculatorInfillCostComparison({
    canViewInternalCosts,
    infillsOpen,
    detailsOpen: infillCostDetailsOpen,
    activeModulePayload,
    readyToCalculate,
    isCalculating,
    engineError,
    selectedInfill,
    moduleLengthM: activeModule.lengthM,
    roofRafterSpacingM: roofRafterSpacingEstimate.spacingM,
    selectedInfillDraft: selectedInfill ? infillDraftById[selectedInfill.id] : undefined,
  });

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
        invalidBlindCount: blindsUi.rows.filter((row) => row.hasErrors).length,
        engineError,
        resultFreshness,
        infillItems: infillsState.items,
        infillUiById,
      }),
    [blindsUi.rows, engineError, hasModuleErrors, infillUiById, infillsState.items, project, projectHasContact, projectId, resultFreshness],
  );
  const statusActionHandlers: Record<CalculatorQuoteStatusActionKey, () => void> = {
    selectProject: () => setProjectPickerOpen(true),
    openProject: () => {
      if (workspace) workspace.onOpenProject();
      else if (projectId) router.push(`/staff/projects/${encodeURIComponent(projectId)}`);
    },
    openIssues,
    openBlinds: () => {
      const element = document.getElementById('blindsList');
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const firstInvalidBlind = element?.querySelector<HTMLElement>('[aria-invalid="true"]');
      firstInvalidBlind?.focus({ preventScroll: true });
    },
    openInfills,
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

  const handleProjectSelect = (selectedProject: Project) => {
    setProjectPickerOpen(false);
    router.push(`/staff/calculator?projectId=${encodeURIComponent(selectedProject.id)}&openActiveDraft=1`);
  };

  const calculatorSaveContext: CalculatorSaveContext = {
    activeDraftEstimateMetaId: activeDraftEstimateMeta?.id,
    activeEditEstimateId,
    activeModuleIndex,
    criticalWarningCount: criticalUiWarnings.length,
    draftEntityKey,
    draftSessionKey,
    email,
    engineWarningsRaw,
    hasStatusBlockers,
    hostKey,
    isEditingDesign,
    loadedEstimateDetail,
    project,
    projectId,
    queryClient,
    createNewEstimate,
    result,
    resultModules,
    values,
  };
  const {
    generateError,
    isGenerating,
    generateLabel,
    openSaveConfirmation,
    confirmOpen,
    closeSaveConfirmation,
    confirmAcknowledgeWarnings,
    setConfirmAcknowledgeWarnings,
    pricingPreserveReason,
    setPricingPreserveReason,
    confirmRequestDesign,
    setConfirmRequestDesignChecked,
    confirmRequestDesignPriority,
    setConfirmRequestDesignPriority,
    saveConfirmed,
    repriceLatest,
    saveOutcome,
    dismissSaveOutcome,
  } = useCalculatorSaveController({
    saveContext: calculatorSaveContext,
    suggestedDesignRequestTier,
    preflight: {
      projectId,
      hasProject: Boolean(project),
      readyToCalculate,
      hasStatusBlockers,
      resultFreshness,
    },
    setLoadedEstimateDetail,
    onError: (message) => toast.error(message),
    onSaved: (outcome) => {
      setEditSessionEstimateId(outcome.estimateId);
      workspace?.onEstimateSaved(outcome.estimateId);
      toast.success('Design saved on this device.');
    },
  });

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
  const selectedComputedWarnings = selectedInfillUi?.warnings ?? [];
  const selectedCriticalWarnings = selectedComputedWarnings.filter((warning) => warning.severity === 'error');
  const selectedOpeningComplete = selectedInfillUi ? isInfillOpeningComplete(selectedInfillUi) : false;
  const selectedResultStatus = selectedInfillUi ? infillResultStatus(selectedInfillUi) : null;
  const selectedCanOfferRafterMatching = selectedInfill && selectedInfillEstimate
    ? canOfferRafterMatching(selectedInfill.location, selectedInfillEstimate.widthM, toNumber(activeModule.lengthM))
    : false;
  const selectedInfillPreview = selectedInfill && selectedInfillEstimate ? (
    <InfillPreview
      mode={infillStage}
      status={selectedInfillIsDraft ? 'draft' : 'valid'}
      shape={selectedInfill.shape}
      orientationUsed={selectedInfillEstimate.panelOrientationUsed}
      panelCountEach={selectedInfillEstimate.panelCountEach}
      panelPolygons={selectedInfillEstimate.panelPolygons}
      unsupportedJoinerIndicesEach={selectedInfillEstimate.unsupportedInternalIndicesEach}
      supports={selectedInfill.support}
      bayBoundariesM={selectedInfillEstimate.bayBoundariesM}
      bayWidthsM={selectedInfillEstimate.bayWidthsM}
      joinerLines={selectedInfillEstimate.joinerLines}
      acrossSideM={selectedInfillEstimate.acrossSideM}
    />
  ) : null;
  const {
    presets: infillPresetCards,
    hasClipboard: infillHasClipboard,
    addInfillPreset,
    addCustomInfillFromOverview,
    addInfillPresetFromOverview,
    duplicateSelectedInfill,
    confirmSelectedDuplicate,
    handleCopyInfillGeometry,
    handlePasteInfillGeometry,
    moveInfill,
    moveSelectedInfill,
    deleteSelectedInfill,
    undoDeleteInfill,
    handleInfillStageChange,
    jumpToInfillWarningTarget,
    jumpToInfillWarningGlobal,
    focusInfillPrimaryField,
    closeInfillModal,
    getSelectedDraftValue,
    changeSelectedItem,
    changeSelectedLocation,
    changeSelectedShapeTemplate,
    changeSelectedDraft,
    commitSelectedDraft,
    changeSelectedMonoMode,
    changeSelectedMonoAnchor,
    changeSelectedMonoSlope,
    changeSelectedBottomOffset,
    changeSelectedAcrylicSource,
    changeSelectedPanelOrientation,
    changeSelectedSupport,
    changeSelectedInternalMode,
    changeSelectedCustomPositions,
  } = useCalculatorInfillActions({
    activeModule,
    activeModuleIndex,
    activePergolaId,
    infills: infillsState.items,
    setValues,
    selectedInfill,
    selectedInfillEstimate,
    selectedCanOfferRafterMatching,
    selectedWarningCount: selectedComputedWarnings.length,
    infillsOpen,
    infillDuplicateOpen,
    openInfills,
    closeInfills,
    openInfillDuplicate,
    closeInfillDuplicate,
    requestInfillSelection,
    setInfillStage,
    setInfillDraftValue,
    clearInfillDraftField,
    clearInfillDraft,
    getInfillDraftValue,
    deleteInfillState,
    restoreDeletedInfill,
    flashClassName: styles.infillJumpFlash,
    notifySuccess: (message) => toast.success(message),
    notifyError: (message) => toast.error(message),
  });

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
      onOpenInfills={openInfills}
    />
  );

  const flashingTileContent = (
    <CalculatorFlashingsEditor
      state={flashingsState}
      primaryRow={primaryFlashingRow}
      onAddRow={addExtraFlashingRow}
      onUpdateRow={updateFlashingRow}
      onRemoveRow={removeFlashingRow}
    />
  );

  const schema: FieldSchemaItem[] = [
    ...buildCalculatorContextFields({
      resultFreshness,
      engineError,
      project,
      projectId,
      projectError,
      draftNotice,
      values,
      setJobField,
    }),

    ...buildCalculatorStructureFields({
      activeModule,
      activeModuleIndex,
      activePergolaId,
      errors,
      flashingTileContent,
      setValues,
      setModuleField,
      setModuleOverride,
    }),
    ...buildCalculatorSiteFields({
      activeModule,
      activeDrawingRotationQuarterTurns,
      values,
      errors,
      derivedBoxPitch,
      derivedBoxRiseMm,
      derivedBoxMaxFallMm,
      hasOurGutterUi,
      setModuleField,
      setJobField,
      setHouseFootprintParam,
    }),

    ...buildCalculatorWorkflowFields({
      blindsListContent,
      blindsUi,
      infillsTileContent,
      infillsSummaryText,
      values,
      setJobField,
      derivedArea,
      derivedRoofArea,
      derivedAcrylicArea,
      derivedTimberArea,
      derivedAcrylicBaysTotal,
      derivedPitchUsed,
      derivedSlopeLength,
      moduleResult,
      roofingProcurementSummary,
      rafterCountTotal,
      rafterProfile,
      rafterHelperText,
      bracketCount,
      crewHours,
      materialsEx,
      installEx,
      overheadEx,
      totalEx,
      totalInc,
      issuesCount,
      onOpenIssues: openIssues,
      result,
      warningsCount,
      warningsHelperText,
      generateLabel,
      onGenerate: openSaveConfirmation,
      projectId,
      generateError,
      isGenerating,
      hasStatusBlockers,
      resultFreshness,
    }),
  ];

  const generateField = schema.find((field) => field.id === 'generate-estimate') ?? null;

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

  const saveDialogSummary: SaveDialogSummary = {
    modules: String(values.modules.length),
    activeModule: `${activeModuleLabel}: ${activeModule.pergolaStyle}${activeModule.boxPerimeterEnabled ? ' + box perimeter' : ''}`,
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
    trueCostEx: formatMaybeMoney(totalEx),
    blindCustomerEx: formatMaybeMoney(blindsUi.totalEx),
    customerTotalInc: formatMaybeMoney(pricingPreview.totalIncGstCents / 100),
  };

  const pricingSummaryProps: CalculatorPricingSummaryProps = {
    resultFreshness,
    issuesCount,
    onOpenIssues: openIssues,
    customerTotalIncGstCents: pricingPreview.totalIncGstCents,
    customerTotalExGstCents: pricingPreview.totalExGstCents,
    undiscountedTotalIncGstCents: pricingPreview.undiscountedTotalIncGstCents,
    quoteDiscountPct: pricingPreview.discountPct,
    unpricedItemCount: pricingPreview.unpricedItemCount,
    hasCustomerPricing: pricingPreview.hasCorePricing,
    canViewInternalCosts,
    internalTrueCostExGst: totalEx,
    internalTrueCostIncGst: totalInc,
    materialsExGst: materialsEx,
    installExGst: installEx,
    overheadExGst: overheadEx,
    crewHours,
    installDays: crewDays,
  };

  const structureOutputRows = [
    { label: 'Area (m²)', value: formatMaybeNumber(derivedArea) },
    { label: 'Roof area (m²)', value: formatMaybeNumber(derivedRoofArea) },
    { label: 'Acrylic area (m²)', value: formatMaybeNumber(derivedAcrylicArea) },
    { label: 'Timber area (m²)', value: formatMaybeNumber(derivedTimberArea) },
    { label: 'Pitch used (deg)', value: typeof derivedPitchUsed === 'number' ? derivedPitchUsed.toFixed(0) : '—' },
    { label: 'Slope length (m)', value: formatMaybeNumber(derivedSlopeLength) },
    { label: 'Rafters', value: rafterCountTotal && rafterProfile ? `${rafterCountTotal} × ${rafterProfile}` : '—' },
    { label: 'Brackets', value: typeof bracketCount === 'number' ? String(bracketCount) : '—' },
  ];

  const infillWorkspaceProps: CalculatorInfillWorkspaceProps = {
    open: infillsOpen,
    dialog: {
      closeOnEsc: !infillDuplicateOpen,
      onClose: closeInfillModal,
      stage: infillStage,
      openingComplete: selectedOpeningComplete,
      blockerCount: selectedCriticalWarnings.length,
      onStageChange: handleInfillStageChange,
    },
    header: selectedInfill ? {
      items: infillsState.items,
      selectedItem: selectedInfill,
      selectedIndex: selectedInfillIndex,
      locationLabel: locationLabel(selectedInfill.location),
      disablePaste: !infillHasClipboard,
      onSelect: selectInfill,
      onAdd: addCustomInfillFromOverview,
      onDuplicate: duplicateSelectedInfill,
      onDuplicateBulk: openInfillDuplicate,
      onCopyGeometry: () => { void handleCopyInfillGeometry(); },
      onPasteGeometry: handlePasteInfillGeometry,
      onMoveUp: () => moveSelectedInfill(-1),
      onMoveDown: () => moveSelectedInfill(1),
      onDelete: deleteSelectedInfill,
    } : null,
    showUndo: Boolean(deletedInfill),
    onUndo: undoDeleteInfill,
    rail: {
      items: infillsState.items,
      selectedInfillId: selectedInfill?.id ?? null,
      uiById: infillUiById,
      rafterSpacingM: roofRafterSpacingEstimate.spacingM,
      listRef: infillListContainerRef,
      summaryLine1: infillsSummaryLine1,
      summaryLine2: infillsSummaryLine2,
      summaryLine3: infillsSummaryLine3,
      hasInfills,
      presets: infillPresetCards,
      onAddCustom: addCustomInfillFromOverview,
      onAddPreset: addInfillPresetFromOverview,
      onSelectInfill: selectInfill,
      onFocusPrimaryField: focusInfillPrimaryField,
      onMoveInfill: moveInfill,
      onRowRef: setInfillRowRef,
    },
    openingStage: selectedInfill && selectedInfillEstimate && selectedInfillValidation ? {
      item: selectedInfill,
      domIdBase: selectedInfillDomIdBase,
      errors: selectedInfillValidation.errors,
      preview: selectedInfillPreview,
      getDraftValue: getSelectedDraftValue,
      onItemChange: changeSelectedItem,
      onLocationChange: changeSelectedLocation,
      onShapeTemplateChange: changeSelectedShapeTemplate,
      onDraftChange: changeSelectedDraft,
      onDraftCommit: commitSelectedDraft,
      onMonoModeChange: changeSelectedMonoMode,
      onMonoAnchorChange: changeSelectedMonoAnchor,
      onMonoSlopeChange: changeSelectedMonoSlope,
      onBottomOffsetChange: changeSelectedBottomOffset,
    } : null,
    supportsStage: selectedInfill && selectedInfillEstimate && selectedInfillValidation ? {
      item: selectedInfill,
      domIdBase: selectedInfillDomIdBase,
      canOfferRafterMatching: selectedCanOfferRafterMatching,
      internalPositionsError: selectedInfillValidation.errors.internalSupportPositionsM,
      acrylicSourceError: selectedInfillValidation.errors.acrylicSource,
      additionalSupportSummary: addedSupportSummary(selectedInfillEstimate.estimatedMullionsTotal),
      acrylicSource:
        selectedInfill.acrylicSource === 'auto'
          ? selectedInfillEstimate.acrylicSourceUsed
          : selectedInfill.acrylicSource,
      panelOrientation:
        selectedInfill.panelOrientation === 'auto'
          ? selectedInfillEstimate.panelOrientationUsed
          : selectedInfill.panelOrientation,
      preview: selectedInfillPreview,
      onAcrylicSourceChange: changeSelectedAcrylicSource,
      onPanelOrientationChange: changeSelectedPanelOrientation,
      onSupportChange: changeSelectedSupport,
      onInternalModeChange: changeSelectedInternalMode,
      onCustomPositionsChange: changeSelectedCustomPositions,
    } : null,
    resultsStage: selectedInfill && selectedInfillEstimate && selectedInfillValidation && selectedResultStatus ? {
      status: selectedResultStatus,
      blockers: selectedCriticalWarnings,
      materialLabel: acrylicSourceLabel(selectedInfillEstimate.acrylicSourceUsed),
      orientationLabel: selectedInfillEstimate.panelOrientationUsed === 'vertical' ? 'Vertical' : 'Horizontal',
      additionalSupportCount: selectedInfillEstimate.estimatedMullionsTotal,
      additionalSupportSummary: addedSupportSummary(selectedInfillEstimate.estimatedMullionsTotal),
      cutListStatus: selectedInfillIsDraft ? 'draft' : 'valid',
      cutListRows: selectedInfillEstimate.cutListRows ?? [],
      preview: selectedInfillPreview,
      technicalDetailsOpen: infillCostDetailsOpen,
      onTechnicalDetailsToggle: setInfillCostDetailsOpen,
      onFixBlocker: jumpToInfillWarningTarget,
    } : null,
    costComparison: canViewInternalCosts && selectedInfill ? {
      model: infillCostComparison,
      onApply: changeSelectedAcrylicSource,
    } : null,
    itemCount: infillsState.items.length,
    presets: infillPresetCards,
    onAddPreset: addInfillPreset,
    onAddPresetFromOverview: addInfillPresetFromOverview,
    duplicate: {
      open: infillDuplicateOpen && Boolean(selectedInfill),
      sourceLabel: selectedInfill?.label?.trim() || `Infill ${Math.max(1, selectedInfillIndex + 1)}`,
      onCancel: closeInfillDuplicate,
      onConfirm: confirmSelectedDuplicate,
    },
  };

  const workspaceViewProps: CalculatorWorkspaceViewProps = {
    embedded: Boolean(workspace),
    commandBar: {
      variant: workspace ? 'embedded' : 'standalone',
      designNavigation: workspace?.designNavigation,
      projectLabel: project ? project.projectName ?? project.name ?? 'Select project' : 'Select project',
      isEditingDesign,
      activeModuleLabel,
      uiMode,
      onUiModeChange: setUiMode,
      resultFreshness,
      localDraftStatus,
      blockerCount: quoteStatusUi.blockerCount,
      onSelectProject: workspace ? undefined : () => setProjectPickerOpen(true),
      saveLabel: generateField?.actionLabel ?? 'Save',
      saveDisabled: !generateField || Boolean(generateField.disabled),
      onSave: () => void generateField?.onAction?.(),
      saveError: generateField?.error,
    },
    previewSplit,
    moduleNavigator: {
      model: moduleNavigatorModel,
      pergolas,
      moduleCount: values.modules.length,
      onSelectModule: setActiveModuleIndex,
      onAddModule: handleAddModule,
      onAddPergola: handleAddPergola,
      onRenamePergola: handleRenamePergola,
      onDuplicateModule: handleDuplicateModule,
      onMoveModule: handleMoveModule,
      onRemoveModule: handleRemoveModule,
    },
    pricingSummary: pricingSummaryProps,
    jobTemplatePicker: { onApply: handleApplyJobTemplate },
    configurationForm: { fields: schema, isAdvancedUi },
    resultFreshness,
    pricingPreview,
    actualCostEstimateId: canViewInternalCosts && isEditingDesign ? activeEditEstimateId : null,
    moduleViews: {
      moduleLabel: activeModuleLabel,
      view: moduleViewsTab,
      onViewChange: setModuleViewsTab,
      status: moduleViewsStatus,
      statusDetail: moduleViewsStatusDetail,
      planModel: modulePlanModel,
      sectionModel: moduleSectionModel,
      footprintEditor: houseFootprintEditor,
    },
    priceImpact: canViewInternalCosts ? {
      diff: impactDiff,
      isAdvancedUi,
      onResetBaseline: resetImpactBaseline,
    } : null,
    quoteStatus: { items: statusItems },
    previewDetails: {
      warnings: uiWarnings,
      onJumpToWarning: (warning) => jumpToInfillWarningGlobal(warning.infillId, warning.warning),
      bomLines: bomPreview,
      canViewInternalCosts,
      materialsEx,
      isAdvancedUi,
      materialsDebug,
      labourActions: labourPreview,
      structureRows: structureOutputRows,
    },
    infillWorkspace: infillWorkspaceProps,
    saveDialogs: {
      issuesOpen,
      issues,
      onCloseIssues: closeIssues,
      onIssueClick: selectIssue,
      confirmOpen,
      onCloseConfirm: closeSaveConfirmation,
      saveConfirmation: {
        isEditingDesign,
        canViewInternalCosts,
        summary: saveDialogSummary,
        pricingComparison,
        warnings: { uiWarnings, criticalUiWarnings, reviewUiWarnings, infoUiWarnings },
        confirmAcknowledgeWarnings,
        pricingPreserveReason,
        confirmRequestDesign,
        confirmRequestDesignPriority,
        generateError,
        isGenerating,
        hasStatusBlockers,
        hasResult: resultFreshness === 'current',
        onConfirmAcknowledgeWarningsChange: setConfirmAcknowledgeWarnings,
        onPricingPreserveReasonChange: setPricingPreserveReason,
        onConfirmRequestDesignChange: setConfirmRequestDesignChecked,
        onConfirmRequestDesignPriorityChange: setConfirmRequestDesignPriority,
        onSave: () => void saveConfirmed(),
        onRepriceLatest: () => void repriceLatest(),
      },
    },
    saveOutcome: { outcome: saveOutcome, onDismiss: dismissSaveOutcome },
    projectPicker: workspace ? null : {
      open: projectPickerOpen,
      hostKey,
      selectedProjectId: projectId,
      onClose: () => setProjectPickerOpen(false),
      onSelect: handleProjectSelect,
    },
  };

  return <CalculatorWorkspaceView {...workspaceViewProps} />;
}
