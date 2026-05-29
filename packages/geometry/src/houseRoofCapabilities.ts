export * from './houseRoofValidation';

export type HouseGableTerminalEnd = {
  id: string;
  sourceEdgeId: string;
  label: string;
};

export { deriveHouseGableTerminalEndsFromFootprint as deriveHouseGableTerminalEnds } from './houseModel';
// PR-T8 (2026-05-29): appendage re-exports removed alongside the
// appendage feature cull.
