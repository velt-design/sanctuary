import type {
  GestureCache,
  GesturePreview,
} from "@/lib/designStudio/interaction/gesturePreview";
import {
  connectionDeparture,
  previewGesture,
  updateConnectionDeparture,
} from "@/lib/designStudio/interaction/gesturePreview";
import {
  sameStudioAuthoredIdentity,
  type StudioAuthoredIdentity,
  type StudioChangeOutcome,
  type StudioDirectDrag,
  type StudioGestureSession,
  type StudioPointer,
} from "./contracts";
import type { StudioHouse } from "../studioHouseScene";
import {
  updateStudioHouse,
  previewStudioAttachment,
  detachStudioPergola,
} from "../studioHouseCommands";
import { detachWebsitePergola } from "../websiteAttachment";
import {
  positionWebsitePergola,
  websiteComposition,
} from "../websiteComposition";

import type { StudioPendingAttachment } from "./pendingAttachment";
export type { StudioPendingAttachment } from "./pendingAttachment";
type Basis = {
  id: string;
  pointer: StudioPointer;
  pose: { x: number; y: number };
  identity: StudioAuthoredIdentity;
  pendingKey: string | null;
  original: { x: number; y: number }[];
  pending: StudioPendingAttachment | null;
  house?: StudioHouse;
  cache?: GestureCache;
  departure: ReturnType<typeof connectionDeparture>;
};
type State =
  | { phase: "idle" }
  | { phase: "pressed"; basis: Basis }
  | {
      phase: "dragging";
      basis: Basis;
      preview: GesturePreview;
      pointer: StudioPointer;
    }
  | {
      phase: "waiting";
      basis: Basis;
      preview: GesturePreview;
      finalPointer: StudioPointer;
    };
export type StudioPlacementOverlay = {
  preview: GesturePreview;
  original: { x: number; y: number }[];
  accepted?: StudioAuthoredIdentity;
};
export type StudioPlacementInputs = {
  session: StudioGestureSession;
  locked: boolean;
  pendingKey: string | null;
  acquire: (id: string) => {
    pose: { x: number; y: number };
    original: { x: number; y: number }[];
    house?: StudioHouse;
    cache?: GestureCache;
    pending: StudioPendingAttachment | null;
  } | null;
  connectionError?: (
    id: string,
    method: GestureCache["method"],
  ) => string | null;
  prepareConnection?: (
    id: string,
    cache: GestureCache,
    candidate: NonNullable<GesturePreview["connection"]>,
  ) => void;
  publish: (overlay: StudioPlacementOverlay | null) => void;
  message: (message: string, identity?: StudioAuthoredIdentity) => void;
  applied: (result: Extract<StudioChangeOutcome, { kind: "accepted" }>) => void;
};

/** The only direct-placement phase/commit owner. Waiting has frozen release
 * authority but no live pointer capture. No DOM or persistence lives here. */
