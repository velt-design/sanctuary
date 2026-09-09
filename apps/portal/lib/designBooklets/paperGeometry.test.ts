import { describe, expect, it } from "vitest";
import {
  DESIGN_BOOKLET_BASE_PAGE_SIZE,
  DESIGN_BOOKLET_PAPER_SIZES,
  designBookletPageGeometry,
} from "./paperGeometry";

describe("design booklet paper geometry", () => {
  it("owns the exact landscape A4 and A3 PDF point dimensions", () => {
    expect(DESIGN_BOOKLET_PAPER_SIZES.a4).toMatchObject({
      width: 841.89,
      height: 595.28,
    });
    expect(DESIGN_BOOKLET_PAPER_SIZES.a3).toMatchObject({
      width: 1190.55,
      height: 841.89,
    });
  });

  it("uses A4 as the canonical design coordinate system and scales A3 from it", () => {
    const a4 = designBookletPageGeometry("a4");
    const a3 = designBookletPageGeometry("a3");

    expect(DESIGN_BOOKLET_BASE_PAGE_SIZE.id).toBe("a4");
    expect(a4.scaleX).toBe(1);
    expect(a4.scaleY).toBe(1);
    expect(a3.scaleX).toBeCloseTo(1190.55 / 841.89, 12);
    expect(a3.scaleY).toBeCloseTo(841.89 / 595.28, 12);
  });
});
