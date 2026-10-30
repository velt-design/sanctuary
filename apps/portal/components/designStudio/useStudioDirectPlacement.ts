"use client";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import type {
  StudioGestureSession,
  StudioChangeOutcome,
  StudioAuthoredIdentity,
} from "@/lib/designStudio/interaction/contracts";
import { sameStudioAuthoredIdentity } from "@/lib/designStudio/interaction/contracts";
import {
  createStudioPlacementController,
  type StudioPlacementOverlay,
  type StudioPlacementInputs,
} from "@/lib/designStudio/interaction/placementController";
import {
  studioSceneInputKey,
  type ResolvedStudioScene,
} from "@/lib/designStudio/interaction/resolvedScene";
import {
  studioPreparationTasks,
  type StudioPreparationResult,
} from "@/lib/designStudio/interaction/preparation";
import type { StudioPendingAttachment } from "@/lib/designStudio/interaction/pendingAttachment";
import type {
  StudioPlacementMethod,
  StudioPlacementReadiness,
} from "@/lib/designStudio/interaction/placementData";
import { studioPlacementResources } from "@/lib/designStudio/interaction/placementResources";
import { createStudioPlacementPreparation } from "./studioPlacementPreparation";
export type {
  StudioPendingAttachment,
  StudioAttachmentProposal,
} from "@/lib/designStudio/interaction/pendingAttachment";

type Inputs = {
  edit: StudioAuthoringEdit;
  locked: boolean;
  pending: StudioPendingAttachment | null;
  session: StudioGestureSession;
  scene: ResolvedStudioScene;
  pendingScene: ResolvedStudioScene | null;
  selectedId?: string;
  onApplied?: () => void;
  onAccepted: (
    outcome: Extract<StudioChangeOutcome, { kind: "accepted" }>,
  ) => void;
};

/** React adapter for the controller, immutable read model and worker scheduler.
 * Readiness/press/frame/release never prepare geometry or hypothetical edits. */
