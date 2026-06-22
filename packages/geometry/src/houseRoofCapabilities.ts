export {
  HOUSE_ROOF_FORM_ORDER,
  MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG,
  deriveHouseRoofCapabilities,
  deriveHouseRoofGeometryKind,
  getHouseRoofFormBehavior,
  houseRoofFormUsesMinimumVisiblePitch,
  isHouseRoofForm,
  normalizeHouseRoofPitchInputForForm,
  preferredMonoFallDirectionForAttachmentSide,
  validateHouseRoofSelection,
} from './houseRoofValidation';

export { deriveHouseGableTerminalEndsFromFootprint as deriveHouseGableTerminalEnds } from './house/roofJoined';
// PR-T8 (2026-05-29): appendage re-exports removed alongside the
// appendage feature cull.
