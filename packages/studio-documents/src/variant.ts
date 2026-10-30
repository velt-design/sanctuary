import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import type {
  StudioClientDocumentSource,
  StudioDocumentPage,
} from "./contract";
import { studioDocumentPages } from "./contract";
import { renderStudioDocumentPage } from "./render";
import { fonts } from "./assets";
import { PAPER, INK, MUTED, text, titleBar, boundedText } from "./layout";
import { assertStudioRenderImage } from "./renderImage";

export const STUDIO_RENDER_VARIANT_VERSION =
  "studio-booklet-renders.v1" as const;
export const STUDIO_RENDER_MAX_COUNT = 8;
export type StudioRenderIdentity = {
  fileId: string;
  sha256: string;
  label: string;
  contentType: "image/png" | "image/jpeg";
};
export type StudioFrozenRender = StudioRenderIdentity & {
  contentBase64: string;
};
/** Exact immutable bytes, never a mutable image URL or current editor camera. */
export function parseStudioFrozenRenders(value: unknown): StudioFrozenRender[] {
  if (!Array.isArray(value) || value.length > STUDIO_RENDER_MAX_COUNT)
    throw Error("Invalid rendered views");
  const ids = new Set<string>();
  return value.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      Object.keys(row).sort().join(",") !==
        "contentBase64,contentType,fileId,label,sha256" ||
      typeof row.fileId !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(row.fileId) ||
      ids.has(row.fileId) ||
      !["image/png", "image/jpeg"].includes(row.contentType) ||
      typeof row.label !== "string" ||
      !row.label.trim() ||
      row.label.length > 120 ||
      typeof row.contentBase64 !== "string" ||
      row.contentBase64.length > 3 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(row.contentBase64) ||
      typeof row.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(row.sha256)
    )
      throw Error("Invalid rendered view");
    const bytes = Buffer.from(row.contentBase64, "base64");
    if (
      bytes.length > 2 * 1024 * 1024 ||
      bytes.toString("base64") !== row.contentBase64 ||
      createHash("sha256").update(bytes).digest("hex") !== row.sha256
    )
      throw Error("Rendered view changed");
    assertStudioRenderImage(bytes, row.contentType);
    ids.add(row.fileId);
    return row as StudioFrozenRender;
  });
}
/** The technical inventory is retained; selected images are complete final pages. */
export async function renderStudioVariantPage(
  source: StudioClientDocumentSource,
  renders: StudioFrozenRender[],
  index: number,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const drawings = studioDocumentPages(source),
    total = drawings.length + renders.length;
  if (
    source.layoutVersion !== "studio-booklet-layout.v4" ||
    !drawings.length ||
    !renders.length ||
    total > 200
  )
    throw Error("Unsupported booklet variant");
  if (index < drawings.length)
    return renderStudioDocumentPage(source, index, signal, total);
  const render = renders[index - drawings.length];
  if (!render) throw Error("Invalid render page");
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([PAPER.width, PAPER.height]),
    f = await fonts(pdf);
  pdf.setTitle(`${source.projectName} - ${render.label}`);
  pdf.setAuthor("Sanctuary Pergolas");
  pdf.setSubject("Concept design / Not for construction");
  pdf.setCreationDate(new Date(source.issuedAt));
  pdf.setModificationDate(new Date(source.issuedAt));
  const image =
    render.contentType === "image/png"
      ? await pdf.embedPng(Buffer.from(render.contentBase64, "base64"))
      : await pdf.embedJpg(Buffer.from(render.contentBase64, "base64"));
  if (
    image.width > 8192 ||
    image.height > 8192 ||
    image.width * image.height > 16_777_216
  )
    throw Error("Rendered view exceeds supported dimensions");
  boundedText(page, source.projectName, 38, 30, 1114, 32, 20, f.semibold, INK);
  text(page, render.label, 38, 71, 11, f.medium);
  text(
    page,
    "CONCEPT VIEW / NOT FOR CONSTRUCTION",
    38,
    95,
    8,
    f.regular,
    MUTED,
  );
  const scale = Math.min(1114 / image.width, 620 / image.height),
    width = image.width * scale,
    height = image.height * scale;
  page.drawImage(image, {
    x: 38 + (1114 - width) / 2,
    y: PAPER.height - 126 - (620 - height) / 2 - height,
    width,
    height,
  });
  const sheet: StudioDocumentPage = {
    index,
    key: `render:${render.fileId}`,
    kind: "iso",
    label: render.label,
    code: `R${String(index - drawings.length + 1).padStart(2, "0")}`,
  };
  titleBar(page, source, sheet, total, f, "NTS @ A3");
  signal?.throwIfAborted();
  return pdf.save({ useObjectStreams: true });
}
