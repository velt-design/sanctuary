export * from './houseRoofValidation';

export type HouseGableTerminalEnd = {
  id: string;
  sourceEdgeId: string;
  label: string;
};

export {
  deriveHouseGableTerminalEndsFromFootprint as deriveHouseGableTerminalEnds,
  deriveAllHouseGableTerminalEndsFromFootprint as deriveAllHouseGableTerminalEnds,
} from './houseModel';
export {
  deriveHouseRoofAppendageSupportFromFootprint as deriveHouseRoofAppendageSupport,
  type HouseRoofAppendageHostRun,
  type HouseRoofAppendageSupportAnalysis,
} from './houseModel';