export function createStudioPlacementController(
  read: () => StudioPlacementInputs,
) {
  let state: State = { phase: "idle" };
  const phaseListeners = new Set<() => void>();
  // Overlay identity can stay null across a click. Phase observers still need
  // release/cancel, without another notification for each held preview frame.
  const transition = (next: State) => {
    const previous = state.phase;
    state = next;
    if (state.phase !== previous)
      for (const listener of phaseListeners) listener();
  };
  const clear = () => {
    transition({ phase: "idle" });
    read().publish(null);
  };
  function cancel(reason?: string) {
    const pending = state.phase !== "idle" && state.basis.pending;
    clear();
    if (reason) read().message(reason);
    else if (pending)
      read().message(
        "Move cancelled. Connection proposal restored; current design is unchanged.",
      );
  }
  function current(basis: Basis) {
    const inputs = read();
    if (
      inputs.locked ||
      !sameStudioAuthoredIdentity(inputs.session.identity, basis.identity) ||
      inputs.pendingKey !== basis.pendingKey
    ) {
      cancel("Design changed. Start the move again.");
      return null;
    }
    return inputs;
  }
  function evaluate(
    basis: Basis,
    pointer: StudioPointer,
    held: string | undefined,
    inputs: StudioPlacementInputs,
  ): GesturePreview {
    if (basis.cache) {
      const current = inputs.acquire(basis.id)?.cache;
      if (current?.candidates.length) basis.cache = current;
    }
    const x = basis.pose.x + pointer.world.x - basis.pointer.world.x,
      y = basis.pose.y + pointer.world.y - basis.pointer.world.y;
    let preview = basis.house
      ? {
          key: "house",
          points: basis.original.map((p) => ({
            x: p.x + x - basis.pose.x,
            y: p.y + y - basis.pose.y,
          })),
          x,
          y,
          message:
            "House position preview. Release to apply or Escape to cancel.",
        }
      : previewGesture(
          basis.cache!,
          x,
          y,
          pointer.units,
          held,
          updateConnectionDeparture(basis.departure, x, y, pointer.units),
        );
    const preparationError =
      preview.connection?.unresolved &&
      basis.cache &&
      inputs.connectionError?.(basis.id, basis.cache.method);
    if (preparationError)
      preview = {
        ...preview,
        candidate: undefined,
        points: [],
        connection: {
          ...preview.connection!,
          unresolved: { kind: "refused", reason: preparationError },
        },
        message: preparationError,
      };

    if (preview.connection?.unresolved?.kind === "preparing")
      inputs.prepareConnection?.(basis.id, basis.cache!, preview.connection);
    return preview;
  }
  function commit(
    basis: Basis,
    preview: GesturePreview,
    inputs: StudioPlacementInputs,
  ) {
    const result = inputs.session.transact(basis.identity, (current) => {
      if (basis.house)
        return updateStudioHouse(current, {
          ...basis.house,
          position: {
            ...basis.house.position,
            xMm: String(preview.x),
            yMm: String(preview.y),
          },
        });
      if (preview.candidate) {
        const next = previewStudioAttachment(current, preview.candidate.choice),
          row = websiteComposition(next).find((r) => r.object.id === basis.id);
        const expected = preview.candidate.pose;
        if (
          !row?.position ||
          Math.hypot(row.position.x - expected.x, row.position.y - expected.y) >
            1e-5 ||
          Math.abs(row.position.rotation - expected.rotation) > 1e-5 ||
          row.geometryOptions?.supportDatumMm !== preview.candidate.height ||
          row.object.attachment?.host?.edgeId !==
            preview.candidate.canonicalHost.edgeId ||
          row.object.attachment?.host?.objectId !==
            preview.candidate.canonicalHost.objectId
        )
          throw Error("The connection changed. Preview it again.");
        return next;
      }
      let next = current;
      if (basis.pending)
        next = previewStudioAttachment(current, basis.pending.choice);
      if (basis.pending || basis.cache!.row.studioAttachment)
        next = detachStudioPergola(next, basis.id);
      else if (basis.cache!.row.object.attachment?.host)
        next = detachWebsitePergola(next, basis.id);
      return positionWebsitePergola(next, basis.id, {
        originXMm: String(preview.x),
        originYMm: String(preview.y),
      });
    });
    transition({ phase: "idle" });
    if (result.kind === "accepted") {
      inputs.publish({
        preview,
        original: basis.original,
        accepted: result.identity,
      });
      inputs.applied(result);
      inputs.message(
        preview.candidate ? "Connected to house." : "Placement applied.",
        result.identity,
      );
    } else {
      inputs.publish(null);
      inputs.message(result.reason);
    }
  }
  function finish(
    basis: Basis,
    preview: GesturePreview,
    pointer: StudioPointer,
    inputs: StudioPlacementInputs,
  ) {
    if (preview.connection?.unresolved) {
      const unresolved = preview.connection.unresolved;
      if (unresolved.kind === "preparing" && inputs.prepareConnection) {
        transition({ phase: "waiting", basis, preview, finalPointer: pointer });
        inputs.publish({ preview, original: basis.original });
        inputs.message(unresolved.reason);
      } else {
        clear();
        inputs.message(unresolved.reason);
      }
      return;
    }
    commit(basis, preview, inputs);
  }
  function move(pointer: StudioPointer) {
    if (
      state.phase === "idle" ||
      state.phase === "waiting" ||
      pointer.pointerId !== state.basis.pointer.pointerId
    )
      return;
    const basis = state.basis,
      inputs = current(basis);
    if (!inputs) return;
    if (
      state.phase === "pressed" &&
      Math.hypot(
        pointer.screen.x - basis.pointer.screen.x,
        pointer.screen.y - basis.pointer.screen.y,
      ) < 4
    )
      return;
    const preview = evaluate(
      basis,
      pointer,
      state.phase === "dragging" ? state.preview.key : undefined,
      inputs,
    );
    transition({ phase: "dragging", basis, preview, pointer });
    inputs.publish({ preview, original: basis.original });
  }
  const api: StudioDirectDrag = {
    get phase() {
      return state.phase;
    },
    get pointerId() {
      return state.phase === "idle" || state.phase === "waiting"
        ? null
        : state.basis.pointer.pointerId;
    },
    press(id, pointer) {
      const inputs = read();
      if (state.phase === "waiting") clear();
      if (inputs.locked || state.phase !== "idle") return false;
      const resource = inputs.acquire(id);
      if (!resource) return false;
      clear();
      transition({
        phase: "pressed",
        basis: {
          ...resource,
          id,
          pointer,
          identity: inputs.session.identity,
          pendingKey: inputs.pendingKey,
          departure: resource.cache
            ? connectionDeparture(resource.cache)
            : null,
        },
      });
      return true;
    },
    move,
    release(pointer) {
      if (
        state.phase === "idle" ||
        state.phase === "waiting" ||
        pointer.pointerId !== state.basis.pointer.pointerId
      )
        return;
      move(pointer);
      const after = state as State;
      if (after.phase === "idle" || after.phase === "waiting") return;
      if (after.phase === "pressed") {
        clear();
        return;
      }
      const inputs = current(after.basis);
      if (inputs) finish(after.basis, after.preview, pointer, inputs);
    },
    cancel,
  };
  return {
    api,
    subscribePhase(listener: () => void) {
      phaseListeners.add(listener);
      return () => {
        phaseListeners.delete(listener);
      };
    },
    dispose: clear,
    refresh() {
      if (state.phase === "dragging") {
        move(state.pointer);
        return;
      }
      if (state.phase !== "waiting") return;
      const { basis, finalPointer, preview: previous } = state,
        inputs = current(basis);
      if (!inputs) return;
      const preview = evaluate(basis, finalPointer, previous.key, inputs);
      finish(basis, preview, finalPointer, inputs);
    },
    get phase() {
      return state.phase;
    },
    reconcile(
      identity: StudioAuthoredIdentity,
      locked: boolean,
      pendingKey: string | null,
    ) {
      if (
        state.phase !== "idle" &&
        (locked ||
          !sameStudioAuthoredIdentity(state.basis.identity, identity) ||
          state.basis.pendingKey !== pendingKey)
      )
        cancel("Design changed. Start the move again.");
    },
  };
}
