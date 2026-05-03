'use client';

import type { CostOutputV1, SiteOutputV1 } from '@sp/costing';
import type { QueryClient } from '@tanstack/react-query';
import { getCostingMeta } from '@/lib/costing/costEngine';
import type { DesignRequestPriorityTier } from '@/lib/designPackages/types';
import {
  type EstimateSaveMode,
  buildEstimatePayloadFromSiteCosting,
  buildEstimatePayloadPreservingCurrentPricing,
  getSiteResultModule,
  hasPricingAffectingCalculatorInputChanges,
} from '@/lib/estimates/costingPayload';
import type { EstimateDetail, EstimateMeta } from '@/lib/estimates/types';
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
  buildEstimateEntityKey,
  buildEstimatePayloadFromDetail,
  buildNextEstimateVersionLabel,
  buildOptimisticEstimateDetail,
  createLocalEstimateId,
  type PortalEstimateCreateMutationPayload,
  type PortalEstimatePayload,
  type PortalEstimateUpdateMutationPayload,
  upsertEstimateDetailCache,
} from '@/lib/localFirst/portalEntities';
import { enqueueAndProcessLocalFirstMutation } from '@/lib/localFirst/queue';
import {
  clearLocalFirstWorkingCopy,
  resolveLocalFirstId,
  writeLocalFirstWorkingCopy,
} from '@/lib/localFirst/store';
import { qk } from '@/lib/queries/keys';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { apiJson } from '@/lib/repo/apiClient';
import { getContact } from '@/lib/repo/contactsRepo';
import type { CalculatorInputs } from '@/lib/types/calculator';
import type { Project } from '@/lib/types/project';
import { calculatorInputsFromEstimateDetail } from './calculatorInputs';
import {
  buildCalculatorEstimateCreateRedirect,
  buildCalculatorEstimateUpdateRedirect,
  getCalculatorProjectSnapshotError,
  getCalculatorSaveBlockerError,
  getCalculatorSaveInitialError,
  resolveCalculatorEstimateTarget,
  resolveCalculatorSaveMode,
} from './calculatorSaveWorkflow';

type WarningForPayload = { level: 'critical' | 'review' | 'info'; message: string };

type SaveCalculatorEstimateRequest = {
  createDesignRequest?: { priorityTier: DesignRequestPriorityTier } | null;
  saveMode?: EstimateSaveMode;
};

type SaveCalculatorEstimateCallbacks = {
  closeConfirm: () => void;
  fail: (message: string) => void;
  pushRoute: (href: string) => void;
  setGenerating: (isGenerating: boolean) => void;
  setLoadedEstimateDetail: (estimate: EstimateDetail) => void;
  success: (message: string) => void;
};

type SaveCalculatorEstimateServices = {
  clearWorkingCopy?: typeof clearLocalFirstWorkingCopy;
  createLocalEstimateId?: typeof createLocalEstimateId;
  enqueueMutation?: typeof enqueueAndProcessLocalFirstMutation;
  fetchEstimateDetail?: (estimateId: string) => Promise<EstimateDetail | null>;
  getContact?: typeof getContact;
  getCostingMeta?: typeof getCostingMeta;
  resolveEstimateId?: typeof resolveLocalFirstId;
  upsertEstimateDetailCache?: typeof upsertEstimateDetailCache;
  writeWorkingCopy?: typeof writeLocalFirstWorkingCopy;
};

type SaveCalculatorEstimateInput = {
  activeDraftEstimateMetaId?: string | null;
  activeEditEstimateId: string;
  activeModuleIndex: number;
  callbacks: SaveCalculatorEstimateCallbacks;
  criticalWarningCount: number;
  draftEntityKey: string;
  draftSessionKey: string;
  email: string | null | undefined;
  engineWarningsRaw: WarningForPayload[];
  hasStatusBlockers: boolean;
  hostKey: string;
  isEditingDesign: boolean;
  loadedEstimateDetail: EstimateDetail | null;
  project: Project | null;
  projectId: string;
  queryClient: QueryClient;
  request?: SaveCalculatorEstimateRequest;
  result: SiteOutputV1 | null;
  resultModules: CostOutputV1[];
  services?: SaveCalculatorEstimateServices;
  values: CalculatorInputs;
};

