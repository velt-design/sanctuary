import { describe, expect, it } from "vitest";
import {
  DESIGN_BOOKLET_UPLOAD_MAX_DIMENSION,
  scaledImageSize,
} from "./imageCompression";

describe("design booklet image compression", () => {
  it("keeps smaller images at their native dimensions", () => {
    expect(scaledImageSize(2400, 1600)).toEqual({
      width: 2400,
      height: 1600,
    });
  });

  it("preserves aspect ratio while constraining oversized renders and plans", () => {
    expect(scaledImageSize(8000, 4000)).toEqual({
      width: DESIGN_BOOKLET_UPLOAD_MAX_DIMENSION,
      height: DESIGN_BOOKLET_UPLOAD_MAX_DIMENSION / 2,
    });
  });
});
