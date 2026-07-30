import "server-only";

import { getMarketingDesignBookletContent } from "../../../marketing/lib/designBookletContent";
import type { DesignBookletContentCatalog } from "./types";

/**
 * Narrow server-only adapter. Marketing remains the owner of every generic
 * roof-form and roofing-choice sentence used by the booklet.
 */
export function getDesignBookletContentCatalog(): DesignBookletContentCatalog {
  const marketingContent = getMarketingDesignBookletContent();
  return {
    roofForms: Object.fromEntries(
      Object.entries(marketingContent.roofForms).map(([id, roofForm]) => [
        id,
        {
          id: roofForm.id,
          name: roofForm.name,
          shortName: roofForm.shortName,
        },
      ]),
    ) as DesignBookletContentCatalog["roofForms"],
    materials: Object.fromEntries(
      Object.entries(marketingContent.materials).map(([id, material]) => [
        id,
        {
          id: material.id,
          label: material.label,
        },
      ]),
    ) as DesignBookletContentCatalog["materials"],
  };
}
