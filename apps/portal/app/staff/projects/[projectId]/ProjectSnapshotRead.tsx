"use client";
import type {JobPacksListEvidence} from '@/components/projects/ProjectPage/tabs/JobPacksListSurface';
import type {OverviewBinding,ProjectOverviewEvidence} from '@/components/projects/ProjectPage/tabs/ProjectOverviewSurface';
import type {FilesBinding,ProjectFilesEvidence} from '@/components/projects/ProjectPage/tabs/ProjectFilesSurface';

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { projectWorkReadFunction } from '@/components/projects/ProjectPage/projectWorkInitialRead';
import type { ProjectWorkInitialRead, ProjectWorkReadLoaders } from '@/lib/projects/projectWorkInitialRead';
import PortalDebugExportButton from "@/components/debug/PortalDebugExportButton";
import dynamic from "next/dynamic";
import type { SearchReadOwner } from "@/components/layout/GlobalPortalSearchSurface";
import ReadStatus from '@/components/page-state/ReadStatus';
import type { QuotesListBinding } from '@/components/projects/ProjectPage/tabs/QuotesListSurface';
import type { InvoicesListBinding } from '@/components/projects/ProjectPage/tabs/InvoicesListSurface';
import type { CommercialTabChrome } from '@/components/projects/ProjectPage/tabs/CommercialTabSurface';
import type { EstimatesListBinding } from '@/components/projects/ProjectPage/tabs/EstimatesListSurface';
import type { ProjectSnapshotProps, ProjectSnapshotEvidence } from "./ProjectSnapshotSurface";
const SearchReader = dynamic(() => import("@/components/layout/GlobalPortalSearchRead"), { loading: () => null });
import { useProjectFilesPreparation } from '@/components/projects/ProjectPage/useProjectFilesPreparation';
import { ProjectCorrespondenceWarmRead } from '@/components/projects/ProjectPage/tabs/overview/ProjectCorrespondenceWarmRead';
import ProjectHeaderOwnerControl from '@/components/projects/ProjectPage/ProjectHeaderOwnerControl';
import ProjectHeaderPrivateActions from '@/components/projects/ProjectPage/ProjectHeaderPrivateActions';
import ProjectTabBody from '@/components/projects/ProjectPage/ProjectTabBody';
import { ProjectCommercialProvider } from '@/components/projects/ProjectPage/ProjectCommercialContext';
import { currentProjectWork } from '@/lib/projects/projectCurrentStatus';
import { preloadProjectTab, preloadProjectTabModule } from '@/components/projects/ProjectPage/projectTabModules';
import ProjectSnapshotNotice from "@/components/projects/ProjectPage/ProjectSnapshotNotice";
import type { useProjectTabSelection } from "@/components/projects/ProjectPage/useProjectTabSelection";
import { overviewProjectId } from "@/components/projects/ProjectPage/ProjectOverviewReadContext";
import { useProjectOverviewReads } from "@/components/projects/ProjectPage/ProjectOverviewReads";
import {
  DataStatePanel,
} from "@/components/ui/foundation";
import {
  buildPortalPageDebugExport,
  type PortalPageDebugExport,
} from "@/lib/debug/portalPageDebugExport";
import { inferPortalScenarioFromLabel } from "@/lib/debug/portalScenarioDebug";
import type {
  ProjectPageSnapshot,
  ProjectSnapshotLoadState,
} from "@/lib/projects/types";
import { ApiError } from "@/lib/repo/apiClient";
import { getProjectSnapshotPlaceholderFromCaches } from "@/lib/queries/projectCache";
import {
  projectPageSnapshotQueryOptions,
  projectPageSummaryQueryOptions,
} from "@/lib/queries/projects";
import {
  supabaseHostFromUrl,
  supabaseRuntimeUrl,
} from "@/lib/supabase/browserClient";

