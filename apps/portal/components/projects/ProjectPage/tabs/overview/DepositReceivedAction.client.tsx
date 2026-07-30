"use client";

import { useState } from "react";
import { AlertBanner, Button, Input } from "@/components/ui/foundation";
import { apiJson } from "@/lib/repo/apiClient";

function todayInAuckland(): string {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function DepositReceivedAction({
  projectId,
  onRecorded,
}: {
  projectId: string;
  onRecorded: () => Promise<void> | void;
}) {
  const [paidDate, setPaidDate] = useState(todayInAuckland);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordDeposit = async () => {
    if (pending || recorded) return;
    setPending(true);
    setError(null);
    try {
      await apiJson(
        `/api/staff/v1/projects/${encodeURIComponent(projectId)}/action/mark_deposit_received`,
        {
          method: "POST",
          body: JSON.stringify({ paidDate }),
        },
      );
      setRecorded(true);
      setConfirming(false);
      await onRecorded();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The deposit receipt could not be recorded.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div data-deposit-received-action="true">
      <Input
        label="Deposit received date"
        type="date"
        value={paidDate}
        disabled={pending || recorded || confirming}
        onChange={(event) => setPaidDate(event.target.value)}
      />
      {error ? (
        <AlertBanner tone="error" title="Deposit not recorded">
          {error}
        </AlertBanner>
      ) : null}
      {confirming && !recorded ? (
        <AlertBanner
          tone="warning"
          title="Record deposit received?"
          action={
            <div>
              <Button
                type="button"
                size="small"
                variant="secondary"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="small"
                loading={pending}
                onClick={() => void recordDeposit()}
              >
                Confirm deposit received
              </Button>
            </div>
          }
        >
          This records the paid date, advances the project to Deposit, and records the won conversion.
        </AlertBanner>
      ) : (
        <Button
          type="button"
          size="small"
          disabled={recorded || !paidDate}
          onClick={() => setConfirming(true)}
        >
          {recorded ? "Deposit recorded" : "Record deposit received"}
        </Button>
      )}
    </div>
  );
}
