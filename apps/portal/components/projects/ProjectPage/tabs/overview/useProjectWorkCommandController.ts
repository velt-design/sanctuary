"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  runProjectConfirmationCommand,
  runProjectStateCommand,
  runProjectWorkItemCommand,
  type ProjectWorkMutationResponse,
} from "@/lib/projects/workItems/client";
import type {
  ProjectClosedOutcome,
  ProjectOperationalState,
  ProjectWorkItem,
  ProjectWorkProjection,
  ProjectWorkResponsibilityArea,
} from "@/lib/projects/workItems/types";
import {
  projectCommandIntent,
  StableCommandAttempt,
} from "@/lib/projects/workItems/stableCommandAttempt";
import { parseAucklandDateTimeLocal } from "@/lib/time/aucklandDateTime";
import {
  invalidateProjectWorkReads,
  patchProjectWorkProjectionCaches,
} from "@/lib/queries/projectWorkCache";
import {
  isCadenceWorkItem,
  isDecisionReviewWorkItem,
  sentCommandForWorkItem,
} from "./projectWorkPresentation";
import { hasProhibitedProjectWorkText } from "./projectWorkVisibilityPolicy";

type ProjectWorkItemCommandAction = "sent" | "reply" | "complete";

type UseProjectWorkCommandControllerArgs = {
  projectId: string;
  host: string;
  projectWork: ProjectWorkProjection;
  stale: boolean;
  onRefresh: () => void;
};

