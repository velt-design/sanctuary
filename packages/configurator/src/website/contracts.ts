import type { CustomerAcrylicTintV1 } from "../core";
/** Submitted website choices, not surveyed geometry or a pricing contract. */
export type WebsiteSubmittedDesignV1 = {
  version: 1;
  input: {
    widthMm: number;
    projectionMm: number;
    level: "ground" | "elevated";
    connection: "fascia" | "facade" | "soffit";
  };
  roof: {
    acrylicTint?: CustomerAcrylicTintV1;
    frameFinish?: 'black' | 'white';
    family: "mono" | "gable" | "box";
    orientation: "parallel" | "away";
    infills: boolean;
    attachmentIntent?: "freestanding" | "unsure";
    finish?: {
      ceiling?: "cedar-100" | "cedar-150" | "thermopine-100" | "thermopine-150";
      material: "acrylic" | "solid" | "combination";
      layout: "central" | "house";
      profile: "corrugated" | "trapezoidal" | "tray";
      acrylicBays: number;
      trayWidth: 300 | 400 | 500;
    };
    blinds?: {
      opening: string;
      fabric: string;
      colour: string;
      cover: "NONE" | "FLASHING" | "PELMET";
      lowered: number;
      infill: boolean;
    }[];
    sidePanels?: {
      species?: "cedar" | "thermopine";
      opening: string;
      kind: "acrylic" | "timber" | "aluminium";
      profile: string;
      edge: boolean;
      gap: number;
      customGap: boolean;
      frame: 50 | 100;
      battens: boolean;
      direction?: "horizontal" | "vertical";
    }[];
    roofBattens?: {
      species?: "cedar" | "thermopine";
      profile: "39x39" | "65x39" | "90x39";
      edge: boolean;
      gap: number;
      customGap: boolean;
    };
    lighting?: {
      cedarPerSection?: number;
      cedarIndividual?: boolean;
      cedarOverrides?: Record<
        string,
        { count: number; pattern: "rows2" | "rows3" }
      >;
      cedarPattern?: "rows2" | "rows3";
      rafterAmount?: "off" | "low" | "medium" | "high";
      rafterCount: number;
      cedarCount: number;
      rafterLayout: "even" | "central" | "perimeter";
      cedarLayout: "even" | "central" | "perimeter";
      strips: string[];
    };
  };
};
