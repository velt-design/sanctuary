import type { StudioAuthoringEdit } from "../authoringView";

export type StudioAuthoredIdentity = Readonly<{
  scopeKey: string;
  epoch: string;
  generation: number;
}>;

export function sameStudioAuthoredIdentity(
  a: StudioAuthoredIdentity,
  b: StudioAuthoredIdentity,
) {
  return (
    a.scopeKey === b.scopeKey &&
    a.epoch === b.epoch &&
    a.generation === b.generation
  );
}

export type StudioChangeOutcome =
  | {
      kind: "accepted";
      previous: StudioAuthoringEdit;
      edit: StudioAuthoringEdit;
      identity: StudioAuthoredIdentity;
    }
  | { kind: "refused"; reason: string };

/** The authority fence runs before create receives the CURRENT canonical edit. */
export type StudioGestureSession = {
  identity: StudioAuthoredIdentity;
  transact: (
    expected: StudioAuthoredIdentity,
    create: (current: StudioAuthoringEdit) => StudioAuthoringEdit,
  ) => StudioChangeOutcome;
};

export type StudioPointer = {
  pointerId: number;
  screen: { x: number; y: number };
  world: { x: number; y: number };
  units: number;
};

/** DOM adapter protocol. The controller, rather than the SVG, owns the phase. */
export type StudioPlacementPhase = "idle" | "pressed" | "dragging" | "waiting";
export type StudioDirectDrag = {
  readonly phase: StudioPlacementPhase;
  readonly pointerId: number | null;
  press: (id: string, pointer: StudioPointer) => boolean;
  move: (pointer: StudioPointer) => void;
  release: (pointer: StudioPointer) => void;
  cancel: (reason?: string) => void;
  pan?: (active: boolean) => void;
};
