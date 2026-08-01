"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PipelineModal } from "@/components/ui/PipelineModal";
import {
  AlertBanner,
  Badge,
  Button,
  Checkbox,
} from "@/components/ui/foundation";
import {
  closeInactiveEnquiries,
  fetchInactiveEnquiryReport,
  inactiveEnquiryReportQueryKey,
} from "@/lib/projects/inactiveEnquiries/client";
import type { InactiveEnquiryCandidate } from "@/lib/projects/inactiveEnquiries/types";
import type { ProjectWorkQueueResponse } from "@/lib/queries/projectWorkQueue";
import { qk } from "@/lib/queries/keys";
import styles from "./InactiveEnquiryReview.module.css";

function activityLabel(value: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function sourceLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export default function InactiveEnquiryReview({ host }: { host: string }) {
  const queryClient = useQueryClient();
  const report = useQuery({
    queryKey: inactiveEnquiryReportQueryKey(host),
    queryFn: fetchInactiveEnquiryReport,
    staleTime: 60_000,
    retry: 1,
  });
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [commandId, setCommandId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedRows = useMemo(
    () =>
      (report.data?.candidates ?? []).filter((candidate) =>
        selected.has(candidate.projectId),
      ),
    [report.data?.candidates, selected],
  );

  function beginReview() {
    setSelected(new Set());
    setConfirming(false);
    setCommandId(null);
    setError(null);
    setOpen(true);
  }

  function toggle(candidate: InactiveEnquiryCandidate) {
    if (candidate.protectedByFutureWait) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(candidate.projectId)) next.delete(candidate.projectId);
      else next.add(candidate.projectId);
      return next;
    });
  }

  async function submit() {
    if (!report.data || selectedRows.length === 0 || pending) return;
    const stableCommandId = commandId ?? crypto.randomUUID();
    setCommandId(stableCommandId);
    setPending(true);
    setError(null);
    try {
      const response = await closeInactiveEnquiries({
        commandId: stableCommandId,
        reportAsOf: report.data.reportAsOf,
        inactiveDays: report.data.inactiveDays,
        candidates: selectedRows,
      });
      const closedIds = new Set(response.result.projects.map((item) => item.projectId));
      queryClient.setQueryData<ProjectWorkQueueResponse | undefined>(
        qk.projectWork.queue(host),
        (current) =>
          current
            ? {
                ...current,
                entries: current.entries.filter(
                  (entry) => !closedIds.has(entry.projectId),
                ),
              }
            : current,
      );
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: qk.projectWork.queue(host) }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard.dataPrefix() }),
        queryClient.invalidateQueries({ queryKey: qk.projects.indexPrefix(host) }),
        report.refetch(),
      ]);
      setMessage(
        `${response.result.closedCount} ${response.result.closedCount === 1 ? "enquiry was" : "enquiries were"} closed as Lost - No response.`,
      );
      setOpen(false);
      setConfirming(false);
      setSelected(new Set());
      setCommandId(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The close result is unknown. Retry with the same reviewed list.",
      );
    } finally {
      setPending(false);
    }
  }

  const candidates = report.data?.candidates ?? [];
  return (
    <>
      <section className={styles.card} aria-labelledby="inactive-enquiry-title">
        <div className={styles.cardCopy}>
          <div className={styles.headingRow}>
            <h2 id="inactive-enquiry-title">Stale enquiry review</h2>
            {report.data ? (
              <Badge tone={report.data.candidateCount > 0 ? "warning" : "neutral"}>
                {report.data.candidateCount} eligible
              </Badge>
            ) : null}
          </div>
          <p>
            Admin review for Enquiry projects with no recorded activity for more
            than 30 days. Nothing closes automatically.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={report.isLoading || Boolean(report.error)}
          onClick={beginReview}
        >
          Review exact list
        </Button>
      </section>
      {report.error ? (
        <AlertBanner
          tone="warning"
          title="Could not load the stale-enquiry review"
          action={
            <Button variant="tertiary" size="small" onClick={() => void report.refetch()}>
              Retry
            </Button>
          }
        >
          No projects were changed.
        </AlertBanner>
      ) : null}
      {message ? <div className={styles.success} role="status">{message}</div> : null}

      <PipelineModal
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !pending) setOpen(false);
        }}
        title={
          confirming
            ? `Confirm ${selectedRows.length} stale ${selectedRows.length === 1 ? "enquiry" : "enquiries"}`
            : "Review stale enquiries"
        }
        description={
          confirming
            ? "This exact list will be revalidated by the server before any project closes."
            : "Select the exact projects to close as Lost - No response. None are selected by default."
        }
        onBack={confirming && !pending ? () => setConfirming(false) : undefined}
        actions={
          confirming ? (
            <>
              <Button
                type="button"
                variant="destructive"
                fullWidth
                loading={pending}
                disabled={selectedRows.length === 0}
                onClick={() => void submit()}
              >
                {`Close ${selectedRows.length} as Lost - No response`}
              </Button>
              <Button
                type="button"
                variant="tertiary"
                fullWidth
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                fullWidth
                disabled={selectedRows.length === 0}
                onClick={() => {
                  setCommandId(crypto.randomUUID());
                  setConfirming(true);
                }}
              >
                {`Review selected (${selectedRows.length})`}
              </Button>
              <Button
                type="button"
                variant="tertiary"
                fullWidth
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </>
          )
        }
        hint="Future-dated Waiting projects are protected and cannot be selected."
      >
        {error ? (
          <AlertBanner tone="error" title="Nothing was closed">
            {error}
          </AlertBanner>
        ) : null}
        {confirming ? (
          <div className={styles.confirmation}>
            <p>
              The stage stays unchanged, remaining Project Work is cancelled,
              and each project leaves the active Work Queue. Projects can be
              reopened later.
            </p>
            <ul aria-label="Projects selected to close">
              {selectedRows.map((candidate) => (
                <li key={candidate.projectId}>
                  <strong>{candidate.projectName}</strong>
                  <span>{candidate.inactiveForDays} days inactive</span>
                </li>
              ))}
            </ul>
          </div>
        ) : candidates.length === 0 ? (
          <p className={styles.empty}>No stale Enquiry projects need review.</p>
        ) : (
          <div className={styles.list} aria-label="Stale enquiry candidates">
            {candidates.map((candidate) => (
              <div
                key={candidate.projectId}
                className={styles.row}
                data-protected={candidate.protectedByFutureWait || undefined}
              >
                <Checkbox
                  checked={selected.has(candidate.projectId)}
                  disabled={candidate.protectedByFutureWait}
                  label={candidate.projectName}
                  description={`${candidate.inactiveForDays} days inactive · Last ${sourceLabel(candidate.lastActivitySource)} ${activityLabel(candidate.lastActivityAt)}`}
                  onChange={() => toggle(candidate)}
                />
                <div className={styles.rowMeta}>
                  <Badge tone="neutral">{candidate.pipelineStage}</Badge>
                  {candidate.protectedByFutureWait ? (
                    <Badge tone="info">Protected Waiting</Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </PipelineModal>
    </>
  );
}
