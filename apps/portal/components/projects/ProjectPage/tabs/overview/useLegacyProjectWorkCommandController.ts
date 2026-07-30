"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  runProjectActionCommand,
  type ProjectCommandMutationResponse,
} from "@/lib/projects/commandCentre/client";
import type {
  ProjectCommandActionSummary,
  ProjectCommandCentreOperations,
} from "@/lib/projects/commandCentre/types";
import {
  invalidateProjectWorkReads,
  patchProjectCommandCentreCache,
} from "@/lib/queries/projectWorkCache";
import {
  projectCommandIntent,
  StableCommandAttempt,
} from "@/lib/projects/workItems/stableCommandAttempt";
import {
  hasProhibitedProjectWorkText,
  isProhibitedLegacyAction,
} from "./projectWorkVisibilityPolicy";

type UseLegacyProjectWorkCommandControllerArgs = {
  projectId: string;
  host: string;
  operations: ProjectCommandCentreOperations;
  stale: boolean;
  onRefresh: () => void;
};

export function useLegacyProjectWorkCommandController({
  projectId,
  host,
  operations,
  stale,
  onRefresh,
}: UseLegacyProjectWorkCommandControllerArgs) {
  const queryClient = useQueryClient();
  const commandAttempts = useRef(new StableCommandAttempt()).current;
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflictCandidateKey, setConflictCandidateKey] = useState("");
  const [controlsOpen, setControlsOpen] = useState(false);

  const current = operations.primaryAction;
  const prohibitedCurrent = isProhibitedLegacyAction(current);
  const visibleCandidates = operations.candidates.filter(
    (candidate) => !isProhibitedLegacyAction(candidate),
  );
  const prohibitedConflict = Boolean(
    operations.selectionConflict &&
    (isProhibitedLegacyAction(operations.selectionConflict.challenger) ||
      operations.selectionConflict.outrankingCandidates.some(
        isProhibitedLegacyAction,
      )),
  );
  const legacyReviewRequired = prohibitedCurrent || prohibitedConflict;
  const visibleConflictCandidates = operations.selectionConflict
    ? operations.selectionConflict.outrankingCandidates.filter(
        (candidate) => !isProhibitedLegacyAction(candidate),
      )
    : [];
  const conflictCandidate = operations.selectionConflict
    ? (visibleConflictCandidates.find(
        (candidate) =>
          `${candidate.sourceKind}:${candidate.sourceId}` ===
          conflictCandidateKey,
      ) ??
      visibleConflictCandidates[0] ??
      null)
    : null;
  const disabled = pending || stale || legacyReviewRequired;

  const actionRef = (action: ProjectCommandActionSummary) => ({
    sourceKind: action.sourceKind,
    sourceId: action.sourceId,
    expectedUpdatedAt: action.updatedAt,
    expectedCandidateRevision: operations.candidateRevision,
  });

  const commitResponse = async (response: ProjectCommandMutationResponse) => {
    if (!response.command.committed) {
      throw new Error("The server did not confirm this project command.");
    }
    if (response.commandCentre) {
      patchProjectCommandCentreCache(
        queryClient,
        host,
        projectId,
        response.commandCentre,
      );
    }
    await invalidateProjectWorkReads(queryClient, host, projectId);
    if (response.refreshRequired) {
      setMessage(
        "Saved on the server. Refreshing the Overview to load the confirmed state.",
      );
      onRefresh();
    } else {
      setMessage(
        response.command.replayed
          ? "Already saved on the server."
          : "Saved on the server.",
      );
    }
  };

  const run = async (
    operation: () => Promise<ProjectCommandMutationResponse>,
  ): Promise<boolean> => {
    if (disabled || inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await commitResponse(await operation());
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The project action could not be saved.",
      );
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const executeCommand = async (
    payload: Record<string, unknown>,
  ): Promise<boolean> => {
    if (
      payload.command === "create_manual" &&
      hasProhibitedProjectWorkText(
        typeof payload.title === "string" ? payload.title : null,
      )
    ) {
      setError(
        "Call and Site Visit actions cannot be created from Project Work.",
      );
      return false;
    }
    const intent = projectCommandIntent(
      typeof payload.command === "string"
        ? payload.command
        : "LEGACY_PROJECT_ACTION",
      payload,
    );
    const saved = await run(() =>
      runProjectActionCommand(projectId, {
        commandId: commandAttempts.commandIdFor(intent),
        ...payload,
      }),
    );
    if (saved) commandAttempts.committed(intent);
    return saved;
  };

  return {
    current,
    prohibitedCurrent,
    visibleCandidates,
    legacyReviewRequired,
    visibleConflictCandidates,
    conflictCandidate,
    conflictCandidateKey,
    setConflictCandidateKey,
    disabled,
    pending,
    message,
    error,
    controlsOpen,
    setControlsOpen,
    actionRef,
    executeCommand,
  };
}

export type LegacyProjectWorkCommandController = ReturnType<
  typeof useLegacyProjectWorkCommandController
>;
