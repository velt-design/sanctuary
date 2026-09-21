import { describe, expect, it } from "vitest";
import { products } from "../../data/products";
import { buildProductHubViewModel } from "./productHubViewModel";

describe("buildProductHubViewModel", () => {
  it("presents the three configurable forms without removing the canonical Hip route", () => {
    const model = buildProductHubViewModel();

    expect(model.pergolaForms.map((product) => product.slug)).toEqual([
      "pitched",
      "gable",
      "box-perimeter",
    ]);
    expect(model.comparisonRows).toHaveLength(3);
    expect(model.canonicalProductRoutes).toContain('/products/pergolas/hip');
    expect(
      model.comparisonRows.every(
        (row) => row.geometry && row.usefulWhen && row.constraint,
      ),
    ).toBe(true);
  });

  it("groups six integrated products into two secondary gateways", () => {
    const model = buildProductHubViewModel();

    expect(model.optionGateways.map(({ category }) => category.slug)).toEqual([
      "screens-walls",
      "lighting-heating",
    ]);
    expect(
      model.optionGateways.map(({ products: items }) => items.length),
    ).toEqual([3, 3]);
  });

  it("preserves every canonical product route and keeps one project story", () => {
    const model = buildProductHubViewModel();

    expect([...model.canonicalProductRoutes].sort()).toEqual(
      products.map((product) => product.route).sort(),
    );
    expect(model.projectStories.map((project) => project.slug)).toEqual([
      "warkworth-outdoor-room",
    ]);
    expect(model.guideLinks).toHaveLength(1);
  });
});
