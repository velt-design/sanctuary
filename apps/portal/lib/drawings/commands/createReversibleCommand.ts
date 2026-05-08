import type { Command } from './command';

export type ReversibleCommandInput = {
  label: string;
  /** Forward action -- pushes the new state to the persistence layer. */
  apply: () => void;
  /** Inverse action -- pushes the captured pre-apply state back. */
  invert: () => void;
};

/**
 * Generic factory for any "apply forward, restore previous" command. The
 * `MoveTool`'s `createMoveCommand` is a specialised case (the inverse is
 * derivable from the forward via delta negation); for edge-drag commits the
 * inverse must be CAPTURED before the forward fires (the pre-edit polygon /
 * dimensions / attachment are gone after the action runs), so the caller
 * passes both directions explicitly.
 *
 * Usage pattern: snapshot the relevant fields from the store BEFORE
 * dispatching, then pass:
 *   apply  = () => commitX(target, nextFields)
 *   invert = () => commitX(target, capturedPreviousFields)
 *
 * Round-trips: invert returns a command whose own apply fires the original
 * apply, and whose invert returns a fresh forward command. Apply -> invert
 * -> invert returns the original state, etc.
 */
export function createReversibleCommand(input: ReversibleCommandInput): Command {
  return {
    label: input.label,
    apply: input.apply,
    invert: () =>
      createReversibleCommand({
        label: `Undo ${input.label}`,
        apply: input.invert,
        invert: input.apply,
      }),
  };
}
