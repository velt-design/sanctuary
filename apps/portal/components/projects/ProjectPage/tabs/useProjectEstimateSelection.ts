"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EstimateDetail, EstimateMeta } from "@/lib/estimates/types";
import { useResolvedLocalFirstId } from "@/lib/localFirst/useResolvedLocalFirstId";
import {
  getLocalFirstStoreSnapshot,
  subscribeToLocalFirstStore,
} from "@/lib/localFirst/store";
import {
  buildEstimateEntityKey,
  isLocalEstimateId,
  PORTAL_LOCAL_FIRST_MUTATIONS,
} from "@/lib/localFirst/portalEntities";

/** Selection follows durable aliases; pending local creates remain editable in their own project. */
export function useProjectEstimateSelection(
  projectId: string,
  estimates: EstimateMeta[],
) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const rawEditId = params.get("estimateId")?.trim() ?? "";
  const rawRevisionId = params.get("fromEstimateId")?.trim() ?? "";
  const editEstimateId = useResolvedLocalFirstId(rawEditId) ?? "";
  const fromEstimateId = useResolvedLocalFirstId(rawRevisionId) ?? "";
  const snapshot = useSyncExternalStore(
    subscribeToLocalFirstStore,
    getLocalFirstStoreSnapshot,
    getLocalFirstStoreSnapshot,
  );

  function select(rawId: string, resolvedId: string): EstimateMeta | null {
    const saved = estimates.find(
      (estimate) =>
        estimate.id === resolvedId && estimate.projectId === projectId,
    );
    if (saved) return saved;
    if (!isLocalEstimateId(rawId)) return null;
    // Cache replacement precedes alias publication. Only an actual queued create for this project
    // may bridge that interval; an arbitrary local ID or another project's copy is not a design.
    const queuedCreate = snapshot.state.queue.some((item) => {
      if (item.mutationKey !== PORTAL_LOCAL_FIRST_MUTATIONS.estimateCreate)
        return false;
      const payload = item.payload as {
        projectId?: string;
        localEstimateId?: string;
      };
      return (
        payload.projectId === projectId && payload.localEstimateId === rawId
      );
    });
    const local = snapshot.state.workingCopies[buildEstimateEntityKey(rawId)]
      ?.data as EstimateDetail | undefined;
    return queuedCreate && local?.id === rawId && local.projectId === projectId
      ? local
      : null;
  }
  const selectedEstimate = select(rawEditId, editEstimateId);
  const revisionSource = select(rawRevisionId, fromEstimateId);
  const hydratingSelection =
    !snapshot.hydrated &&
    (isLocalEstimateId(rawEditId) || isLocalEstimateId(rawRevisionId));
  const signature = params.toString();

  useEffect(() => {
    if (!snapshot.hydrated) return;
    const next = new URLSearchParams(signature);
    let changed = false;
    if (
      selectedEstimate?.id === editEstimateId &&
      editEstimateId !== rawEditId
    ) {
      next.set("estimateId", selectedEstimate.id);
      changed = true;
    }
    if (
      revisionSource?.id === fromEstimateId &&
      fromEstimateId !== rawRevisionId
    ) {
      next.set("fromEstimateId", revisionSource.id);
      changed = true;
    }
    if (changed) router.replace(`${pathname}?${next.toString()}`);
  }, [
    snapshot.hydrated,
    signature,
    selectedEstimate,
    revisionSource,
    editEstimateId,
    fromEstimateId,
    rawEditId,
    rawRevisionId,
    pathname,
    router,
  ]);

  return {
    editEstimateId,
    fromEstimateId,
    selectedEstimate,
    revisionSource,
    hydratingSelection,
  };
}
