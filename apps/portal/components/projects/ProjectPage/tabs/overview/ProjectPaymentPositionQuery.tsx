"use client";

import { useEffect } from "react";
import { Card, DataStatePanel, LoadingSkeleton } from "@/components/ui/foundation";
import { useActiveProjectOverviewReads } from "../../ProjectOverviewReads";
import { ApiError } from "@/lib/repo/apiClient";
import ProjectPaymentPosition from "./ProjectPaymentPosition";

export default function ProjectPaymentPositionQuery({ projectId, host, onAccessEnding }: {
  projectId: string;
  host: string;
  onAccessEnding?: (status: number) => void;
}) {
  const { paymentQuery: query } = useActiveProjectOverviewReads(host, projectId);
  const denied = query.error instanceof ApiError && [401, 403, 404].includes(query.error.status)
    ? query.error.status : null;
  useEffect(() => { if (denied !== null) onAccessEnding?.(denied); }, [denied, onAccessEnding]);

  // Never show cached financial data after the staff access boundary ends.
  if (denied !== null) return <DataStatePanel state="unavailable" title="Payment access unavailable" description="Your project access changed." />;
  if (query.data) return <ProjectPaymentPosition projectId={projectId} schedule={query.data} saved={query.isError}
    loadedAt={query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toISOString() : undefined} />;
  return <Card title="Payment position" padding="compact">
    {query.isPending ? <LoadingSkeleton rows={2} columns={2} label="Loading payment position" /> : (
      <DataStatePanel state="error" title="Payments unavailable" description="The payment record could not be loaded. No payment status is assumed." onRetry={() => void query.refetch()} />
    )}
  </Card>;
}
