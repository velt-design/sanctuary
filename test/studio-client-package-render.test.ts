// @vitest-environment node
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { approvedDrawingSource } from "./fixtures/studio-approved-drawings";
import { approvedStudioDocumentPages } from "../packages/studio-documents/src/contract";
import { encodeRgbPng } from "../packages/studio-documents/src/png";
import {
  parseStudioFrozenRenders,
  renderStudioVariantPage,
} from "../packages/studio-documents/src/variant";
import { assertStudioRenderImage } from "../packages/studio-documents/src/renderImage";
it("renders a selected immutable image as a full A3 page after the unchanged technical inventory with matching footer", async () => {
  const source = {
    ...approvedDrawingSource(),
    layoutVersion: "studio-booklet-layout.v4" as const,
  };
  source.pageManifest = approvedStudioDocumentPages(source);
  const before = JSON.stringify(source);
  const bytes = await encodeRgbPng(
    400,
    200,
    new Uint8Array(400 * 200 * 3).fill(170),
  );
  const renders = parseStudioFrozenRenders([
    {
      fileId: "10000000-0000-4000-8000-000000000001",
      label: "Garden perspective",
      contentType: "image/png",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      contentBase64: bytes.toString("base64"),
    },
  ]);
  const output = await renderStudioVariantPage(source, renders, 13),
    pdf = await PDFDocument.load(output);
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getSize()).toMatchObject({
    width: 1190.551,
    height: 841.89,
  });
  expect(JSON.stringify(source)).toBe(before);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"),
    doc = await pdfjs.getDocument({ data: output }).promise;
  const content = await (await doc.getPage(1)).getTextContent(),
    text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
  expect(text).toContain("Garden perspective");
  expect(text).toContain("14 / 14");
  expect(text).toContain("R01");
  expect(text).toContain("SANCTUARY PERGOLAS");
  expect(text).not.toContain("DRAWING REGISTER");
  await doc.destroy();
});
it("refuses changed bytes, duplicate identity, fake formats and oversized headers before raster decode", async () => {
  const png = await encodeRgbPng(1, 1, new Uint8Array([1, 2, 3])),
    identity = {
      fileId: "10000000-0000-4000-8000-000000000001",
      label: "View",
      contentType: "image/png",
      sha256: createHash("sha256").update(png).digest("hex"),
      contentBase64: png.toString("base64"),
    };
  expect(() =>
    parseStudioFrozenRenders([{ ...identity, sha256: "a".repeat(64) }]),
  ).toThrow("changed");
  expect(() => parseStudioFrozenRenders([identity, identity])).toThrow(
    "Invalid",
  );
  const huge = Buffer.from(png);
  huge.writeUInt32BE(100000, 16);
  expect(() => assertStudioRenderImage(huge, "image/png")).toThrow(
    "16 megapixels",
  );
  expect(() =>
    assertStudioRenderImage(Buffer.from("not image"), "image/png"),
  ).toThrow("Invalid");
});