export function useStudioDirectPlacement(args: Inputs) {
  const { locked, pending, session, scene, pendingScene } = args;
  const [prepared, setPrepared] = useState<{
    scopeKey: string;
    epoch: string;
    results: ReadonlyMap<string, StudioPreparationResult>;
  } | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    identity: StudioAuthoredIdentity;
    pendingKey: string | null;
  } | null>(null);
  const [overlay, setOverlay] = useState<StudioPlacementOverlay | null>(null);
  const pendingValid = useMemo(
    () =>
      !pending ||
      (sameStudioAuthoredIdentity(pending.basis, session.identity) &&
        pending.content ===
          JSON.stringify([studioSceneInputKey(pending.edit), pending.choice]) &&
        pending.key ===
          JSON.stringify([
            pending.basis.scopeKey,
            pending.basis.epoch,
            pending.basis.generation,
            pending.serial,
            pending.content,
          ])),
    [
      pending,
      session.identity.scopeKey,
      session.identity.epoch,
      session.identity.generation,
    ],
  );
  const pendingKey = pending?.key ?? null;
  const basis = pending && pendingScene ? pendingScene : scene;
  const baseTasks = useMemo(() => studioPreparationTasks(basis), [basis]);
  const [variantRequests, setVariantRequests] = useState(
    new Map<string, { target: string; along: number; datums: number[] }>(),
  );
  const tasks = useMemo(
    () =>
      baseTasks.map((task) => {
        const request = variantRequests.get(task.dependencyKey);
        return request
          ? {
              ...task,
              requestedDatums: request.datums,
              dependencyKey: JSON.stringify([task.dependencyKey, request]),
            }
          : task;
      }),
    [baseTasks, variantRequests],
  );
  const taskSetKey = useMemo(
    () => JSON.stringify(tasks.map((task) => task.dependencyKey)),
    [tasks],
  );
  const selectedId =
    pending?.choice.objectId ?? args.selectedId ?? basis.rows[0]?.object.id;
  const current = basis.rows.find((row) => row.object.id === selectedId);
  const method: StudioPlacementMethod =
    pending?.choice.method ??
    current?.studioAttachment?.method ??
    current?.design?.input.connection ??
    "facade";
  const scheduler = useMemo(
    () =>
      createStudioPlacementPreparation(
        () =>
          new Worker(new URL("./studioPlacement.worker.ts", import.meta.url)),
        (results) =>
          setPrepared({
            scopeKey: session.identity.scopeKey,
            epoch: session.identity.epoch,
            results,
          }),
      ),
    [session.identity.scopeKey, session.identity.epoch],
  );
  useEffect(() => () => scheduler.dispose(), [scheduler]);
  useEffect(() => {
    scheduler.update({
      context: {
        scopeKey: session.identity.scopeKey,
        epoch: session.identity.epoch,
        pendingKey,
      },
      tasks: pendingValid ? tasks : [],
      selectedId,
      method,
    });
  }, [scheduler, taskSetKey, pendingKey, pendingValid, selectedId, method]);

  const resources = useMemo(
    () =>
      studioPlacementResources(
        scene,
        basis,
        tasks,
        prepared?.scopeKey === session.identity.scopeKey &&
          prepared.epoch === session.identity.epoch
          ? prepared.results
          : null,
      ),
    [
      basis,
      scene,
      prepared,
      tasks,
      session.identity.scopeKey,
      session.identity.epoch,
    ],
  );

  const latest = useRef<StudioPlacementInputs>(null!);
  latest.current = {
    session,
    locked: locked || !pendingValid,
    pendingKey,
    connectionError: (id, variant) => {
      const operation = resources.operations.get(`${id}:${variant}`);
      return operation?.kind === "refused" ? operation.reason : null;
    },
    prepareConnection: (id, cache, candidate) => {
      if (candidate.unresolved?.kind !== "preparing") return;
      const task = baseTasks.find(
        (t) => t.objectId === id && t.method === cache.method,
      );
      if (!task) return;
      const datum = candidate.unresolved.datum,
        along = candidate.choice.alongEdgeMm ?? 0;
      setVariantRequests((previous) => {
        const old = previous.get(task.dependencyKey);
        if (
          old?.target === candidate.key &&
          old.along === along &&
          old.datums.includes(datum)
        )
          return previous;
        const next = new Map(previous);
        // At most sixteen requested variants per live object/method shape.
        const datums = [
          ...(old?.datums ?? []).filter((d) => d !== datum),
          datum,
        ].slice(-16);
        next.set(task.dependencyKey, { target: candidate.key, along, datums });
        const live = new Set(baseTasks.map((t) => t.dependencyKey));
        for (const key of next.keys()) if (!live.has(key)) next.delete(key);
        return next;
      });
    },
    publish: setOverlay,
    message: (text, identity = session.identity) =>
      setMessage({
        text,
        identity,
        pendingKey:
          identity.generation === session.identity.generation
            ? pendingKey
            : null,
      }),
    applied: (result) => {
      args.onAccepted(result);
      args.onApplied?.();
    },
    acquire: (id) => {
      if (!pendingValid || (pending && pending.choice.objectId !== id))
        return null;
      const house =
        !pending && scene.houses.find((entry) => entry.house.id === id);
      if (house)
        return {
          house: house.house,
          pose: {
            x: Number(house.house.position.xMm),
            y: Number(house.house.position.yMm),
          },
          original: house.footprint,
          pending: null,
        };
      const row = basis.rows.find((entry) => entry.object.id === id);
      const variant =
        pending?.choice.method ??
        row?.studioAttachment?.method ??
        row?.design?.input.connection ??
        "facade";
      const cache = resources.caches.get(`${id}:${variant}`);
      return cache && row?.position
        ? { pose: row.position, original: cache.original, cache, pending }
        : null;
    },
  };
  const controller = useMemo(
    () => createStudioPlacementController(() => latest.current),
    [session.identity.scopeKey, session.identity.epoch],
  );
  const phase = useSyncExternalStore(
    controller.subscribePhase,
    () => controller.phase,
    () => controller.phase,
  );
  useLayoutEffect(() => {
    controller.reconcile(session.identity, locked || !pendingValid, pendingKey);
  }, [
    session.identity.generation,
    locked,
    pendingValid,
    pendingKey,
    controller,
  ]);
  useLayoutEffect(() => {
    controller.refresh();
  }, [controller, resources]);
  useLayoutEffect(() => {
    setOverlay(null);
    return () => controller.dispose();
  }, [controller]);
  useLayoutEffect(() => {
    if (
      overlay?.accepted &&
      (sameStudioAuthoredIdentity(overlay.accepted, session.identity) ||
        overlay.accepted.scopeKey !== session.identity.scopeKey ||
        overlay.accepted.epoch !== session.identity.epoch ||
        session.identity.generation > overlay.accepted.generation)
    )
      setOverlay(null);
  }, [
    scene,
    session.identity.scopeKey,
    session.identity.epoch,
    session.identity.generation,
    overlay?.accepted,
  ]);
  const activeOverlay =
    overlay &&
    (!overlay.accepted ||
      sameStudioAuthoredIdentity(overlay.accepted, session.identity))
      ? overlay
      : null;
  const operation = resources.operations.get(`${selectedId}:${method}`);
  const selectedTask = tasks.find(
    (task) => task.objectId === selectedId && task.method === method,
  );
  const selectedResult =
    selectedTask &&
    prepared?.scopeKey === session.identity.scopeKey &&
    prepared.epoch === session.identity.epoch
      ? prepared.results.get(selectedTask.dependencyKey)
      : null;
  return {
    canMove: (id: string) =>
      !locked && pendingValid && latest.current.acquire(id) !== null,
    readiness: (
      id: string,
      operation: "freeMove" | "align" | StudioPlacementMethod,
    ): StudioPlacementReadiness =>
      resources.operations.get(`${id}:${operation}`) ?? {
        kind: "refused",
        reason: "The selected object is unavailable.",
      },
    directDrag: controller.api,
    phase,
    proposal: activeOverlay?.preview ?? null,
    footprint: activeOverlay
      ? {
          points: activeOverlay.preview.points,
          original: activeOverlay.original,
          target: activeOverlay.preview.target,
          guides: activeOverlay.preview.guides,
        }
      : undefined,
    message: !pendingValid
      ? "The connection proposal belongs to an earlier design. Preview it again."
      : (current?.error ??
        (selectedResult?.kind === "refused" ? selectedResult.reason : null) ??
        (pending && operation?.kind === "refused" ? operation.reason : null) ??
        (message &&
        message.pendingKey === pendingKey &&
        sameStudioAuthoredIdentity(message.identity, session.identity)
          ? message.text
          : null) ??
        (!locked && operation?.kind === "preparing" ? operation.reason : null)),
    busy: !!activeOverlay && !activeOverlay.accepted,
  };
}
