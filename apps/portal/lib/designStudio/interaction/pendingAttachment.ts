import type { StudioAuthoringEdit } from "../authoringView";
import type { previewStudioAttachment } from "../studioHouseCommands";
import type { StudioAuthoredIdentity } from "./contracts";
import { studioSceneInputKey } from "./resolvedScene";

export type StudioAttachmentProposal = {
  edit: StudioAuthoringEdit;
  choice: Parameters<typeof previewStudioAttachment>[1];
};
export type StudioPendingAttachment = StudioAttachmentProposal & {
  basis: StudioAuthoredIdentity;
  serial: number;
  content: string;
  key: string;
};

/** A proposal is ephemeral and belongs to the committed edit from which the
 * canonical preview was made. Serial distinguishes A -> B -> A replacements. */
export function createStudioPendingAttachment(
  proposal: StudioAttachmentProposal,
  basis: StudioAuthoredIdentity,
  serial: number,
): StudioPendingAttachment {
  const content = JSON.stringify([
    studioSceneInputKey(proposal.edit),
    proposal.choice,
  ]);
  return {
    ...proposal,
    basis: { ...basis },
    serial,
    content,
    key: JSON.stringify([
      basis.scopeKey,
      basis.epoch,
      basis.generation,
      serial,
      content,
    ]),
  };
}