export function useProjectWorkCommandController({
  projectId,
  host,
  projectWork,
  stale,
  onRefresh,
}: UseProjectWorkCommandControllerArgs) {
  const queryClient = useQueryClient();
  const commandAttempts = useRef(new StableCommandAttempt()).current;
  const inFlight = useRef(false);
  const [projection, setProjection] = useState(projectWork);
  const [pending, setPending] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualArea, setManualArea] =
    useState<ProjectWorkResponsibilityArea>("CUSTOMER");
  const [manualDueAt, setManualDueAt] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [stateChoice, setStateChoice] = useState<ProjectOperationalState>(
    projectWork.operationalState,
  );
  const [waitingUntil, setWaitingUntil] = useState("");
  const [stateReason, setStateReason] = useState("");
  const [closedOutcome, setClosedOutcome] =
    useState<ProjectClosedOutcome>("LOST_NO_RESPONSE");
  const [closedNote, setClosedNote] = useState("");

  useEffect(() => {
    setProjection(projectWork);
    setStateChoice(projectWork.operationalState);
  }, [projectWork]);

  const commit = useCallback(
    async (
      operation: () => Promise<ProjectWorkMutationResponse>,
    ): Promise<boolean> => {
      if (inFlight.current || stale) return false;
      inFlight.current = true;
      setPending(true);
      setMessage(null);
      setError(null);
      try {
        const response = await operation();
        if (!response.command.committed) {
          throw new Error(
            "The server did not confirm this project-work command.",
          );
        }
        if (response.projectWork) {
          setProjection(response.projectWork);
          patchProjectWorkProjectionCaches(
            queryClient,
            host,
            projectId,
            response.projectWork,
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
        return true;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The project-work result is unknown. Retry to confirm it.",
        );
        return false;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [host, onRefresh, projectId, queryClient, stale],
  );

  const commitCommand = useCallback(
    async (
      intent: string,
      operation: (commandId: string) => Promise<ProjectWorkMutationResponse>,
    ): Promise<boolean> => {
      const saved = await commit(() =>
        operation(commandAttempts.commandIdFor(intent)),
      );
      if (saved) commandAttempts.committed(intent);
      return saved;
    },
    [commandAttempts, commit],
  );

  const runItemAction = useCallback(
    async (
      item: ProjectWorkItem,
      action: ProjectWorkItemCommandAction,
    ): Promise<boolean> => {
      if (inFlight.current || stale) return false;
      if (item.status !== "OPEN") {
        setError("Only open project work can be actioned.");
        return false;
      }
      setPendingItemId(item.id);
      try {
        const command =
          action === "complete"
            ? "COMPLETE"
            : action === "sent"
              ? sentCommandForWorkItem(item)
              : item.sourceType === "QUOTE_CADENCE"
                ? "RECORD_QUOTE_CUSTOMER_REPLY"
                : item.sourceType === "LEAD_CADENCE"
                  ? "RECORD_ENQUIRY_CUSTOMER_REPLY"
                  : null;
        if (!command) {
          setError("This work item has no valid server command.");
          return false;
        }
        const payload =
          action === "complete"
            ? {
                command,
                workItemId: item.id,
                expectedRowVersion: item.rowVersion,
              }
            : {
                command,
                ...(item.subjectId ? { subjectId: item.subjectId } : {}),
              };
        return await commitCommand(
          projectCommandIntent(command, payload),
          (commandId) =>
            action === "complete"
              ? runProjectWorkItemCommand(projectId, { commandId, ...payload })
              : runProjectConfirmationCommand(projectId, {
                  commandId,
                  ...payload,
                }),
        );
      } finally {
        setPendingItemId(null);
      }
    },
    [commitCommand, projectId, stale],
  );

  const createManualItem = useCallback(async (): Promise<boolean> => {
    const dueAt = parseAucklandDateTimeLocal(manualDueAt);
    if (hasProhibitedProjectWorkText(manualTitle)) {
      setError("Call and Site Visit work cannot be created from Project Work.");
      return false;
    }
    if (!manualTitle.trim() || !dueAt) {
      setError("Enter a title and valid due time.");
      return false;
    }
    const primary = projection.primaryAction;
    const reviewItem =
      primary.kind === "workItem" && isDecisionReviewWorkItem(primary.item)
        ? primary.item
        : null;
    if (reviewItem && !manualReason.trim()) {
      setError("Record why the project is staying Active.");
      return false;
    }
    const payload = {
      command: reviewItem ? "REPLACE_REVIEW" : "CREATE",
      ...(reviewItem
        ? {
            workItemId: reviewItem.id,
            expectedRowVersion: reviewItem.rowVersion,
            reason: manualReason.trim(),
          }
        : {}),
      title: manualTitle.trim(),
      responsibilityArea: manualArea,
      dueAt,
    };
    const saved = await commitCommand(
      projectCommandIntent(payload.command, payload),
      (commandId) =>
        runProjectWorkItemCommand(projectId, {
          commandId,
          ...payload,
        }),
    );
    if (saved) {
      setManualTitle("");
      setManualDueAt("");
      setManualReason("");
    }
    return saved;
  }, [
    commitCommand,
    manualArea,
    manualDueAt,
    manualReason,
    manualTitle,
    projectId,
    projection.primaryAction,
  ]);

  const updateState = useCallback(async (): Promise<boolean> => {
    if (stateChoice === projection.operationalState) {
      setError("Choose a different project state.");
      return false;
    }
    const base = { expectedRowVersion: projection.stateRowVersion };
    if (stateChoice === "ACTIVE") {
      const command =
        projection.operationalState === "CLOSED" ? "REOPEN" : "ACTIVATE";
      const payload = {
        ...base,
        command,
        reason: stateReason.trim() || undefined,
      };
      return commitCommand(
        projectCommandIntent(command, payload),
        (commandId) =>
          runProjectStateCommand(projectId, {
            commandId,
            ...payload,
          }),
      );
    }
    if (!stateReason.trim()) {
      setError("Record why the current work is being ended.");
      return false;
    }
    if (stateChoice === "WAITING") {
      const parsedWaitingUntil = parseAucklandDateTimeLocal(waitingUntil);
      if (!parsedWaitingUntil) {
        setError("Choose a valid wake-up time.");
        return false;
      }
      const payload = {
        ...base,
        command: "WAIT",
        waitingUntil: parsedWaitingUntil,
        reason: stateReason.trim(),
        cancellationReason: stateReason.trim(),
      };
      return commitCommand(projectCommandIntent("WAIT", payload), (commandId) =>
        runProjectStateCommand(projectId, {
          commandId,
          ...payload,
        }),
      );
    }
    const payload = {
      ...base,
      command: "CLOSE",
      outcome: closedOutcome,
      note: closedNote.trim() || undefined,
      cancellationReason: stateReason.trim(),
    };
    return commitCommand(projectCommandIntent("CLOSE", payload), (commandId) =>
      runProjectStateCommand(projectId, {
        commandId,
        ...payload,
      }),
    );
  }, [
    closedNote,
    closedOutcome,
    commitCommand,
    projectId,
    projection.operationalState,
    projection.stateRowVersion,
    stateChoice,
    stateReason,
    waitingUntil,
  ]);

  const recordSiteVisitCompleted = useCallback(() => {
    const payload = { command: "RECORD_SITE_VISIT_COMPLETED" };
    return commitCommand(
      projectCommandIntent(payload.command, payload),
      (commandId) =>
        runProjectConfirmationCommand(projectId, {
          commandId,
          ...payload,
        }),
    );
  }, [commitCommand, projectId]);

  const primary = projection.primaryAction;
  const primaryItem = primary.kind === "workItem" ? primary.item : null;
  const manualTitleProhibited = hasProhibitedProjectWorkText(manualTitle);

  return {
    projection,
    primary,
    primaryItem,
    pending,
    pendingItemId,
    stale,
    message,
    error,
    controlsOpen,
    setControlsOpen,
    manualTitle,
    manualTitleProhibited,
    setManualTitle,
    manualArea,
    setManualArea,
    manualDueAt,
    setManualDueAt,
    manualReason,
    setManualReason,
    stateChoice,
    setStateChoice,
    waitingUntil,
    setWaitingUntil,
    stateReason,
    setStateReason,
    closedOutcome,
    setClosedOutcome,
    closedNote,
    setClosedNote,
    runItemAction,
    createManualItem,
    updateState,
    recordSiteVisitCompleted,
    primaryCanRecordReply: primaryItem ? isCadenceWorkItem(primaryItem) : false,
    primarySentCommand: primaryItem
      ? sentCommandForWorkItem(primaryItem)
      : null,
  };
}

export type ProjectWorkCommandController = ReturnType<
  typeof useProjectWorkCommandController
>;
