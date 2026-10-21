import type {
  ObjectFirstHouseAssemblyDraft,
  ObjectFirstHouseFormDraft,
} from "./objectFirstWorkbenchModel";
import { buildDefaultRectangleComposition } from "./houseFormCompositionAdapter";

export function buildDefaultHouseAssemblyDraft(): ObjectFirstHouseAssemblyDraft {
  return {
    id: "assembly-main",
    label: "House Assembly",
    houseForms: [],
  };
}

export function buildDefaultHouseFormDraft(input: {
  id: string;
  label: string;
  transform?: Partial<ObjectFirstHouseFormDraft["transform"]>;
}): ObjectFirstHouseFormDraft {
  const roofIntent = {
    form: "hipped" as const,
    primaryPitchDeg: "5",
    primaryFallDirection: "negative_y" as const,
    ridgeAxis: "x" as const,
    openGableEndIds: [] as string[],
  };
  return {
    id: input.id,
    label: input.label,
    transform: {
      offsetXM: 0,
      offsetYM: 0,
      rotationQuarterTurns: 0,
      ...input.transform,
    },
    composition: buildDefaultRectangleComposition(roofIntent),
    attachmentSide: "rear",
    roofIntent,
    storeyMode: "single_storey",
    attachmentStrategy: null,
  };
}
