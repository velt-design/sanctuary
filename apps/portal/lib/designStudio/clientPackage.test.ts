import { expect, it } from "vitest";
import {
  studioPackageDefaultMessage,
  studioPackageFilename,
  parseStudioPackageDraft,
} from "./clientPackage";
it("produces actual readable paragraphs and safe filenames without damaging ordinary letters", () => {
  const message = studioPackageDefaultMessage("Garden project");
  expect(message).toContain("\n\n");
  expect(message).not.toContain("\\n");
  expect(message).toContain("your quote for Garden project");
  expect(message).not.toContain("design booklet");
  expect(studioPackageFilename("Garden view 01.png")).toBe(
    "Garden view 01.png",
  );
  expect(studioPackageFilename("Garden\u0001/view\\north — plan.png")).toBe(
    "Garden__view_north , plan.png",
  );
  const project = studioPackageDefaultMessage("Garden — north");
  expect(project).not.toContain("\u2014");
  expect(
    parseStudioPackageDraft({
      to: "qa@example.test",
      subject: "Quote",
      message,
      includeBooklet: true,
      renderFileIds: [],
      fileIds: [],
    }).message,
  ).toBe(message);
});
