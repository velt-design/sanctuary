import { describe, expect, it } from "vitest";
import {
  continueDesignBookletBullet,
  designBookletEditorialTextWeight,
  parseDesignBookletEditorialText,
  toggleDesignBookletBullets,
} from "./editorialText";

describe("design booklet editorial text", () => {
  it("parses plain copy and consecutive lightweight bullet markers", () => {
    expect(
      parseDesignBookletEditorialText(
        "Opening line\n- Shade through summer\n\u2022 Shelter in winter\nClosing line",
      ),
    ).toEqual([
      { kind: "paragraph", text: "Opening line" },
      {
        kind: "bullets",
        items: ["Shade through summer", "Shelter in winter"],
      },
      { kind: "paragraph", text: "Closing line" },
    ]);
  });

  it("adds and removes one bullet level across selected lines", () => {
    const added = toggleDesignBookletBullets("Alpha\nBeta\nGamma", 0, 10);
    expect(added).toEqual({
      value: "- Alpha\n- Beta\nGamma",
      selectionStart: 0,
      selectionEnd: 14,
    });

    expect(
      toggleDesignBookletBullets(
        added.value,
        added.selectionStart,
        added.selectionEnd,
      ).value,
    ).toBe("Alpha\nBeta\nGamma");
  });

  it("applies bullets to a mixed selection without nesting existing items", () => {
    expect(toggleDesignBookletBullets("- Alpha\nBeta", 0, 12).value).toBe(
      "- Alpha\n- Beta",
    );
  });

  it("starts a bullet in an empty field and keeps the marker within limits", () => {
    expect(toggleDesignBookletBullets("", 0, 0, 2)).toEqual({
      value: "- ",
      selectionStart: 2,
      selectionEnd: 2,
    });
    expect(toggleDesignBookletBullets("A", 1, 1, 1).value).toBe("A");
  });

  it("continues a bullet with Enter and exits an empty bullet", () => {
    expect(continueDesignBookletBullet("- Alpha", 7, 7)).toEqual({
      value: "- Alpha\n- ",
      selectionStart: 10,
      selectionEnd: 10,
    });
    expect(continueDesignBookletBullet("- Alpha\n- ", 10, 10)).toEqual({
      value: "- Alpha\n",
      selectionStart: 8,
      selectionEnd: 8,
    });
  });

  it("continues a bullet when Enter replaces selected text", () => {
    expect(continueDesignBookletBullet("- Alpha", 2, 5)).toEqual({
      value: "- \n- ha",
      selectionStart: 5,
      selectionEnd: 5,
    });
  });

  it("weights bullet indentation in overflow estimates", () => {
    expect(designBookletEditorialTextWeight("Alpha\n- Beta")).toBe(
      "Alpha\n- Beta".length + 10,
    );
  });
});