async function defaultFetchEstimateDetail(estimateId: string): Promise<EstimateDetail | null> {
  return (
    (
      await apiJson<{ estimate: EstimateDetail }>(`/api/estimates/${encodeURIComponent(estimateId)}`, {
        skipSaveTracking: true,
      }).catch(() => ({ estimate: null as EstimateDetail | null }))
    ).estimate ?? null
  );
}

async function clearCalculatorDraft(input: {
  draftEntityKey: string;
  draftSessionKey: string;
  clearWorkingCopy: typeof clearLocalFirstWorkingCopy;
}) {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(input.draftSessionKey);
    } catch {
      void 0;
    }
  }
  await input.clearWorkingCopy(input.draftEntityKey);
}

function estimateVersionLabel(input: {
  canonicalEditEstimateId: string;
  currentEstimate: EstimateDetail | null;
  estimateIdToUpdate: string;
  estimateMetas: EstimateMeta[];
}) {
  return (
    input.currentEstimate?.versionLabel ??
    input.estimateMetas.find(
      (estimate) => estimate.id === input.canonicalEditEstimateId || estimate.id === input.estimateIdToUpdate,
    )?.versionLabel ??
    'Draft'
  );
}

async function writeOptimisticEstimate(input: {
  createdAt?: string;
  createdBy?: string | null;
  currentEstimate: EstimateDetail | null;
  estimateId: string;
  estimatePayload: PortalEstimatePayload;
  hostKey: string;
  prepend?: boolean;
  projectId: string;
  queryClient: QueryClient;
  setLoadedEstimateDetail?: (estimate: EstimateDetail) => void;
  upsertCache: typeof upsertEstimateDetailCache;
  versionLabel: string;
  writeWorkingCopy: typeof writeLocalFirstWorkingCopy;
}) {
  const optimisticEstimateBase = buildOptimisticEstimateDetail({
    estimateId: input.estimateId,
    projectId: input.projectId,
    estimatePayload: input.estimatePayload,
    versionLabel: input.versionLabel,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  });
  const optimisticEstimate: EstimateDetail = {
    ...optimisticEstimateBase,
    internalNotes: input.currentEstimate?.internalNotes ?? optimisticEstimateBase.internalNotes,
    editability: input.currentEstimate?.editability ?? optimisticEstimateBase.editability,
  };

  input.setLoadedEstimateDetail?.(optimisticEstimate);
  input.upsertCache(input.queryClient, input.hostKey, input.projectId, optimisticEstimate, input.prepend ? { prepend: true } : undefined);
  await input.writeWorkingCopy({
    entityKey: buildEstimateEntityKey(input.estimateId),
    data: optimisticEstimate,
  });

  return optimisticEstimate;
}

