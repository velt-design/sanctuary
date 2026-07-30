import { getProductBySlug } from "../data/products";
import { generalRoofPreference } from "../app/pergolas-auckland/content";

const designBookletRoofFormIds = [
  "pitched",
  "gable",
  "hip",
  "box-perimeter",
] as const;

const designBookletMaterialIds = [
  "acrylic",
  "solid-lined",
  "combination",
] as const;

type RoofFormId = (typeof designBookletRoofFormIds)[number];
type MaterialId = (typeof designBookletMaterialIds)[number];

type MarketingDesignBookletContent = {
  roofForms: Record<
    RoofFormId,
    {
      id: RoofFormId;
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
    MaterialId,
    {
      id: MaterialId;
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

function requireProduct(slug: RoofFormId) {
  const product = getProductBySlug(slug);
  if (!product) throw new Error(`Missing governed marketing product: ${slug}`);
  return product;
}

function requirePrefixed(
  items: readonly string[] | undefined,
  prefix: string,
): string {
  const match = items?.find((item) => item.startsWith(prefix));
  if (!match)
    throw new Error(`Missing governed marketing copy beginning "${prefix}"`);
  return match;
}

function requireRoofPreferenceLabel(materialId: MaterialId): string {
  const option = generalRoofPreference.options.find((candidate) => {
    if (materialId === "acrylic") {
      return (
        candidate.roofMaterials.length === 1 &&
        candidate.roofMaterials[0] === "acrylic"
      );
    }
    if (materialId === "solid-lined") {
      return (
        candidate.roofMaterials.length === 1 &&
        candidate.roofMaterials[0] === "timber"
      );
    }
    return candidate.roofMaterials.length === 2;
  });
  if (!option)
    throw new Error(`Missing governed roof-preference label: ${materialId}`);
  return option.label;
}

function stripOptionPrefix(value: string): string {
  const separator = value.indexOf(":");
  const stripped =
    separator === -1 ? value.trim() : value.slice(separator + 1).trim();
  return stripped
    ? `${stripped.charAt(0).toUpperCase()}${stripped.slice(1)}`
    : stripped;
}

/**
 * Read-only customer-document projection over the marketing product owner.
 *
 * The returned strings remain owned by the marketing website. This selector
 * deliberately contains no customer promises and does not paraphrase or
 * strengthen the governed source copy.
 */
export function getMarketingDesignBookletContent(): MarketingDesignBookletContent {
  const roofForms = Object.fromEntries(
    designBookletRoofFormIds.map((id) => {
      const product = requireProduct(id);
      return [
        id,
        {
          id,
          name: product.name,
          shortName: product.shortName,
          proposition: product.proposition,
          outcomeHeading: product.outcome.heading,
          outcomeCopy: product.outcome.copy,
          worksWhen: [...product.decision.worksWhen],
          resolve: [...product.decision.resolve],
          tradeoffs: product.tradeoffs.map((tradeoff) => ({ ...tradeoff })),
        },
      ];
    }),
  ) as MarketingDesignBookletContent["roofForms"];

  const pitched = requireProduct("pitched");
  const whyItsGood = Array.isArray(pitched.details.whyItsGood)
    ? pitched.details.whyItsGood
    : pitched.details.whyItsGood
      ? [pitched.details.whyItsGood]
      : [];
  const atAGlance = Array.isArray(pitched.details.atAGlance)
    ? pitched.details.atAGlance
    : pitched.details.atAGlance
      ? [pitched.details.atAGlance]
      : [];
  const acrylicSummary = stripOptionPrefix(
    requirePrefixed(pitched.details.options, "Acrylic:"),
  );
  const solidSummary = stripOptionPrefix(
    requirePrefixed(pitched.details.options, "Solid:"),
  );
  const solidRoofCharacter = requirePrefixed(
    pitched.details.performance,
    "Solid roof panels create",
  );

  return {
    roofForms,
    materials: {
      acrylic: {
        id: "acrylic",
        label: requireRoofPreferenceLabel("acrylic"),
        summary: acrylicSummary,
        supporting: [
          requirePrefixed(
            atAGlance,
            "Roofing options selected around daylight",
          ),
          requirePrefixed(atAGlance, "Acrylic roof zones can be considered"),
        ],
        sections: [
          {
            id: "acrylic",
            label: "Acrylic roof",
            summary: acrylicSummary,
          },
        ],
      },
      "solid-lined": {
        id: "solid-lined",
        label: requireRoofPreferenceLabel("solid-lined"),
        summary: solidSummary,
        supporting: [
          requirePrefixed(atAGlance, "Insulated panels with timber sarking"),
          requirePrefixed(whyItsGood, "Insulated panels with timber sarking"),
        ],
        sections: [
          {
            id: "solid-lined",
            label: "Solid roofing + timber ceiling",
            summary: solidRoofCharacter,
          },
        ],
      },
      combination: {
        id: "combination",
        label: requireRoofPreferenceLabel("combination"),
        summary: stripOptionPrefix(
          requirePrefixed(pitched.details.options, "Combination:"),
        ),
        supporting: [
          requirePrefixed(atAGlance, "Acrylic roof zones can be considered"),
          requirePrefixed(
            whyItsGood,
            "Acrylic and solid roof zones can be combined",
          ),
        ],
        sections: [
          {
            id: "acrylic",
            label: "Acrylic roof",
            summary: acrylicSummary,
          },
          {
            id: "solid-lined",
            label: "COLORSTEEL + timber ceiling",
            summary: solidRoofCharacter,
          },
        ],
      },
    },
  };
}
