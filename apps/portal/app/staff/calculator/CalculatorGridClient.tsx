'use client';

import { evaluateSimpleRangeEligibilityV2, type CostInputsV1, type RoofType, type SiteInputsV1 } from '@sp/costing';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import styles from './CalculatorGrid.module.css';
import { supportsHouseFootprints } from '@/lib/types/calculator';
import type { Project } from '@/lib/types/project';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import InfillPreview from './InfillPreview';
import {
  addedSupportSummary,
  canOfferRafterMatching,
  infillResultStatus,
  isInfillOpeningComplete,
} from './infillConfiguratorPresentation';
import type { StatusItem } from './QuoteStatusCard';
import type { ModuleViewsTab } from './ModuleViewsCard';
import {
  resolveInfillUiState,
  type InfillUiState,
} from './infillCompute';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { buildSiteInputsFromCalculatorInputs } from '@/lib/estimates/costingPayload';
import {
  getPitchForModule,
  makeDefaultModule,
  normalizeInfillsStateForUi,
  toNumber,
} from './calculatorInputs';
import { buildCalculatorModuleErrors } from './calculatorValidation';
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
import CalculatorBlindsEditor from './CalculatorBlindsEditor';
import CalculatorFlashingsEditor from './CalculatorFlashingsEditor';
import {
  buildCalculatorQuoteStatusUi,
  buildCalculatorUiWarnings,
  groupCalculatorUiWarnings,
  type CalculatorQuoteStatusActionKey,
} from './calculatorQuoteStatusUi';
import { CalculatorInfillTile } from './CalculatorInfillOverview';
import { buildCalculatorIssues } from './calculatorIssueNavigation';
import type { CalculatorUiMode } from './CalculatorCommandBar';
import type { CalculatorConfigurationField as FieldSchemaItem } from './calculatorConfigurationSections';
import { buildCalculatorSiteFields } from './calculatorSiteFields';
import { buildCalculatorStructureFields } from './calculatorStructureFields';
import {
  buildCalculatorContextFields,
  buildCalculatorWorkflowFields,
} from './calculatorWorkflowFields';
import { useCalculatorPreviewSplit } from './useCalculatorPreviewSplit';
import {
  deriveCalculatorResultFreshness,
} from './calculatorResultFreshness';
import {
  calculatorCostingRequestReady,
  useCalculatorCostingRequest,
} from './useCalculatorCostingRequest';
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
import { useCalculatorBlindsController } from './useCalculatorBlindsController';
import { useCalculatorFlashingsController } from './useCalculatorFlashingsController';
import { useCalculatorInputController } from './useCalculatorInputController';
import { useSimplePricingClassification } from './useSimplePricingClassification';
import { useCalculatorResultPresentation } from './useCalculatorResultPresentation';
import { useCalculatorWorkspaceSession } from './useCalculatorWorkspaceSession';
import CalculatorWorkspaceView, { type CalculatorWorkspaceViewProps } from './CalculatorWorkspaceView';
import type { CalculatorInfillWorkspaceProps } from './CalculatorInfillWorkspace';
import {
  resolveCalculatorWorkspaceRoute,
  type CalculatorProjectWorkspace,
} from './calculatorWorkspace';

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

  const { navigateRoute } = usePortalRouteTransition();
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
    projectId,
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
  const {
    activeEditEstimateId,
    setEditSessionEstimateId,
    isEditingDesign,
    draftSessionKey,
    draftEntityKey,
    loadedEstimateDetail,
    setLoadedEstimateDetail,
    values,
    setValues,
    activeModuleIndex,
    setActiveModuleIndex,
    localDraftStatus,
    project,
    setProject,
    projectError,
    draftNotice,
  } = useCalculatorWorkspaceSession({
    workspace,
    route: workspaceRoute,
    activeDraftEstimateMetaId: activeDraftEstimateMeta?.id ?? null,
    hostKey,
    searchParams,
    router,
    queryClient,
    toast,
  });
  const [uiMode, setUiMode] = useState<CalculatorUiMode>('basic');
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [moduleViewsTab, setModuleViewsTab] = useState<ModuleViewsTab>('plan');
  const previewSplit = useCalculatorPreviewSplit();

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

  const errorsByModule = useMemo(() => buildCalculatorModuleErrors(values.modules), [values.modules]);
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

  const {
    state: flashingsState,
    primaryRow: primaryFlashingRow,
    addRow: addExtraFlashingRow,
    updateRow: updateFlashingRow,
    removeRow: removeFlashingRow,
    syncPrimaryLength: syncPrimaryFlashingLength,
  } = useCalculatorFlashingsController({
    activeModule,
    activeModuleIndex,
    activePergolaId,
    setValues,
  });

  const {
    setJobField,
    setModuleField,
    setModuleOverride,
  } = useCalculatorInputController({
    activeModule,
    activeModuleIndex,
    activePergolaId,
    setValues,
    syncPrimaryFlashingLength,
  });

  const {
    state: blindsState,
    setItem: setBlindItem,
    updateDimensionInput: updateBlindDimensionInput,
    commitDimensionInput: commitBlindDimensionInput,
    displayDimensionInput: displayBlindDimensionInput,
    add: addBlind,
    duplicate: duplicateBlind,
    remove: removeBlind,
  } = useCalculatorBlindsController({ values, setValues });
  const infillsState = normalizeInfillsStateForUi(activeModule.infills);

  const readyToCalculate = calculatorCostingRequestReady({
    hasValidModules: values.modules.length > 0 && !hasModuleErrors,
    awaitsSavedEstimate: Boolean(activeEditEstimateId),
    savedEstimateHydrated: Boolean(loadedEstimateDetail),
  });

  const requestPayload = useMemo<SiteInputsV1>(() => buildSiteInputsFromCalculatorInputs(values), [values]);

  const simpleEligibility = useMemo(
    () => evaluateSimpleRangeEligibilityV2(requestPayload),
    [requestPayload],
  );
  useSimplePricingClassification({ values, setValues, simpleEligible: simpleEligibility.eligible });

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
  } = useCalculatorIssueNavigation({
    activeModuleIndex,
    setActiveModuleIndex,
    onRevealAdvancedSection: () => setUiMode('advanced'),
  });

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

  const activeModuleLabel = moduleNavigatorModel.activeModuleLabel;
  const {
    resultModules, moduleResult, modulePlanModel, moduleSectionModel, rafterCutLengthExplanation, canEditActiveHouseFootprint,
    moduleViewsStatus, moduleViewsStatusDetail, impactDiff, resetImpactBaseline,
    derivedArea, derivedRoofArea, derivedPitchUsed, derivedAcrylicArea, derivedTimberArea,
    derivedAcrylicBaysTotal, derivedSlopeLength, derivedBoxPitch, derivedBoxRiseMm, derivedBoxMaxFallMm,
    hasOurGutterUi, resolvedDefaults,
    bracketCount, rafterProfile, crewHours, materialsEx, installEx, overheadEx, totalEx, totalInc,
    blindsUi, pricingPreview, pricingComparison, engineWarningsRaw, roofingProcurementSummary,
    rafterCountTotal, rafterHelperText, materialsBreakdown, labourBreakdown, saveDialogSummary,
    pricingSummaryProps, structureOutputRows,
  } = useCalculatorResultPresentation({
    result,
    values,
    activeModule,
    activeModuleIndex,
    activeModuleLabel,
    moduleRoutes,
    moduleViewsTab,
    engineError,
    isCalculating,
    blindItems: blindsState.items,
    loadedEstimateDetail,
    isEditingDesign,
    resultFreshness,
    canViewInternalCosts,
    issuesCount,
    openIssues,
    setModuleField,
  });
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
        inputIssueCount: issuesCount,
        invalidBlindCount: blindsUi.rows.filter((row) => row.hasErrors).length,
        engineError,
        resultFreshness,
        infillItems: infillsState.items,
        infillUiById,
      }),
    [blindsUi.rows, engineError, infillUiById, infillsState.items, issuesCount, project, projectHasContact, projectId, resultFreshness],
  );
  const statusActionHandlers: Record<CalculatorQuoteStatusActionKey, () => void> = {
    selectProject: () => setProjectPickerOpen(true),
    openProject: () => {
      if (workspace) workspace.onOpenProject();
      else if (projectId) {
        navigateRoute({
          href: `/staff/projects/${encodeURIComponent(projectId)}`,
          label: 'Project',
          source: 'calculator-status',
        });
      }
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
    blockedBy: item.blockedBy,
    causeCount: item.causeCount,
  }));
  const hasStatusBlockers = quoteStatusUi.hasStatusBlockers;

  const handleProjectSelect = (selectedProject: Project) => {
    setProjectPickerOpen(false);
    navigateRoute({
      href: `/staff/calculator?projectId=${encodeURIComponent(selectedProject.id)}&openActiveDraft=1`,
      label: 'Calculator',
      source: 'calculator-project-picker',
    });
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
      resolvedDefaults,
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
      resolvedDefaults,
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
      readinessSummary: quoteStatusUi.readinessSummary,
      localDraftStatus,
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
    quoteStatus: {
      items: statusItems,
      readinessSummary: quoteStatusUi.readinessSummary,
    },
    previewDetails: {
      warnings: uiWarnings,
      onJumpToWarning: (warning) => jumpToInfillWarningGlobal(warning.infillId, warning.warning),
      materialsBreakdown,
      canViewInternalCosts,
      materialsEx,
      isAdvancedUi,
      materialsDebug,
      labourBreakdown,
      resultFreshness,
      structureRows: structureOutputRows,
    },
    rafterExplanation: {
      moduleLabel: activeModuleLabel,
      explanation: rafterCutLengthExplanation,
      resultFreshness,
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
    saveOutcome: {
      outcome: saveOutcome,
      liveCalculatorTotalIncGstCents: pricingPreview.totalIncGstCents,
      onDismiss: dismissSaveOutcome,
    },
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
