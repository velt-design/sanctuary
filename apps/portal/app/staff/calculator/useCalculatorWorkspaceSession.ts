'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { duplicateEstimateToDraft } from '@/lib/repo/duplicateEstimateCommand';
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
  const isProjectWorkspace = Boolean(workspace);
  const routeEditEstimateId = editEstimateId.trim();
  const [editSession, setEditSession] = useState(() => ({
    routeEstimateId: routeEditEstimateId,
    estimateId: routeEditEstimateId,
  }));
  const activeEditEstimateId = isProjectWorkspace || editSession.routeEstimateId !== routeEditEstimateId
    ? routeEditEstimateId
    : editSession.estimateId;
  const setEditSessionEstimateId = useCallback((estimateId: string) => {
    setEditSession({ routeEstimateId: routeEditEstimateId, estimateId });
  }, [routeEditEstimateId]);
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
    allowEmptyDesign: true,
    startEmptyDesign: route.newEstimateCommercialScopeKind === 'add_on',
    ...(draftPersistence ? { persistence: draftPersistence } : null),
  });
  const previousSessionRef = useRef({ projectId, estimateId: activeEditEstimateId, values, activeModuleIndex });
  const promotedDraftRef = useRef<{ key: string; values: CalculatorInputs; activeModuleIndex: number } | null>(null);
  useEffect(() => {
    const previous = previousSessionRef.current;
    if (previous.projectId === projectId && previous.estimateId !== activeEditEstimateId
      && isLocalEstimateId(previous.estimateId)
      && resolveLocalFirstId(previous.estimateId) === activeEditEstimateId) {
      // Server acknowledgement changes identity, not the user's current editing session.
      promotedDraftRef.current = { key: draftEntityKey, values: previous.values, activeModuleIndex: previous.activeModuleIndex };
    }
    previousSessionRef.current = { projectId, estimateId: activeEditEstimateId, values, activeModuleIndex };
  }, [activeEditEstimateId, activeModuleIndex, draftEntityKey, projectId, values]);

  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [externalLoad, setExternalLoad] = useState<{ key: string; error: string | null; ready: boolean } | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loadedSessionRef = useRef<{ key: string; attempt: number } | null>(null);
  const retryDraftLoad = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);
  const requiresExternalDraft = Boolean(activeEditEstimateId || fromEstimateId);
  const draftLoadError = externalLoad?.key === draftEntityKey ? externalLoad.error : null;
  const draftReady = draftHydrated && (!requiresExternalDraft || (
    externalLoad?.key === draftEntityKey && externalLoad.ready
  ));
  const matchesLoadedEstimate = useMemo(() => {
    if (!loadedEstimateDetail || !draftReady) return false;
    try {
      return JSON.stringify(calculatorInputsFromEstimateDetail(loadedEstimateDetail)) === JSON.stringify(values);
    } catch {
      return false;
    }
  }, [draftReady, loadedEstimateDetail, values]);

  useEffect(() => {
    setLoadedEstimateDetail(null);
    loadedSessionRef.current = null;
  }, [draftEntityKey]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setProjectError(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const nextProject = await projectLoader(projectId);
        if (cancelled) return;
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
      } catch (error) {
        if (cancelled) return;
        setProject(null);
        setProjectError(error instanceof Error ? error.message : 'Project could not be loaded.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, projectLoader, setValues]);

  useEffect(() => {
    if (isProjectWorkspace) return;
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
    isProjectWorkspace,
  ]);

  useEffect(() => {
    if (!draftHydrated) return;

    if (!activeEditEstimateId && !fromEstimateId) {
      setDraftNotice(null);
      return;
    }

    if (loadedSessionRef.current?.key === draftEntityKey && loadedSessionRef.current.attempt === loadAttempt) return;
    let cancelled = false;
    const markReady = () => {
      loadedSessionRef.current = { key: draftEntityKey, attempt: loadAttempt };
      setExternalLoad({ key: draftEntityKey, error: null, ready: true });
    };
    setExternalLoad({ key: draftEntityKey, error: null, ready: false });
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
          if (cancelled) return;
          if (!estimate) throw new Error('Design not found');
          setLoadedEstimateDetail(estimate);
          if (estimate.editability.isLocked) {
            const message = `Design ${estimate.versionLabel} is locked and can no longer be edited.`;
            setExternalLoad({ key: draftEntityKey, error: message, ready: false });
            setDraftNotice(message);
            toast.error(message);
            if (projectId && !isProjectWorkspace) {
              router.replace(
                `/staff/projects/${encodeURIComponent(projectId)}?tab=estimates&estimateId=${encodeURIComponent(
                  resolvedEditEstimateId || activeEditEstimateId,
                )}`,
              );
            }
            return;
          }

          const promotedDraft = promotedDraftRef.current;
          if (promotedDraft?.key === draftEntityKey) {
            acceptExternalDraft(promotedDraft.values, promotedDraft.activeModuleIndex);
            promotedDraftRef.current = null;
            setDraftNotice(`Editing design ${estimate.versionLabel}`);
            markReady();
            return;
          }

          if (restoredFromLocalDraft) {
            setDraftNotice(`Restored unsaved edits for ${estimate.versionLabel}`);
            markReady();
            return;
          }

          acceptExternalDraft(calculatorInputsFromEstimateDetail(estimate));
          markReady();
          const message =
            isLocalEstimateId(estimate.id)
              || (resolvedEditEstimateId ?? activeEditEstimateId).startsWith('local-estimate:')
              ? `Editing design ${estimate.versionLabel}. Changes will keep syncing in the background.`
              : `Editing design ${estimate.versionLabel}`;
          setDraftNotice(message);
          toast.success(message);
          return;
        }

        if (restoredFromLocalDraft) {
          markReady();
          return;
        }

        const draft = await estimateDuplicator(fromEstimateId);
        if (cancelled) return;
        const normalizedDraft = normalizeCalculatorInputsForUi({
          ...draft,
          schemaVersion: 'v2',
          modules: Array.isArray(draft.modules) ? draft.modules : [],
          blinds: normalizeBlindsStateForUi((draft as any).blinds),
        } as CalculatorInputs, { allowEmpty: route.newEstimateCommercialScopeKind === 'add_on' });

        acceptExternalDraft(normalizedDraft);
        markReady();
        const message = `Draft design started from ${fromEstimateId}`;
        setDraftNotice(message);
        toast.success(message);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Failed to start design revision';
        setExternalLoad({ key: draftEntityKey, error: message, ready: false });
        setDraftNotice(message);
        toast.error(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    acceptExternalDraft,
    activeEditEstimateId,
    draftEntityKey,
    draftHydrated,
    estimateDuplicator,
    estimateLoader,
    fromEstimateId,
    hostKey,
    loadAttempt,
    projectId,
    queryClient,
    restoredFromLocalDraft,
    router,
    route.newEstimateCommercialScopeKind,
    toast,
    isProjectWorkspace,
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
    // Hydrating an unchanged estimate also caches a browser copy. That is not an unsaved edit.
    localDraftStatus: matchesLoadedEstimate && localDraftStatus.kind !== 'error'
      ? { kind: 'idle' as const }
      : localDraftStatus,
    project,
    setProject,
    projectError,
    draftNotice: matchesLoadedEstimate && draftNotice?.startsWith('Restored unsaved edits')
      ? `Editing design ${loadedEstimateDetail?.versionLabel}`
      : draftNotice,
    draftReady,
    draftLoadError,
    retryDraftLoad,
  };
}
