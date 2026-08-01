import type { QueryClient } from "@tanstack/react-query";
import type { ProjectCommandCentreResponse } from "@/lib/projects/commandCentre/types";
import type { ProjectPageSnapshotResponse } from "@/lib/projects/types";
import type { ProjectWorkProjection } from "@/lib/projects/workItems/types";
import type { ProjectWorkQueueResponse } from "./projectWorkQueue";
import { qk } from "./keys";

function withProjectWork(
  current: ProjectPageSnapshotResponse | undefined,
  projectWork: ProjectWorkProjection,
): ProjectPageSnapshotResponse | undefined {
  if (!current || current.snapshot.workModel !== "v2") return current;
  return {
    ...current,
    snapshot: {
      ...current.snapshot,
      projectWork,
    },
  };
}

/**
 * Applies one server-returned V2 projection to every project-level cache that
 * can render it. This prevents Overview surfaces from briefly disagreeing
 * after a successful command while authoritative reads are refreshed.
 */
export function patchProjectWorkProjectionCaches(
  queryClient: QueryClient,
  host: string,
  projectId: string,
  projectWork: ProjectWorkProjection,
): void {
  queryClient.setQueryData<ProjectCommandCentreResponse | undefined>(
    qk.projects.commandCentre(host, projectId),
    (current) =>
      current?.workModel === "v2" ? { ...current, projectWork } : current,
  );
  queryClient.setQueryData<ProjectPageSnapshotResponse | undefined>(
    qk.projects.snapshot(host, projectId),
    (current) => withProjectWork(current, projectWork),
  );
  queryClient.setQueryData<ProjectPageSnapshotResponse | undefined>(
    qk.projects.summary(host, projectId),
    (current) => withProjectWork(current, projectWork),
  );
  if (
    projectWork.effectiveState === "CLOSED" ||
    projectWork.effectiveState === "ARCHIVED"
  ) {
    queryClient.setQueryData<ProjectWorkQueueResponse | undefined>(
      qk.projectWork.queue(host),
      (current) =>
        current
          ? {
              ...current,
              entries: current.entries.filter(
                (entry) => entry.projectId !== projectId,
              ),
            }
          : current,
    );
  }
}

/**
 * Applies one complete server-returned command-centre response to its sole
 * project cache. Callers still invalidate all Project Work reads afterwards
 * so snapshot, summary, queue and dashboard consumers refresh together.
 */
export function patchProjectCommandCentreCache(
  queryClient: QueryClient,
  host: string,
  projectId: string,
  commandCentre: ProjectCommandCentreResponse,
): void {
  queryClient.setQueryData(
    qk.projects.commandCentre(host, projectId),
    commandCentre,
  );
}

/**
 * Invalidates the complete set of Project Work consumers. With no project ID
 * it refreshes only global queue/dashboard reads, which is useful after
 * project creation or archive membership changes.
 */
export async function invalidateProjectWorkReads(
  queryClient: QueryClient,
  host: string,
  projectId?: string,
): Promise<void> {
  const projectReads = projectId
    ? [
        queryClient.invalidateQueries({
          queryKey: qk.projects.snapshot(host, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: qk.projects.summary(host, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: qk.projects.commandCentre(host, projectId),
        }),
      ]
    : [];

  await Promise.allSettled([
    ...projectReads,
    queryClient.invalidateQueries({ queryKey: qk.projectWork.queue(host) }),
    queryClient.invalidateQueries({ queryKey: qk.dashboard.dataPrefix() }),
  ]);
}
