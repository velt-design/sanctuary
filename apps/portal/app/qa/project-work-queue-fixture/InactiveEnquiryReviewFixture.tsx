"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InactiveEnquiryReview from "@/app/staff/projects/work-queue/InactiveEnquiryReview.client";
import { inactiveEnquiryReportQueryKey } from "@/lib/projects/inactiveEnquiries/client";
import type { InactiveEnquiryReport } from "@/lib/projects/inactiveEnquiries/types";

const HOST = "fixture.invalid";
const REPORT: InactiveEnquiryReport = {
  reportAsOf: "2026-08-01T00:00:00.000Z",
  inactiveDays: 30,
  candidateCount: 2,
  candidates: [
    {
      projectId: "proj_fixture_stale_kate",
      projectName: "Kate - Titirangi",
      pipelineStage: "new",
      operationalState: "ACTIVE",
      waitingUntil: null,
      ownerKey: "ellen",
      lastActivityAt: "2026-04-01T00:00:00.000Z",
      lastActivitySource: "project_note",
      inactiveForDays: 122,
      protectedByFutureWait: false,
      evidenceFingerprint: "a".repeat(32),
    },
    {
      projectId: "proj_fixture_stale_phillip",
      projectName: "Phillip Maddren - Whangarei",
      pipelineStage: "contacted",
      operationalState: "ACTIVE",
      waitingUntil: null,
      ownerKey: "ellen",
      lastActivityAt: "2026-05-02T00:00:00.000Z",
      lastActivitySource: "email",
      inactiveForDays: 91,
      protectedByFutureWait: false,
      evidenceFingerprint: "b".repeat(32),
    },
    {
      projectId: "proj_fixture_protected_waiting",
      projectName: "Protected future follow-up",
      pipelineStage: "contacted",
      operationalState: "WAITING",
      waitingUntil: "2026-08-15T00:00:00.000Z",
      ownerKey: "ellen",
      lastActivityAt: "2026-05-15T00:00:00.000Z",
      lastActivitySource: "email",
      inactiveForDays: 78,
      protectedByFutureWait: true,
      evidenceFingerprint: "c".repeat(32),
    },
  ],
};

export default function InactiveEnquiryReviewFixture() {
  const [queryClient] = useState(() => {
    const client = new QueryClient();
    client.setQueryData(inactiveEnquiryReportQueryKey(HOST), REPORT);
    return client;
  });
  return (
    <QueryClientProvider client={queryClient}>
      <InactiveEnquiryReview host={HOST} />
    </QueryClientProvider>
  );
}
