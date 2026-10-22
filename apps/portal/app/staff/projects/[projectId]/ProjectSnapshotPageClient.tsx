"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { projectWorkReadFunction } from '@/components/projects/ProjectPage/projectWorkInitialRead';
import type { ProjectWorkInitialRead } from '@/lib/projects/projectWorkInitialRead';
import PortalDebugExportButton from "@/components/debug/PortalDebugExportButton";
import ProjectPageFrame from "@/components/projects/ProjectPage/ProjectPageFrame";
import { useProjectFilesPreparation } from '@/components/projects/ProjectPage/useProjectFilesPreparation';
import ProjectSnapshotNotice from "@/components/projects/ProjectPage/ProjectSnapshotNotice";
import { useProjectTabSelection } from "@/components/projects/ProjectPage/useProjectTabSelection";
import { ProjectOverviewReadsProvider, useProjectOverviewReads } from "@/components/projects/ProjectPage/ProjectOverviewReads";
import styles from "@/components/projects/ProjectPage/ProjectPage.module.css";
import StaffPageHeader from "@/components/layout/StaffPageHeader";
import {
  Card,
  DataStatePanel,
  LoadingSkeleton,
  PageLayout,
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

export default function ProjectSnapshotPageClient({
  projectId,
  tab,
  estimateId: initialEstimateId,
  calculatorWorkspace: initialCalculatorWorkspace = false,
  debugExportEnabled,
  initialRead,
}: {
  projectId: string;
  tab: string;
  estimateId: string | null;
  calculatorWorkspace?: boolean;
  debugExportEnabled: boolean;
  initialRead?: ProjectWorkInitialRead;
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
    queryFn: projectWorkReadFunction(queryClient, summaryOptions.queryKey, 'summary', host, projectId, ownerId, summaryOptions.queryFn!, initialRead),
    enabled: !cachedSummary && projectAccessStatus === null,
  });

  const snapshotQuery = useQuery({
    ...snapshotOptions,
    queryFn: projectWorkReadFunction(queryClient, snapshotOptions.queryKey, 'snapshot', host, projectId, ownerId, snapshotOptions.queryFn!, initialRead),
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
  const navigation = useProjectTabSelection(
    projectId,
    tab,
    snapshotContentReady ? Boolean(snapshotQuery.data?.snapshot.project.hasJobPacks) : undefined,
  );
  const overviewReads = useProjectOverviewReads(
    host, projectId, navigation.activeTab === "activity" && projectAccessStatus === null,
    initialRead ? { read: initialRead, ownerId } : undefined,
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

  if (!snapshot) {
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

    return (
      <PageLayout
        width="full"
        className={styles.page}
        data-ui-foundation-consumer="project-detail"
        data-project-id={projectId}
        data-project-snapshot-state={loadState}
      >
        <StaffPageHeader
          variant="detail"
          eyebrow="Projects"
          title={title}
          description={message}
          back={{ label: "Back to Projects", href: "/staff/projects" }}
        />
        {pending ? (
          <Card padding="compact">
            <LoadingSkeleton rows={5} columns={4} label="Loading project" />
          </Card>
        ) : (
          <DataStatePanel
            state={unavailable ? "unavailable" : "error"}
            title={title}
            description={message}
            onRetry={!unavailable ? retry : undefined}
          />
        )}
      </PageLayout>
    );
  }

  return (
    <PageLayout
      width="full"
      className={`${styles.page} ${calculatorWorkspace ? styles.calculatorPageLayout : ""}`}
      data-ui-foundation-consumer="project-detail"
      data-project-calculator-workspace={calculatorWorkspace ? "true" : undefined}
      data-project-background-ready={loadState === "fresh" ? "true" : undefined}
      data-project-id={projectId}
      data-project-shell-ready="true"
      data-project-snapshot-state={loadState}
    >
      <ProjectOverviewReadsProvider value={overviewReads}>
      <ProjectPageFrame
        key={snapshot.project.id}
        snapshot={snapshot}
        host={host}
        snapshotContentReady={snapshotContentReady}
        snapshotState={loadState}
        tab={tab}
        optimisticTab={navigation.optimisticTab}
        onTabSelect={navigation.selectTab}
        calculatorWorkspace={calculatorWorkspace}
        onProjectAccessEnding={handleProjectAccessEnding}
        statusPanel={<>
          <ProjectSnapshotNotice state={loadState} onRetry={retry} />
          {debugExport ? <PortalDebugExportButton payload={debugExport} /> : null}
        </>}
      />
      </ProjectOverviewReadsProvider>
    </PageLayout>
  );
}
