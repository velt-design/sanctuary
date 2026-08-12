'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { EstimateDetail } from '@/lib/estimates/types';
import {
  buildCalculatorDraftEntityKey,
  buildEstimateEntityKey,
  isLocalEstimateId,
} from '@/lib/localFirst/portalEntities';
import {
  getLocalFirstWorkingCopy,
  resolveLocalFirstId,
} from '@/lib/localFirst/store';
import { qk } from '@/lib/queries/keys';
import { apiJson } from '@/lib/repo/apiClient';
import { duplicateEstimateToDraft } from '@/lib/repo/estimatesRepo';
import { getProject } from '@/lib/repo/projectsRepo';
import type { CalculatorInputs } from '@/lib/types/calculator';
import type { Project } from '@/lib/types/project';
import type { CalculatorDraftPersistence } from './calculatorDraftPersistence';
import {
  calculatorDraftSessionKey,
  calculatorInputsFromEstimateDetail,
  normalizeBlindsStateForUi,
  normalizeCalculatorInputsForUi,
} from './calculatorInputs';
import type { CalculatorProjectWorkspace } from './calculatorWorkspace';
import { useCalculatorDraftSession } from './useCalculatorDraftSession';

type CalculatorWorkspaceRouter = {
  replace: (href: string) => void;
};

type CalculatorWorkspaceToast = {
  success: (message: string) => void;
  error: (message: string) => void;
};

type UseCalculatorWorkspaceSessionOptions = {
  workspace?: CalculatorProjectWorkspace;
  route: {
    projectId: string;
    editEstimateId: string;
    fromEstimateId: string;
    shouldOpenActiveDraft: boolean;
    newEstimateCommercialScopeId?: string | null;
    newEstimateCommercialScopeKind?: 'base' | 'add_on';
  };
  activeDraftEstimateMetaId: string | null;
  hostKey: string;
  searchParams: Pick<URLSearchParams, 'toString'>;
  router: CalculatorWorkspaceRouter;
  queryClient: QueryClient;
  toast: CalculatorWorkspaceToast;
  projectLoader?: (projectId: string) => Promise<Project | null>;
  estimateLoader?: (estimateId: string) => Promise<EstimateDetail>;
  estimateDuplicator?: (estimateId: string) => Promise<CalculatorInputs>;
  draftPersistence?: CalculatorDraftPersistence;
};

async function loadEstimateDetail(estimateId: string): Promise<EstimateDetail> {
  return (
    await apiJson<{ estimate: EstimateDetail }>(
      `/api/estimates/${encodeURIComponent(estimateId)}`,
      { skipSaveTracking: true },
    )
  ).estimate;
}

export function useCalculatorWorkspaceSession({
  workspace,
  route,
  activeDraftEstimateMetaId,
  hostKey,
  searchParams,
  router,
  queryClient,
  toast,
  projectLoader = getProject,
  estimateLoader = loadEstimateDetail,
  estimateDuplicator = duplicateEstimateToDraft,
  draftPersistence,
}: UseCalculatorWorkspaceSessionOptions) {
  const {
    projectId,
    editEstimateId,
    fromEstimateId,
    shouldOpenActiveDraft,
  } = route;
  const [editSessionEstimateId, setEditSessionEstimateId] = useState(() => editEstimateId.trim());
  const activeEditEstimateId = editSessionEstimateId || editEstimateId.trim();
  const isEditingDesign = activeEditEstimateId.length > 0;
  const draftSessionKey = useMemo(
    () => calculatorDraftSessionKey(
      projectId,
      fromEstimateId,
      activeEditEstimateId,
      route.newEstimateCommercialScopeId ?? '',
      route.newEstimateCommercialScopeKind ?? 'base',
    ),
    [activeEditEstimateId, fromEstimateId, projectId, route.newEstimateCommercialScopeId, route.newEstimateCommercialScopeKind],
  );
  const draftEntityKey = useMemo(
    () => buildCalculatorDraftEntityKey(draftSessionKey),
    [draftSessionKey],
  );
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
    allowEmptyDesign: route.newEstimateCommercialScopeKind === 'add_on',
    ...(draftPersistence ? { persistence: draftPersistence } : null),
  });
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoadedEstimateDetail(null);
  }, [draftEntityKey]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setProjectError(null);
      return;
    }

    void (async () => {
      const nextProject = await projectLoader(projectId);
      setProject(nextProject);
      if (!nextProject) {
        setProjectError('Project not found (use Projects in the header to create/select one).');
        return;
      }
      setProjectError(null);
      setValues((previous) => ({
        ...previous,
        projectName: nextProject.projectName ?? nextProject.name ?? previous.projectName,
        quoteRef: nextProject.quoteRef ?? previous.quoteRef,
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
    if (!activeDraftEstimateMetaId) return;
    const query = new URLSearchParams(searchParams.toString());
    query.set('projectId', projectId);
    query.set('editEstimateId', activeDraftEstimateMetaId);
    query.delete('fromEstimateId');
    query.delete('openActiveDraft');
    router.replace(`/staff/calculator?${query.toString()}`);
  }, [
    activeDraftEstimateMetaId,
    activeEditEstimateId,
    draftHydrated,
    fromEstimateId,
    projectId,
    restoredFromLocalDraft,
    router,
    searchParams,
    shouldOpenActiveDraft,
    workspace,
  ]);

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

          const estimate = cachedEstimate
            ?? await estimateLoader(resolvedEditEstimateId || activeEditEstimateId);
          if (!estimate) throw new Error('Design not found');
          setLoadedEstimateDetail(estimate);
          if (estimate.editability.isLocked) {
            const message = `Design ${estimate.versionLabel} is locked and can no longer be edited.`;
            setDraftNotice(message);
            toast.error(message);
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

          acceptExternalDraft(calculatorInputsFromEstimateDetail(estimate));
          const message =
            isLocalEstimateId(estimate.id)
              || (resolvedEditEstimateId ?? activeEditEstimateId).startsWith('local-estimate:')
              ? `Editing design ${estimate.versionLabel}. Changes will keep syncing in the background.`
              : `Editing design ${estimate.versionLabel}`;
          setDraftNotice(message);
          toast.success(message);
          return;
        }

        if (restoredFromLocalDraft) return;

        const draft = await estimateDuplicator(fromEstimateId);
        const normalizedDraft = normalizeCalculatorInputsForUi({
          ...draft,
          schemaVersion: 'v2',
          modules: Array.isArray(draft.modules) ? draft.modules : [],
          blinds: normalizeBlindsStateForUi((draft as any).blinds),
        } as CalculatorInputs, { allowEmpty: route.newEstimateCommercialScopeKind === 'add_on' });

        acceptExternalDraft(normalizedDraft);
        const message = `Draft design started from ${fromEstimateId}`;
        setDraftNotice(message);
        toast.success(message);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start design revision';
        setDraftNotice(message);
        toast.error(message);
      }
    })();
  }, [
    acceptExternalDraft,
    activeEditEstimateId,
    draftHydrated,
    estimateDuplicator,
    estimateLoader,
    fromEstimateId,
    hostKey,
    projectId,
    queryClient,
    restoredFromLocalDraft,
    router,
    route.newEstimateCommercialScopeKind,
    toast,
    workspace,
  ]);

  return {
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
  };
}
