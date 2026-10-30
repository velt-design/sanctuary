import type { websiteComposition } from "../websiteComposition";
import type { StudioHouseConnectionChoice } from "../studioHouseScene";
import type { StudioHouseTarget } from "../studioHouseGeometry";
import type { WebsitePhysicalProduct } from "../websiteProductPhysical";

export type StudioPlacementMethod = "facade" | "fascia" | "soffit";
export type PlacementPoint = { x: number; y: number };
export type PlacementPose = PlacementPoint & { rotation: number };
export type PlacementRow = ReturnType<typeof websiteComposition>[number];
export type PlacementLine = {
  id: string;
  sourceObjectId: string;
  edgeKind: string;
  allowVertex?: boolean;
  departureKey?: string;
  label: string;
  start: PlacementPoint;
  end: PlacementPoint;
};
export type StudioPlacementCandidate = {
  key: string;
  target: StudioHouseTarget;
  choice: StudioHouseConnectionChoice;
  canonicalHost: NonNullable<
    NonNullable<PlacementRow["object"]["attachment"]>["host"]
  >;
  tangent: PlacementPoint;
  travel: number;
  pose: PlacementPose;
  height: number;
  points: PlacementPoint[];
  anchorPoints?: PlacementPoint[];
  physical: WebsitePhysicalProduct;
  incidentJoins: string[];
  consequences: string[];
  evaluateAlong?: (along: number) => StudioPlacementCandidate;
  unresolved?:
    | { kind: "preparing"; datum: number; reason: string }
    | { kind: "refused"; reason: string };
};

/** Current read data and physical proposals only. Authored edits belong to the
 * session and are constructed by its canonical command once at release. */
export type GestureCache = {
  id: string;
  method: StudioPlacementMethod;
  row: Readonly<PlacementRow>;
  bound: boolean;
  original: PlacementPoint[];
  freeOutline: PlacementPoint[];
  targets: StudioHouseTarget[];
  candidates: StudioPlacementCandidate[];
  lines: PlacementLine[];
  unavailable: string | null;
};

export type StudioPlacementReadiness =
  | { kind: "ready" }
  | { kind: "preparing"; reason: string }
  | { kind: "refused"; reason: string };