export async function saveCalculatorEstimate(input: SaveCalculatorEstimateInput): Promise<void> {
  const services = input.services ?? {};
  const clearWorkingCopy = services.clearWorkingCopy ?? clearLocalFirstWorkingCopy;
  const createEstimateId = services.createLocalEstimateId ?? createLocalEstimateId;
  const enqueueMutation = services.enqueueMutation ?? enqueueAndProcessLocalFirstMutation;
  const fetchEstimateDetail = services.fetchEstimateDetail ?? defaultFetchEstimateDetail;
  const getContactForSave = services.getContact ?? getContact;
  const getCostingMetaForSave = services.getCostingMeta ?? getCostingMeta;
  const resolveEstimateId = services.resolveEstimateId ?? resolveLocalFirstId;
  const upsertCache = services.upsertEstimateDetailCache ?? upsertEstimateDetailCache;
  const writeWorkingCopy = services.writeWorkingCopy ?? writeLocalFirstWorkingCopy;

  const { callbacks } = input;
  const effectiveSaveMode = resolveCalculatorSaveMode({
    requestedSaveMode: input.request?.saveMode,
    isEditingDesign: input.isEditingDesign,
  });

  const projectForSave = input.project;
  const initialError = getCalculatorSaveInitialError({
    projectId: input.projectId,
    hasProject: Boolean(projectForSave),
    saveMode: effectiveSaveMode,
    hasCalculatedResult: Boolean(input.result),
  });
  if (initialError) {
    callbacks.fail(initialError);
    return;
  }
  if (!projectForSave) return;

  callbacks.setGenerating(true);
  try {
    const blockerError = getCalculatorSaveBlockerError({
      saveMode: effectiveSaveMode,
      hasStatusBlockers: input.hasStatusBlockers,
      criticalWarningCount: input.criticalWarningCount,
    });
    if (blockerError) {
      callbacks.fail(blockerError);
      return;
    }

    const cachedEstimateMetas =
      input.queryClient.getQueryData<EstimateMeta[]>(qk.estimates.metaByProject(input.hostKey, input.projectId)) ??
      (await input.queryClient.fetchQuery(estimateMetasByProjectQueryOptions(input.hostKey, input.projectId)));
    const estimateTarget = resolveCalculatorEstimateTarget({
      activeEditEstimateId: input.activeEditEstimateId,
      activeDraftEstimateMetaId: input.activeDraftEstimateMetaId,
      estimateMetas: cachedEstimateMetas,
      resolveEstimateId,
    });
    const { estimateIdToUpdate } = estimateTarget;
    const canonicalEditEstimateId = estimateTarget.canonicalEditEstimateId ?? '';
    const currentEstimate =
      canonicalEditEstimateId
        ? input.loadedEstimateDetail ??
          input.queryClient.getQueryData<EstimateDetail>(qk.estimates.detail(input.hostKey, canonicalEditEstimateId)) ??
          input.queryClient.getQueryData<EstimateDetail>(qk.estimates.detail(input.hostKey, estimateIdToUpdate)) ??
          (await fetchEstimateDetail(canonicalEditEstimateId))
        : null;

    if (estimateIdToUpdate) {
      if (!currentEstimate) {
        callbacks.fail('This edit session lost its source design. Please reopen the design and try again.');
        return;
      }

      if (currentEstimate.editability.isLocked) {
        callbacks.fail('This design is locked because it has been sent with a quote and can no longer be edited.');
        return;
      }
    }

    if (estimateIdToUpdate && effectiveSaveMode === 'preserve_current') {
      const currentInputs = calculatorInputsFromEstimateDetail(currentEstimate!);
      const pricingChanged = hasPricingAffectingCalculatorInputChanges(currentInputs, input.values);
      const estimatePayload = buildEstimatePayloadPreservingCurrentPricing({
        basePayload: buildEstimatePayloadFromDetail(currentEstimate!),
        inputs: input.values,
        pricingChanged,
      });

      await writeOptimisticEstimate({
        currentEstimate,
        estimateId: canonicalEditEstimateId,
        estimatePayload,
        hostKey: input.hostKey,
        projectId: input.projectId,
        queryClient: input.queryClient,
        setLoadedEstimateDetail: callbacks.setLoadedEstimateDetail,
        upsertCache,
        versionLabel: estimateVersionLabel({
          canonicalEditEstimateId,
          currentEstimate,
          estimateIdToUpdate,
          estimateMetas: cachedEstimateMetas,
        }),
        createdBy: (currentEstimate!.createdBy ?? input.email) || null,
        createdAt: currentEstimate!.createdAt,
        writeWorkingCopy,
      });

      const mutationPayload: PortalEstimateUpdateMutationPayload = {
        estimateId: canonicalEditEstimateId,
        estimatePayload,
      };
      await enqueueMutation({
        entityKey: buildEstimateEntityKey(canonicalEditEstimateId),
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateUpdate,
        payload: mutationPayload,
      });

      callbacks.closeConfirm();
      await clearCalculatorDraft({
        draftEntityKey: input.draftEntityKey,
        draftSessionKey: input.draftSessionKey,
        clearWorkingCopy,
      });
      callbacks.success(
        pricingChanged
          ? 'Design saved locally. Pricing was preserved. Use Reprice to latest to refresh costs.'
          : 'Design saved locally. Syncing in the background.',
      );
      callbacks.pushRoute(buildCalculatorEstimateUpdateRedirect(input.projectId, canonicalEditEstimateId));
      return;
    }

    if (!input.result) {
      callbacks.fail('No calculated result yet.');
      return;
    }

    const activeResultModule = getSiteResultModule(input.result, input.activeModuleIndex) ?? input.resultModules[0] ?? null;
    if (!activeResultModule?.derived) {
      callbacks.fail('No derived result available for the active module.');
      return;
    }

    const [meta, contact] = await Promise.all([
      getCostingMetaForSave(),
      projectForSave.contactId ? getContactForSave(projectForSave.contactId) : Promise.resolve(null),
    ]);

    const projectNameSnapshot = projectForSave.projectName ?? projectForSave.name ?? input.values.projectName;
    const snapshotError = getCalculatorProjectSnapshotError({
      hasContact: Boolean(contact),
      projectNameSnapshot,
    });
    if (snapshotError) {
      callbacks.fail(snapshotError);
      return;
    }
    const contactSnapshot = contact!;

    const estimatePayload: PortalEstimatePayload = buildEstimatePayloadFromSiteCosting({
      basePayload: {
        status: 'draft',
        inputs: input.values as unknown as Record<string, unknown>,
        derived: activeResultModule.derived as unknown as Record<string, unknown>,
        projectSnapshot: {
          ...projectForSave,
          updatedAt: projectForSave.updatedAt ?? projectForSave.createdAt,
        } as unknown as Record<string, unknown>,
        snapshot: {
          contact: {
            displayName: contactSnapshot.displayName,
            email: contactSnapshot.email,
            phone: contactSnapshot.phone,
          },
          project: {
            projectName: projectNameSnapshot,
            region: projectForSave.region,
            siteAddress: projectForSave.siteAddress ?? projectForSave.address,
            quoteRef: projectForSave.quoteRef,
          },
        } as Record<string, unknown>,
        outputs: {},
        configVersions: meta.configVersions as unknown as Record<string, unknown>,
      },
      inputs: input.values,
      siteResult: input.result,
      configVersions: meta.configVersions as unknown as Record<string, unknown>,
      moduleIndex: input.activeModuleIndex,
      warnings: input.engineWarningsRaw,
    });

    const localEstimateId = createEstimateId();
    if (estimateIdToUpdate) {
      await writeOptimisticEstimate({
        currentEstimate,
        estimateId: canonicalEditEstimateId,
        estimatePayload,
        hostKey: input.hostKey,
        projectId: input.projectId,
        queryClient: input.queryClient,
        setLoadedEstimateDetail: callbacks.setLoadedEstimateDetail,
        upsertCache,
        versionLabel: estimateVersionLabel({
          canonicalEditEstimateId,
          currentEstimate,
          estimateIdToUpdate,
          estimateMetas: cachedEstimateMetas,
        }),
        createdBy: (currentEstimate?.createdBy ?? input.email) || null,
        createdAt: currentEstimate?.createdAt,
        writeWorkingCopy,
      });

      const mutationPayload: PortalEstimateUpdateMutationPayload = {
        estimateId: canonicalEditEstimateId,
        estimatePayload,
      };
      await enqueueMutation({
        entityKey: buildEstimateEntityKey(canonicalEditEstimateId),
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateUpdate,
        payload: mutationPayload,
      });

      callbacks.closeConfirm();
      await clearCalculatorDraft({
        draftEntityKey: input.draftEntityKey,
        draftSessionKey: input.draftSessionKey,
        clearWorkingCopy,
      });
      callbacks.success('Design repriced locally. Syncing in the background.');
      callbacks.pushRoute(buildCalculatorEstimateUpdateRedirect(input.projectId, canonicalEditEstimateId));
      return;
    }

    await writeOptimisticEstimate({
      currentEstimate: null,
      estimateId: localEstimateId,
      estimatePayload,
      hostKey: input.hostKey,
      prepend: true,
      projectId: input.projectId,
      queryClient: input.queryClient,
      upsertCache,
      versionLabel: buildNextEstimateVersionLabel(cachedEstimateMetas),
      createdBy: input.email || null,
      writeWorkingCopy,
    });

    const mutationPayload: PortalEstimateCreateMutationPayload = {
      localEstimateId,
      projectId: input.projectId,
      estimatePayload,
      createDesignRequest: input.request?.createDesignRequest
        ? {
            requestSource: 'calculator_generate',
            priorityTier: input.request.createDesignRequest.priorityTier,
          }
        : null,
    };
    await enqueueMutation({
      entityKey: buildEstimateEntityKey(localEstimateId),
      mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.estimateCreate,
      payload: mutationPayload,
    });

    callbacks.closeConfirm();
    await clearCalculatorDraft({
      draftEntityKey: input.draftEntityKey,
      draftSessionKey: input.draftSessionKey,
      clearWorkingCopy,
    });
    callbacks.success(
      input.request?.createDesignRequest
        ? 'Design saved locally. Syncing design and drafting request in the background.'
        : 'Design saved locally. Syncing in the background.',
    );
    callbacks.pushRoute(buildCalculatorEstimateCreateRedirect(input.projectId));
  } catch (err) {
    callbacks.fail(err instanceof Error ? err.message : 'Failed to save design');
  } finally {
    callbacks.setGenerating(false);
  }
}
