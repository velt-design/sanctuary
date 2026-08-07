"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import PortalDebugExportButton from "@/components/debug/PortalDebugExportButton";
import ProjectPageFrame from "@/components/projects/ProjectPage/ProjectPageFrame";
import ProjectPagePendingFrame from "@/components/projects/ProjectPage/ProjectPagePendingFrame";
import styles from "@/components/projects/ProjectPage/ProjectPage.module.css";
import StaffPageHeader from "@/components/layout/StaffPageHeader";
import {
  AlertBanner,
  Button,
  DataStatePanel,
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
import type {
  ProjectNavigationTabKey,
  ProjectTabKey,
} from "@/lib/projects/projectTabs";
import {
  supabaseHostFromUrl,
  supabaseRuntimeUrl,
} from "@/lib/supabase/browserClient";
import { usePortalRouteTransition } from "@/components/page-state/PortalRouteTransition";

export default function ProjectSnapshotPageClient({
  projectId,
  tab,
  estimateId,
  debugExportEnabled,
}: {
  projectId: string;
  tab: string;
  estimateId: string | null;
  debugExportEnabled: boolean;
}) {
  const queryClient = useQueryClient();
  const routeSearchParams = useSearchParams();
  const [commandCentreAccess, setCommandCentreAccess] = useState<{
    projectId: string;
    status: number;
  } | null>(null);
  const commandCentreAccessStatus =
    commandCentreAccess?.projectId === projectId
      ? commandCentreAccess.status
      : null;
  const host = useMemo(
    () => supabaseHostFromUrl(supabaseRuntimeUrl()) || "unknown",
    [],
  );
  const cachedSummary = useMemo(
    () => getProjectSnapshotPlaceholderFromCaches(queryClient, host, projectId),
    [host, projectId, queryClient],
  );

  const summaryQuery = useQuery({
    ...projectPageSummaryQueryOptions(host, projectId),
    enabled: !cachedSummary,
  });

  const snapshotQuery = useQuery({
    ...projectPageSnapshotQueryOptions(host, projectId),
    placeholderData: cachedSummary ?? summaryQuery.data,
  });

  const snapshotStatus =
    snapshotQuery.error instanceof ApiError ? snapshotQuery.error.status : null;
  const summaryStatus =
    summaryQuery.error instanceof ApiError ? summaryQuery.error.status : null;
  const snapshotContentReady = Boolean(
    snapshotQuery.data && !snapshotQuery.isPlaceholderData,
  );
  const accessUnavailable =
    commandCentreAccessStatus !== null ||
    (!snapshotContentReady &&
      [snapshotStatus, summaryStatus].some(
        (status) => status === 401 || status === 403 || status === 404,
      ));
  const handleProjectAccessEnding = useCallback(
    (status: number) => {
      if (![401, 403, 404].includes(status)) return;
      queryClient.removeQueries({ queryKey: ["projects", host] });
      queryClient.removeQueries({ queryKey: ["estimates", host] });
      queryClient.removeQueries({ queryKey: ["quotes", host] });
      queryClient.removeQueries({ queryKey: ["invoices", host] });
      queryClient.removeQueries({ queryKey: ["jobPacks", host] });
      setCommandCentreAccess({ projectId, status });
    },
    [host, projectId, queryClient],
  );
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
  const { navigateRoute } = usePortalRouteTransition();
  const replacePendingTab = useCallback(
    (nextTab: ProjectTabKey) => {
      const query = new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      );
      query.set("tab", nextTab);
      if (nextTab !== "quotes") query.delete("quotePreview");
      if (nextTab !== "job-packs") query.delete("sheet");
      query.delete("mode");
      const href = `/staff/projects/${encodeURIComponent(projectId)}?${query.toString()}`;
      navigateRoute(
        { href, label: 'Project', source: 'project-pending-tab' },
        { replace: true, scroll: false },
      );
    },
    [navigateRoute, projectId],
  );
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
        activeTab: tab,
        queryHost: host,
      },
      diagnostics: {
        debugExportStatus: "ready",
        source: "project-snapshot-page",
      },
      scenario: inferPortalScenarioFromLabel(snapshot.project.name),
    });
  }, [
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
          (commandCentreAccessStatus === 401 ||
            commandCentreAccessStatus === 403 ||
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

    if (pending) {
      const pendingQuoteId = routeSearchParams.get("quoteId")?.trim() || null;
      const pendingEstimateId =
        routeSearchParams.get("estimateId")?.trim() || estimateId;
      const quoteDetail = tab === "quotes" && Boolean(pendingQuoteId);
      const jobPackDetail = tab === "job-packs" && Boolean(pendingEstimateId);

      return (
        <ProjectPagePendingFrame
          activeTab={tab}
          projectId={projectId}
          quoteDetail={quoteDetail}
          quotePreview={
            quoteDetail && routeSearchParams.get("quotePreview") === "1"
          }
          quoteId={pendingQuoteId}
          jobPackDetail={jobPackDetail}
          jobPackSheet={routeSearchParams.get("sheet")}
          jobPackEstimateId={pendingEstimateId}
          onTabSelect={(nextTab: ProjectNavigationTabKey) =>
            replacePendingTab(nextTab)
          }
          onCommercialViewSelect={replacePendingTab}
        />
      );
    }

    return (
      <PageLayout
        width="full"
        className={styles.page}
        data-ui-foundation-consumer="project-detail"
        data-project-id={projectId}
        data-project-snapshot-state={loadState}
        data-portal-page-shell="project-detail"
      >
        <StaffPageHeader
          variant="detail"
          eyebrow="Projects"
          title={title}
          description={message}
          back={{ label: "Back to Projects", href: "/staff/projects" }}
        />
        <DataStatePanel
          state={unavailable ? "unavailable" : "error"}
          title={title}
          description={message}
          onRetry={!unavailable ? retry : undefined}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      width="full"
      className={styles.page}
      data-ui-foundation-consumer="project-detail"
      data-project-background-ready={loadState === "fresh" ? "true" : undefined}
      data-project-id={projectId}
      data-project-shell-ready="true"
      data-project-snapshot-state={loadState}
      data-portal-page-shell="project-detail"
      data-portal-page-shell-ready="true"
    >
      {debugExport ? <PortalDebugExportButton payload={debugExport} /> : null}
      {loadState === "summary" ? (
        <AlertBanner tone="info" title="Updating project">
          Loading the latest Project Work, commercial state, notes and events.
        </AlertBanner>
      ) : null}
      {loadState === "refresh-failed" ? (
        <AlertBanner
          tone="warning"
          title="Showing saved project details"
          action={
            <Button variant="secondary" onClick={retry}>
              Retry
            </Button>
          }
        >
          The latest refresh failed. Your last known details remain available.
        </AlertBanner>
      ) : null}
      <ProjectPageFrame
        snapshot={snapshot}
        host={host}
        snapshotContentReady={snapshotContentReady}
        snapshotState={loadState}
        tab={tab}
        onProjectAccessEnding={handleProjectAccessEnding}
      />
    </PageLayout>
  );
}
