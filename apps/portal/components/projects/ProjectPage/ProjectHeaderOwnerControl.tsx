"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectPageSnapshot } from "@/lib/projects/types";
import type { ProjectCommandMutationResponse } from "@/lib/projects/commandCentre/client";
import { projectCommandCentreQueryOptions } from "@/lib/queries/projects";
import {
  invalidateProjectWorkReads,
  patchProjectCommandCentreCache,
} from "@/lib/queries/projectWorkCache";
import { PipelineModal } from "@/components/ui/PipelineModal";
import { Button } from "@/components/ui/foundation";
import { useToast } from "@/components/ui/toast/ToastProvider";
import ProjectOwnerControls from "./tabs/overview/ProjectOwnerControls";
import styles from "./ProjectPage.module.css";

export default function ProjectHeaderOwnerControl({
  project,
  host,
  active,
  expectedWorkModel,
  externallyPaused = false,
}: {
  project: ProjectPageSnapshot["project"];
  host: string;
  active: boolean;
  expectedWorkModel: ProjectPageSnapshot["workModel"];
  externallyPaused?: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const commandQuery = useQuery({
    ...projectCommandCentreQueryOptions(host, project.id),
    enabled: false,
  });
  const coordinatedData =
    active &&
    !commandQuery.isError &&
    commandQuery.data?.workModel === expectedWorkModel
      ? commandQuery.data
      : null;
  const owner = coordinatedData?.owner ?? null;
  const resolvedOwner = owner ? owner.owner : project.owner;
  const displayName = resolvedOwner?.displayName ?? "Unassigned";
  const ownerKey = resolvedOwner?.key ?? "unassigned";
  const controlsPaused =
    pending ||
    externallyPaused ||
    commandQuery.isFetching ||
    commandQuery.isError ||
    !coordinatedData;

  const runMutation = async (
    operation: () => Promise<ProjectCommandMutationResponse>,
  ): Promise<boolean> => {
    if (controlsPaused || inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    try {
      const response = await operation();
      if (!response.command.committed) {
        throw new Error(
          "The server did not confirm this project-owner command.",
        );
      }
      if (response.commandCentre) {
        patchProjectCommandCentreCache(
          queryClient,
          host,
          project.id,
          response.commandCentre,
        );
      }
      await invalidateProjectWorkReads(queryClient, host, project.id);
      if (response.refreshRequired) void commandQuery.refetch();
      toast.success(
        response.command.replayed
          ? "Project owner was already saved on the server."
          : "Project owner saved on the server.",
      );
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The project owner could not be saved.",
      );
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <>
      {owner?.permissions.canManage && !controlsPaused ? (
        <button
          type="button"
          className={styles.mastheadOwnerButton}
          data-project-owner={ownerKey}
          aria-label={`Manage project owner. Current owner: ${displayName}`}
          onClick={() => setOpen(true)}
        >
          <strong>Owner</strong>
          <span>{displayName}</span>
        </button>
      ) : (
        <span className={styles.mastheadOwner} data-project-owner={ownerKey}>
          <strong>Owner</strong>
          <span>{displayName}</span>
        </span>
      )}

      {open && owner ? (
        <PipelineModal
          open
          size="sm"
          title="Manage project owner"
          description="This is the single Project Owner management point."
          onOpenChange={(nextOpen) => {
            if (!pending) setOpen(nextOpen);
          }}
          actions={
            <Button
              type="button"
              variant="tertiary"
              fullWidth
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          }
        >
          <ProjectOwnerControls
            projectId={project.id}
            stage={project.stage}
            owner={owner}
            disabled={controlsPaused}
            runMutation={runMutation}
          />
        </PipelineModal>
      ) : null}
    </>
  );
}