function ProjectSnapshotRead({
  projectId,
  tab,
  estimateId: initialEstimateId,
  calculatorWorkspace: initialCalculatorWorkspace = false,
  debugExportEnabled,
  initialRead,
  readOnly = false,
  readLoaders,
  navigation,
  publish,
  warmCorrespondence = false,
  estimatesList,
  quotesList,
  invoicesList,
  publishCommercial, overview, files, publishJobPacks,
}: ProjectSnapshotProps & {
  navigation: ReturnType<typeof useProjectTabSelection>;
  publish: (value: ProjectSnapshotEvidence | null) => void;
  warmCorrespondence?: boolean;
  estimatesList?: EstimatesListBinding;
  quotesList?: QuotesListBinding;
  invoicesList?: InvoicesListBinding;
  overview?:OverviewBinding;files?:FilesBinding;publishJobPacks?:(value:JobPacksListEvidence|null)=>void;
  publishCommercial?: (value: CommercialTabChrome | null) => void;
}) {
  // Native tab/history navigation updates the live query without a server render.
  // Workspace chrome and debug identity must follow that query too.
  const currentSearchParams = useSearchParams();
  const currentTab = currentSearchParams.get('tab');
  const estimateId = currentTab === null ? initialEstimateId : currentSearchParams.get('estimateId');
  const calculatorWorkspace = currentTab === null ? initialCalculatorWorkspace : currentTab === 'estimates'
    && Boolean(estimateId || currentSearchParams.get('fromEstimateId') || currentSearchParams.get('newDesign') === '1');
  const queryClient = useQueryClient();
  const { user } = usePortalSession();
  const ownerId = user?.id ?? null;
  const [projectAccess, setProjectAccess] = useState<{
    projectId: string;
    status: number;
  } | null>(null);
  const projectAccessStatus =
    projectAccess?.projectId === projectId
      ? projectAccess.status
      : null;
  const host = useMemo(
    () => supabaseHostFromUrl(supabaseRuntimeUrl()) || "unknown",
    [],
  );
  const cachedSummary = useMemo(
    () => getProjectSnapshotPlaceholderFromCaches(queryClient, host, projectId),
    [host, projectId, queryClient],
  );

  const summaryOptions = projectPageSummaryQueryOptions(host, projectId);
  const snapshotOptions = projectPageSnapshotQueryOptions(host, projectId);
  const summaryQuery = useQuery({
    ...summaryOptions,
    queryFn: projectWorkReadFunction(queryClient, summaryOptions.queryKey, 'summary', host, projectId, ownerId, readLoaders ? () => readLoaders.summary(projectId) : summaryOptions.queryFn!, initialRead),
    enabled: !cachedSummary && projectAccessStatus === null,
  });

  const snapshotQuery = useQuery({
    ...snapshotOptions,
    queryFn: projectWorkReadFunction(queryClient, snapshotOptions.queryKey, 'snapshot', host, projectId, ownerId, readLoaders ? () => readLoaders.snapshot(projectId) : snapshotOptions.queryFn!, initialRead),
    placeholderData: cachedSummary ?? summaryQuery.data,
    enabled: projectAccessStatus === null,
  });

  const snapshotStatus =
    snapshotQuery.error instanceof ApiError ? snapshotQuery.error.status : null;
  const summaryStatus =
    summaryQuery.error instanceof ApiError ? summaryQuery.error.status : null;
  const snapshotContentReady = Boolean(
    snapshotQuery.data && !snapshotQuery.isPlaceholderData,
  );
  const overviewReads = useProjectOverviewReads(
    host, projectId, navigation.activeTab === "activity" && projectAccessStatus === null,
    initialRead ? { read: initialRead, ownerId } : undefined, readLoaders,
  );
  const readAccessStatus = [summaryQuery.error, snapshotQuery.error, overviewReads.commandQuery.error, overviewReads.paymentQuery.error]
    .find((error) => error instanceof ApiError && [401, 403, 404].includes(error.status));
  const readAccessEndingStatus = readAccessStatus instanceof ApiError ? readAccessStatus.status : null;
  const accessUnavailable = projectAccessStatus !== null || readAccessEndingStatus !== null;
  useProjectFilesPreparation(projectId, host, !calculatorWorkspace && !accessUnavailable);
  const handleProjectAccessEnding = useCallback(
    (status: number) => {
      if (![401, 403, 404].includes(status)) return;
      queryClient.removeQueries({ queryKey: ["projects", host] });
      queryClient.removeQueries({ queryKey: ["estimates", host] });
      queryClient.removeQueries({ queryKey: ["quotes", host] });
      queryClient.removeQueries({ queryKey: ["invoices", host] });
      queryClient.removeQueries({ queryKey: ["jobPacks", host] });
      setProjectAccess({ projectId, status });
    },
    [host, projectId, queryClient],
  );
  useEffect(() => {
    if (readAccessEndingStatus !== null && projectAccessStatus === null) {
      handleProjectAccessEnding(readAccessEndingStatus);
    }
  }, [readAccessEndingStatus, projectAccessStatus, handleProjectAccessEnding]);
  const knownSummary =
    cachedSummary ??
    summaryQuery.data ??
    (snapshotQuery.isPlaceholderData ? snapshotQuery.data : undefined);
  const snapshot = accessUnavailable
    ? null
    : snapshotContentReady
      ? (snapshotQuery.data?.snapshot ?? null)
      : (knownSummary?.snapshot ?? null);
  const loadState: ProjectSnapshotLoadState = accessUnavailable
    ? "unavailable"
    : snapshotQuery.error
      ? "refresh-failed"
      : snapshotContentReady
        ? "fresh"
        : snapshot
          ? "summary"
          : "pending";
  const retry = () => {
    void snapshotQuery.refetch();
    if (!cachedSummary) void summaryQuery.refetch();
  };
  const debugExport = useMemo<PortalPageDebugExport | null>(() => {
    if (!debugExportEnabled || loadState !== "fresh" || !snapshot) return null;

    const isEstimateRoute = Boolean(estimateId);
    const pageId = isEstimateRoute ? "estimate-detail" : "project-detail";
    const route = isEstimateRoute
      ? `/staff/projects/${encodeURIComponent(projectId)}/estimate/${encodeURIComponent(estimateId ?? "")}`
      : `/staff/projects/${encodeURIComponent(projectId)}`;

    return buildPortalPageDebugExport({
      pageId,
      route,
      selectedIds: {
        projectId,
        contactId: snapshot.project.contactId ?? null,
        estimateId: estimateId ?? null,
      },
      serverState: {
        project: {
          id: snapshot.project.id,
          name: snapshot.project.name,
          stage: snapshot.project.stage,
          contactId: snapshot.project.contactId ?? null,
          quoteRef: snapshot.project.quoteRef ?? null,
        },
        pipelineStage: snapshot.pipeline.stage,
        activityCount: snapshot.activity.length,
        emailCount: snapshot.emails.length,
        noteCount: snapshot.notes.length,
      },
      clientState: {
        activeTab: currentTab ?? tab,
        queryHost: host,
      },
      diagnostics: {
        debugExportStatus: "ready",
        source: "project-snapshot-page",
      },
      scenario: inferPortalScenarioFromLabel(snapshot.project.name),
    });
  }, [
    currentTab,
    debugExportEnabled,
    estimateId,
    host,
    loadState,
    projectId,
    snapshot,
    tab,
  ]);

  const unavailablePanel = (() => {
    if (!accessUnavailable) return null;
    const pending = loadState === "pending";
    const unavailable = loadState === "unavailable";
    const title = pending
      ? "Opening project…"
      : unavailable &&
          (readAccessEndingStatus === 401 || readAccessEndingStatus === 403 ||
            projectAccessStatus === 401 ||
            projectAccessStatus === 403 ||
            snapshotStatus === 401 ||
            snapshotStatus === 403 ||
            summaryStatus === 401 ||
            summaryStatus === 403)
        ? "Project access unavailable"
        : unavailable
          ? "Project unavailable"
          : "Could not refresh project";
    const message = pending
      ? "Loading the latest project details in the background."
      : unavailable
        ? "The project may have been removed, or your access may have changed."
        : "Check your connection and try again.";

    return <ReadStatus title={title} tone="error" details={<DataStatePanel state="unavailable" title={title} description={message} />}/>;
  })();
  const searchReader = useMemo(() => ({ component: SearchReader as SearchReadOwner }), [publish]);
  const frameProjectId = snapshot?.project.id ?? overviewProjectId(projectId);
  const statusPanel = unavailablePanel ?? <><ProjectSnapshotNotice hasSavedDetails={Boolean(snapshot)} state={loadState} onRetry={retry} />
    {debugExport ? <PortalDebugExportButton payload={debugExport} /> : null}</>;
  const projectWork = snapshot ? currentProjectWork(snapshot, overviewReads.commandQuery.data) : undefined;
  const onTabIntent = useCallback((nextTab: import('@/lib/projects/projectTabs').ProjectNavigationTabKey, codeOnly = false) => {
    if (!accessUnavailable) void (codeOnly ? preloadProjectTabModule(nextTab) : preloadProjectTab(nextTab, { host, projectId: frameProjectId, queryClient }));
  }, [accessUnavailable, host, frameProjectId, queryClient]);
  const evidence = useMemo<ProjectSnapshotEvidence>(() => ({
    snapshot, host, readOnly: readOnly || accessUnavailable, snapshotContentReady,
    snapshotState: loadState, overviewReads, calculatorWorkspace, projectWork, onTabIntent,
    headerOwner: accessUnavailable ? null : <ProjectHeaderOwnerControl project={snapshot?.project ?? null} projectId={frameProjectId}
      pending={loadState === 'pending' || loadState === 'summary'} host={host} active={tab === 'activity'}
      expectedWorkModel={snapshot?.workModel} externallyPaused={readOnly || loadState !== 'fresh'} />,
    headerActions: accessUnavailable ? null : <ProjectHeaderPrivateActions project={snapshot?.project ?? null} projectId={frameProjectId} disabled={readOnly} />,
    body: accessUnavailable ? null : <ProjectCorrespondenceWarmRead projectId={projectId} enabled={warmCorrespondence && navigation.activeTab === 'activity'}><ProjectCommercialProvider projectId={frameProjectId} work={projectWork}
      ready={!readOnly && Boolean(snapshot) && loadState === 'fresh' && snapshotContentReady && (snapshot?.workModel === 'legacy' || Boolean(projectWork))}>
      <ProjectTabBody estimatesList={estimatesList} quotesList={quotesList} invoicesList={invoicesList} publishCommercial={publishCommercial} overview={overview} files={files} publishJobPacks={publishJobPacks} snapshot={snapshot} projectId={frameProjectId} host={host} readOnly={readOnly} snapshotContentReady={snapshotContentReady}
        snapshotState={loadState} tab={tab} optimisticTab={navigation.optimisticTab} onTabSelect={navigation.selectTab}
        calculatorWorkspace={calculatorWorkspace} onProjectAccessEnding={handleProjectAccessEnding} statusPanel={statusPanel} />
    </ProjectCommercialProvider></ProjectCorrespondenceWarmRead>,
    searchReader: accessUnavailable ? null : searchReader,
    onProjectAccessEnding: handleProjectAccessEnding,
    statusPanel,
  }), [snapshot, host, readOnly, accessUnavailable, snapshotContentReady, loadState, overviewReads, calculatorWorkspace,
    searchReader, handleProjectAccessEnding, unavailablePanel, debugExport, projectWork, onTabIntent, frameProjectId, projectId, navigation, tab, statusPanel, warmCorrespondence, estimatesList, quotesList, invoicesList, publishCommercial,overview,files,publishJobPacks]);
  useLayoutEffect(() => { publish(evidence); }, [publish, evidence]);
  useLayoutEffect(() => () => publish(null), [publish]);
  return null;
}

export default memo(ProjectSnapshotRead);
