import { useMemo, useRef } from "react";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import { studioSceneInputKey } from "@/lib/designStudio/interaction/resolvedScene";
import type { StudioPointer } from "@/lib/designStudio/interaction/contracts";
import { useStudioResolvedScene } from "../apps/portal/components/designStudio/useStudioResolvedScene";
import {
  useStudioDirectPlacement,
  type StudioAttachmentProposal,
} from "../apps/portal/components/designStudio/useStudioDirectPlacement";
import { createStudioPendingAttachment } from "@/lib/designStudio/interaction/pendingAttachment";

/** Legacy focused tests use imperative world poses. Adapt those TEST inputs to
 * the live pointer contract; mounted acceptance uses the actual SVG/session. */
export function useStudioDirectPlacementHarness(
  edit: StudioAuthoringEdit,
  change: (edit: StudioAuthoringEdit) => void,
  locked = false,
  pending: StudioAttachmentProposal | null = null,
  onApplied?: () => void,
) {
  const version = useRef({ key: "", generation: 0 });
  const key = studioSceneInputKey(edit);
  if (version.current.key !== key)
    version.current = { key, generation: version.current.generation + 1 };
  const identity = {
    scopeKey: "test",
    epoch: "test",
    generation: version.current.generation,
  };
  const scene = useStudioResolvedScene(edit, "test")!,
    pendingScene = useStudioResolvedScene(pending?.edit ?? null, "pending");
  const serial = useRef(0);
  const pendingContent = pending
    ? JSON.stringify([studioSceneInputKey(pending.edit), pending.choice])
    : null;
  const proposal = useMemo(
    () =>
      pending
        ? createStudioPendingAttachment(pending, identity, ++serial.current)
        : null,
    [pendingContent, identity.generation],
  );
  const api = useStudioDirectPlacement({
    edit,
    locked,
    pending: proposal,
    scene,
    pendingScene,
    session: {
      identity,
      transact: (expected, create) => {
        if (expected.generation !== identity.generation)
          return { kind: "refused", reason: "Design changed." };
        const next = create(edit);
        change(next);
        return {
          kind: "accepted",
          previous: edit,
          edit: next,
          identity: { ...identity, generation: identity.generation + 1 },
        };
      },
    },
    onAccepted: () => {},
    onApplied,
  });
  const pointer = useRef<StudioPointer>({
    pointerId: 1,
    screen: { x: 0, y: 0 },
    world: { x: 0, y: 0 },
    units: 1,
  });
  return {
    ...api,
    directDrag: {
      canDrag: api.canMove,
      begin: (id: string) => {
        const basis = pendingScene ?? scene;
        const row = basis.rows.find((r) => r.object.id === id),
          house = basis.houses.find((h) => h.house.id === id);
        const pose =
          row?.position ??
          (house
            ? {
                x: Number(house.house.position.xMm),
                y: Number(house.house.position.yMm),
              }
            : { x: 0, y: 0 });
        pointer.current = {
          pointerId: 1,
          world: pose,
          screen: { x: 0, y: 0 },
          units: 1,
        };
        api.directDrag.press(id, pointer.current);
        pointer.current = { ...pointer.current, screen: { x: 4, y: 0 } };
        api.directDrag.move(pointer.current);
      },
      move: (
        _id: string,
        x: number,
        y: number,
        _cursor: { x: number; y: number },
        units: number,
      ) => {
        pointer.current = {
          pointerId: 1,
          world: { x, y },
          screen: { x: 100, y: 100 },
          units,
        };
        api.directDrag.move(pointer.current);
      },
      finish: (commit: boolean) =>
        commit
          ? api.directDrag.release(pointer.current)
          : api.directDrag.cancel(),
    },
  };
}
