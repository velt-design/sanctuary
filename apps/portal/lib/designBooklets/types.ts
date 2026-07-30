export const DESIGN_BOOKLET_ROOF_FORM_IDS = [
  "pitched",
  "gable",
  "hip",
  "box-perimeter",
] as const;

export const DESIGN_BOOKLET_MATERIAL_IDS = [
  "acrylic",
  "solid-lined",
  "combination",
] as const;

export const DESIGN_BOOKLET_RENDER_IDS = [
  "render-1",
  "render-2",
  "render-3",
] as const;

export type DesignBookletRoofFormId =
  (typeof DESIGN_BOOKLET_ROOF_FORM_IDS)[number];
export type DesignBookletMaterialId =
  (typeof DESIGN_BOOKLET_MATERIAL_IDS)[number];
export type DesignBookletRenderId = (typeof DESIGN_BOOKLET_RENDER_IDS)[number];
export type DesignBookletAssetId = DesignBookletRenderId | "plan";

export type DesignBookletContentCatalog = {
  roofForms: Record<
    DesignBookletRoofFormId,
    {
      id: DesignBookletRoofFormId;
      name: string;
      shortName: string;
      proposition: string;
      outcomeHeading: string;
      outcomeCopy: string;
      worksWhen: string[];
      resolve: string[];
      tradeoffs: Array<{ tension: string; guidance: string }>;
    }
  >;
  materials: Record<
    DesignBookletMaterialId,
    {
      id: DesignBookletMaterialId;
      label: string;
      summary: string;
      supporting: string[];
      sections: Array<{
        id: "acrylic" | "solid-lined";
        label: string;
        summary: string;
      }>;
    }
  >;
};

export type DesignBookletDraft = {
  customerName: string;
  projectTitle: string;
  roofFormId: DesignBookletRoofFormId;
  materialId: DesignBookletMaterialId;
  renderOrder: DesignBookletRenderId[];
};

export type DesignBookletImage = {
  bytes: Uint8Array;
  mediaType: "image/png" | "image/jpeg";
};

export type DesignBookletImages = Record<
  DesignBookletAssetId,
  DesignBookletImage
>;
