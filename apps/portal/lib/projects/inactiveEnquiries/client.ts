import { apiJson } from "@/lib/repo/apiClient";
import type {
  InactiveEnquiryCandidate,
  InactiveEnquiryCloseResult,
  InactiveEnquiryReport,
} from "./types";

const ENDPOINT = "/api/admin/project-work/inactive-enquiries";

export const inactiveEnquiryReportQueryKey = (host: string) =>
  ["projectWork", host, "inactiveEnquiryReview"] as const;

export function fetchInactiveEnquiryReport(): Promise<InactiveEnquiryReport> {
  return apiJson<InactiveEnquiryReport>(ENDPOINT);
}

export function closeInactiveEnquiries(input: {
  commandId: string;
  reportAsOf: string;
  inactiveDays: number;
  candidates: readonly InactiveEnquiryCandidate[];
}): Promise<InactiveEnquiryCloseResult> {
  return apiJson<InactiveEnquiryCloseResult>(ENDPOINT, {
    method: "POST",
    body: JSON.stringify({
      commandId: input.commandId,
      reportAsOf: input.reportAsOf,
      inactiveDays: input.inactiveDays,
      candidates: input.candidates.map((candidate) => ({
        projectId: candidate.projectId,
        evidenceFingerprint: candidate.evidenceFingerprint,
        lastActivityAt: candidate.lastActivityAt,
        lastActivitySource: candidate.lastActivitySource,
      })),
    }),
  });
}
