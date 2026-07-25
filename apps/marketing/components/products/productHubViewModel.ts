import {
  getProductsByCategory,
  productCategories,
  products,
  type ProductRecord,
} from "../../data/products";
import { projects } from "../../data/projects";

const comparisonBySlug: Partial<
  Record<
    ProductRecord["slug"],
    { geometry: string; usefulWhen: string; constraint: string }
  >
> = {
  pitched: {
    geometry: "One roof plane",
    usefulWhen:
      "Height is tighter or the new roof should sit quietly beside the house.",
    constraint: "High edge, low edge, fall and discharge must work together.",
  },
  gable: {
    geometry: "Two planes and a ridge",
    usefulWhen:
      "The deck benefits from height, symmetry and a pavilion-like room.",
    constraint:
      "Ridge height and gable ends make the roof more visually present.",
  },
  hip: {
    geometry: "Several planes and hips",
    usefulWhen: "The room is seen from several sides or responds to corners.",
    constraint: "More roof junctions and drainage directions need resolution.",
  },
  "box-perimeter": {
    geometry: "Level outer frame",
    usefulWhen:
      "A crisp horizontal line suits a contemporary house or outlook.",
    constraint:
      "The perimeter must contain structure, roof fall and drainage access.",
  },
};

const productHubGuideLinks = [
  {
    href: "/pergola-cost-auckland",
    label: "Pergola cost and scope",
    copy: "Understand the inputs that change scope before comparing proposals.",
  },
  {
    href: "/custom-pergolas-auckland",
    label: "Why custom design matters",
    copy: "See how the house connection, measured levels and priorities shape the result.",
  },
  {
    href: "/pergolas-with-blinds",
    label: "Planning screens and blinds",
    copy: "Compare fixed and deployable edges before deciding how open the room should feel.",
  },
] as const;

export function buildProductHubViewModel() {
  const pergolaForms = getProductsByCategory("pergolas");
  const comparisonRows = pergolaForms.map((product) => {
    const comparison = comparisonBySlug[product.slug];
    if (!comparison) {
      throw new Error(`Missing product-hub comparison for ${product.slug}`);
    }

    return { product, ...comparison };
  });
  const optionGateways = productCategories.slice(1).map((category) => ({
    category,
    products: getProductsByCategory(category.slug),
  }));
  const projectStories = ["warkworth-outdoor-room", "muriwai-courtyard"].map(
    (slug) => {
      const project = projects.find((candidate) => candidate.slug === slug);
      if (!project) {
        throw new Error(`Missing product-hub project story for ${slug}`);
      }
      return project;
    },
  );

  return {
    pergolaForms,
    comparisonRows,
    optionGateways,
    projectStories,
    guideLinks: productHubGuideLinks,
    canonicalProductRoutes: products.map((product) => product.route),
  };
}
