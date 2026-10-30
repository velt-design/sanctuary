import type { StudioHouseConnectionChoice } from "./studioHouseScene";

export type StudioAttachmentChoice = StudioHouseConnectionChoice;
/** Retain the chosen physical side and tangential world anchor. The new method
 * alone owns normal contact and height. Out-of-span positions remain refusals. */
export { previewStudioAttachmentAtAnchor } from "./studioHouseCommands";
