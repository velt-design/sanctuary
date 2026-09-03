// @vitest-environment node

import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  createProjectDesignBookletDraft,
  createToniDesignBookletDraft,
} from "./defaults";
import {
  DESIGN_BOOKLET_MAX_CONTENT_PAGES,
  DESIGN_BOOKLET_MAX_DRAWING_PAGE_TITLE_LENGTH,
  DESIGN_BOOKLET_MAX_DRAWING_REVISION_LENGTH,
  createDesignBookletImagePage,
} from "./pageModel";
import {
  DESIGN_BOOKLET_MAX_CUSTOM_TITLE_LENGTH,
  DESIGN_BOOKLET_MAX_IMAGE_BYTES,
  DesignBookletRequestError,
  loadToniDesignBookletImages,
  parseDesignBookletDraft,
  parseDesignBookletFormData,
} from "./request";
import {
  DESIGN_BOOKLET_DRAWING_LAYOUT_IDS,
  DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS,
  type DesignBookletDrawingPage,
  type DesignBookletImagePage,
} from "./types";

const VALID_PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlZ4S8AAAAASUVORK5CYII=",
    "base64",
  ),
);

function drawingPage(draft = createToniDesignBookletDraft()) {
  const page = draft.contentPages.find(
    (candidate): candidate is DesignBookletDrawingPage =>
      candidate.kind === "drawings",
  );
  if (!page) throw new Error("The Toni fixture must include a drawing page.");
  return page;
}

function imagePage(index: number): DesignBookletImagePage {
  const page = createDesignBookletImagePage([], {
    id: "render-1",
    alt: `Concept image ${index}`,
  });
  return {
    ...page,
    id: `content-${index}`,
    images: page.images.map((image, imageIndex) => ({
      ...image,
      assetId: `content-${index}-image-${imageIndex + 1}`,
    })) as DesignBookletImagePage["images"],
  };
}

function formDataForDraft(draft = createToniDesignBookletDraft()): FormData {
  const formData = new FormData();
  formData.set("draft", JSON.stringify(draft));
  return formData;
}

function pngFile(
  type = "image/png",
  bytes: Uint8Array = VALID_PNG_BYTES,
): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], "concept.png", { type });
}

describe("design booklet request parsing", () => {
  it("accepts A3 and treats a missing saved paper size as A4", () => {
    const a3Draft = createToniDesignBookletDraft();
    a3Draft.paperSize = "a3";
    expect(parseDesignBookletDraft(a3Draft).paperSize).toBe("a3");

    const legacyDraft = structuredClone(
      createToniDesignBookletDraft(),
    ) as Partial<ReturnType<typeof createToniDesignBookletDraft>>;
    delete legacyDraft.paperSize;
    expect(parseDesignBookletDraft(legacyDraft).paperSize).toBe("a4");
  });

  it("rejects an unknown paper size", () => {
    const draft = {
      ...createToniDesignBookletDraft(),
      paperSize: "letter",
    };

    expect(() => parseDesignBookletDraft(draft)).toThrow(/paper size/i);
  });

  it("strictly parses and normalizes a mixed dynamic draft", () => {
    const draft = createToniDesignBookletDraft();
    draft.customerName = "  Toni   Morgan  ";
    draft.projectTitle = "  Pool   room\r\n concept ";
    draft.contentPages = [
      draft.contentPages[2]!,
      draft.contentPages[0]!,
      draft.contentPages[1]!,
    ];
    drawingPage(draft).drawings[0].title = {
      kind: "custom",
      value: "  Roof plan  ",
    };

    const parsed = parseDesignBookletDraft(draft);

    expect(parsed.customerName).toBe("Toni Morgan");
    expect(parsed.projectTitle).toBe("Pool room\nconcept");
    expect(parsed.contentPages.map((page) => page.id)).toEqual([
      "drawing-page-1",
      "image-page-1",
      "image-page-2",
    ]);
    expect(drawingPage(parsed).drawings[0].title).toEqual({
      kind: "custom",
      value: "Roof plan",
    });
  });

  it("accepts the two-page minimum with no optional content", () => {
    const draft = createToniDesignBookletDraft();
    draft.contentPages = [];

    expect(parseDesignBookletDraft(draft).contentPages).toEqual([]);
  });

  it("rejects unsupported schemas and page types instead of falling back", () => {
    const unsupportedVersion = {
      ...createToniDesignBookletDraft(),
      schemaVersion: 1,
    };
    const unsupportedPage = structuredClone(
      createToniDesignBookletDraft(),
    ) as unknown as {
      contentPages: Array<Record<string, unknown>>;
    };
    unsupportedPage.contentPages[0]!.kind = "marketing";

    expect(() => parseDesignBookletDraft(unsupportedVersion)).toThrow(
      /version is unsupported/i,
    );
    expect(() => parseDesignBookletDraft(unsupportedPage)).toThrow(
      /invalid page type/i,
    );
  });

  it("rejects duplicate identifiers across pages, drawings, and assets", () => {
    const duplicatePageId = createToniDesignBookletDraft();
    duplicatePageId.contentPages[0]!.id = duplicatePageId.cover.assetId;
    const duplicateDrawingId = createToniDesignBookletDraft();
    drawingPage(duplicateDrawingId).drawings[0].id =
      duplicateDrawingId.contentPages[0]!.id;

    expect(() => parseDesignBookletDraft(duplicatePageId)).toThrow(
      /identifier is duplicated/i,
    );
    expect(() => parseDesignBookletDraft(duplicateDrawingId)).toThrow(
      /identifier is duplicated/i,
    );
  });

  it("accepts the content-page limit and rejects one page beyond it", () => {
    const atLimit = createToniDesignBookletDraft();
    atLimit.contentPages = Array.from(
      { length: DESIGN_BOOKLET_MAX_CONTENT_PAGES },
      (_, index) => imagePage(index + 1),
    );
    const overLimit = structuredClone(atLimit);
    overLimit.contentPages.push(
      imagePage(DESIGN_BOOKLET_MAX_CONTENT_PAGES + 1),
    );

    expect(parseDesignBookletDraft(atLimit).contentPages).toHaveLength(
      DESIGN_BOOKLET_MAX_CONTENT_PAGES,
    );
    expect(() => parseDesignBookletDraft(overLimit)).toThrow(
      new RegExp(`up to ${DESIGN_BOOKLET_MAX_CONTENT_PAGES}`, "i"),
    );
  });

  it.each(DESIGN_BOOKLET_DRAWING_LAYOUT_IDS)(
    "accepts the %s drawing layout",
    (layout) => {
      const draft = createToniDesignBookletDraft();
      drawingPage(draft).layout = layout;

      expect(drawingPage(parseDesignBookletDraft(draft)).layout).toBe(layout);
    },
  );

  it.each(DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS)(
    "accepts the %s drawing title preset",
    (value) => {
      const draft = createToniDesignBookletDraft();
      drawingPage(draft).drawings[0].title = { kind: "preset", value };

      expect(
        drawingPage(parseDesignBookletDraft(draft)).drawings[0].title,
      ).toEqual({ kind: "preset", value });
    },
  );

  it("normalizes saved drawing pages created before title-block metadata", () => {
    const legacyDraft = structuredClone(
      createToniDesignBookletDraft(),
    ) as unknown as {
      contentPages: Array<Record<string, unknown>>;
    };
    const legacyDrawingPage = legacyDraft.contentPages[2]!;
    delete legacyDrawingPage.pageTitle;
    delete legacyDrawingPage.revision;
    delete legacyDrawingPage.issueDate;

    const parsed = parseDesignBookletDraft(legacyDraft);
    expect(drawingPage(parsed)).toMatchObject({
      pageTitle: "CONCEPT DRAWINGS",
      revision: "01",
    });
    expect(drawingPage(parsed).issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("normalizes legacy single-image pages into reusable template slots", () => {
    const legacyDraft = structuredClone(
      createToniDesignBookletDraft(),
    ) as unknown as {
      contentPages: Array<Record<string, unknown>>;
    };
    const currentPage = legacyDraft.contentPages[0]!;
    const images = currentPage.images as Array<Record<string, unknown>>;
    legacyDraft.contentPages[0] = {
      id: currentPage.id,
      kind: "image",
      image: images[0],
    };

    const parsed = parseDesignBookletDraft(legacyDraft);
    const page = parsed.contentPages[0];
    expect(page?.kind).toBe("image");
    if (!page || page.kind !== "image") return;
    expect(page.layout).toBe("visual-full-bleed");
    expect(page.variant).toBe("edge");
    expect(page.images).toHaveLength(4);
    expect(page.images[0].assetId).toBe("image-page-1-image");
    expect(page.images.slice(1).map((image) => image.useDefaultAsset)).toEqual([
      false,
      false,
      false,
    ]);
    expect(page.content).toMatchObject({
      headline: "",
      body: "",
      headlineSize: "standard",
      bodySize: "standard",
      headlineScale: 100,
      bodyScale: 100,
      eyebrowScale: 100,
      captionScale: 100,
    });
  });

  it("normalizes saved content pages created before variants and scale controls", () => {
    const legacyDraft = structuredClone(
      createToniDesignBookletDraft(),
    ) as unknown as {
      contentPages: Array<Record<string, unknown>>;
    };
    const page = legacyDraft.contentPages[0]!;
    delete page.variant;
    const content = page.content as Record<string, unknown>;
    delete content.headlineScale;
    delete content.bodyScale;
    delete content.eyebrowScale;
    delete content.captionScale;

    const parsed = parseDesignBookletDraft(legacyDraft);
    const parsedPage = parsed.contentPages[0];
    expect(parsedPage?.kind).toBe("image");
    if (!parsedPage || parsedPage.kind !== "image") return;
    expect(parsedPage.variant).toBe("edge");
    expect(parsedPage.content).toMatchObject({
      headlineScale: 100,
      bodyScale: 100,
      eyebrowScale: 100,
      captionScale: 100,
    });
  });

  it.each([
    ["variant", "freeform", /invalid content variant/i],
    ["headlineScale", 401, /headline scale/i],
    ["bodyScale", 176, /body scale/i],
    ["eyebrowScale", 151, /eyebrow scale/i],
    ["captionScale", 79, /caption scale/i],
  ] as const)("rejects invalid content %s values", (field, value, error) => {
    const invalidDraft = structuredClone(
      createToniDesignBookletDraft(),
    ) as unknown as {
      contentPages: Array<Record<string, unknown>>;
    };
    const page = invalidDraft.contentPages[0]!;
    if (field === "variant") {
      page.variant = value;
    } else {
      (page.content as Record<string, unknown>)[field] = value;
    }
    expect(() => parseDesignBookletDraft(invalidDraft)).toThrow(error);
  });

  it("normalizes persisted drawing sheet titles to uppercase", () => {
    const draft = createToniDesignBookletDraft();
    drawingPage(draft).pageTitle = "Roof framing plan";

    expect(drawingPage(parseDesignBookletDraft(draft)).pageTitle).toBe(
      "ROOF FRAMING PLAN",
    );
  });

  it.each([
    ["pageTitle", " ", /title is required/i],
    [
      "pageTitle",
      "x".repeat(DESIGN_BOOKLET_MAX_DRAWING_PAGE_TITLE_LENGTH + 1),
      new RegExp(
        `${DESIGN_BOOKLET_MAX_DRAWING_PAGE_TITLE_LENGTH} characters or fewer`,
        "i",
      ),
    ],
    ["revision", " ", /revision is required/i],
    [
      "revision",
      "x".repeat(DESIGN_BOOKLET_MAX_DRAWING_REVISION_LENGTH + 1),
      new RegExp(
        `${DESIGN_BOOKLET_MAX_DRAWING_REVISION_LENGTH} characters or fewer`,
        "i",
      ),
    ],
    ["issueDate", "04/08/2026", /must use YYYY-MM-DD/i],
    ["issueDate", "2026-02-31", /must use YYYY-MM-DD/i],
  ] as const)(
    "rejects invalid drawing-page %s metadata",
    (key, value, error) => {
      const draft = createToniDesignBookletDraft();
      Object.assign(drawingPage(draft), { [key]: value });
      expect(() => parseDesignBookletDraft(draft)).toThrow(error);
    },
  );

  it("rejects an invalid drawing layout and the wrong reusable slot count", () => {
    const invalidLayout = structuredClone(
      createToniDesignBookletDraft(),
    ) as unknown as {
      contentPages: Array<Record<string, unknown>>;
    };
    const layoutPage = invalidLayout.contentPages[2]!;
    layoutPage.layout = "freeform";

    const missingSlot = structuredClone(
      createToniDesignBookletDraft(),
    ) as unknown as {
      contentPages: Array<Record<string, unknown>>;
    };
    const slotPage = missingSlot.contentPages[2]!;
    slotPage.drawings = (slotPage.drawings as unknown[]).slice(0, 3);

    expect(() => parseDesignBookletDraft(invalidLayout)).toThrow(
      /invalid drawing layout/i,
    );
    expect(() => parseDesignBookletDraft(missingSlot)).toThrow(
      /four reusable drawing slots/i,
    );
  });

  it.each([
    ["   ", /custom title is required/i],
    [
      "x".repeat(DESIGN_BOOKLET_MAX_CUSTOM_TITLE_LENGTH + 1),
      new RegExp(
        `${DESIGN_BOOKLET_MAX_CUSTOM_TITLE_LENGTH} characters or fewer`,
        "i",
      ),
    ],
  ] as const)("rejects an invalid custom drawing title", (value, message) => {
    const draft = createToniDesignBookletDraft();
    drawingPage(draft).drawings[0].title = { kind: "custom", value };

    expect(() => parseDesignBookletDraft(draft)).toThrow(message);
  });

  it("loads the default image for every renderable Toni asset", async () => {
    const draft = createToniDesignBookletDraft();
    const images = await loadToniDesignBookletImages(draft);

    expect(Object.keys(images).sort()).toEqual([
      "cover-image",
      "drawing-page-1-drawing-1",
      "image-page-1-image",
      "image-page-2-image",
      "review-image",
    ]);
    for (const image of Object.values(images)) {
      expect(image.mediaType).toBe("image/png");
      expect(Array.from(image.bytes.slice(0, 8))).toEqual([
        137, 80, 78, 71, 13, 10, 26, 10,
      ]);
    }
  });

  it("accepts empty project slots without loading Toni images", async () => {
    const draft = createProjectDesignBookletDraft("Client AAA");
    const parsed = await parseDesignBookletFormData(formDataForDraft(draft));

    expect(parsed.draft.cover.useDefaultAsset).toBe(false);
    expect(parsed.images).toEqual({});
  });

  it("accepts an original drawing PDF and validates its selected page metadata", async () => {
    const source = await PDFDocument.create();
    source.addPage([842, 595]);
    source.addPage([595, 842]);
    const sourceBytes = await source.save({ useObjectStreams: false });
    const draft = createProjectDesignBookletDraft("Client AAA");
    const drawingPage = draft.contentPages.find(
      (page) => page.kind === "drawings",
    );
    if (!drawingPage || drawingPage.kind !== "drawings") {
      throw new Error("Expected a drawing page.");
    }
    drawingPage.drawings[0].pdf = {
      assetId: "drawing-page-1-drawing-1-pdf",
      fileName: "architectural-package.pdf",
      pageNumber: 2,
      pageCount: 2,
    };
    const formData = formDataForDraft(draft);
    formData.set(
      "asset:drawing-page-1-drawing-1-pdf",
      new File(
        [Uint8Array.from(sourceBytes).buffer],
        "architectural-package.pdf",
        {
          type: "application/pdf",
        },
      ),
    );

    const parsed = await parseDesignBookletFormData(formData);

    const parsedDrawingPage = parsed.draft.contentPages.find(
      (page) => page.kind === "drawings",
    );
    expect(parsedDrawingPage?.kind).toBe("drawings");
    if (!parsedDrawingPage || parsedDrawingPage.kind !== "drawings") {
      throw new Error("Expected a parsed drawing page.");
    }
    expect(parsedDrawingPage.drawings[0].pdf).toMatchObject({
      assetId: "drawing-page-1-drawing-1-pdf",
      pageNumber: 2,
      pageCount: 2,
    });
    expect(
      parsed.documents["drawing-page-1-drawing-1-pdf"]?.bytes.slice(0, 5),
    ).toEqual(sourceBytes.slice(0, 5));
  });

  it("accepts a valid uploaded PNG and preserves its bytes", async () => {
    const draft = createToniDesignBookletDraft();
    draft.contentPages = [];
    const formData = formDataForDraft(draft);
    formData.set("asset:cover-image", pngFile());

    const parsed = await parseDesignBookletFormData(formData);

    expect(parsed.draft.contentPages).toEqual([]);
    expect(parsed.images["cover-image"]).toEqual({
      bytes: VALID_PNG_BYTES,
      mediaType: "image/png",
    });
    expect(parsed.images["review-image"]?.bytes.byteLength).toBeGreaterThan(0);
  });

  it("normalizes EXIF orientation before an uploaded image reaches the PDF", async () => {
    const draft = createToniDesignBookletDraft();
    draft.contentPages = [];
    const orientedJpeg = await sharp({
      create: {
        width: 40,
        height: 20,
        channels: 3,
        background: "#b84a32",
      },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    expect((await sharp(orientedJpeg).metadata()).orientation).toBe(6);

    const formData = formDataForDraft(draft);
    formData.set(
      "asset:cover-image",
      new File([orientedJpeg], "oriented-concept.jpg", {
        type: "image/jpeg",
      }),
    );

    const parsed = await parseDesignBookletFormData(formData);
    const normalized = parsed.images["cover-image"];
    if (!normalized) throw new Error("The normalized cover image is missing.");
    expect(normalized.mediaType).toBe("image/jpeg");
    const normalizedMetadata = await sharp(normalized.bytes).metadata();
    expect(normalizedMetadata).toMatchObject({
      format: "jpeg",
      width: 20,
      height: 40,
    });
    expect(normalizedMetadata.orientation).toBeUndefined();
  });

  it("rejects unsupported MIME types before image decoding", async () => {
    const draft = createToniDesignBookletDraft();
    draft.contentPages = [];
    const formData = formDataForDraft(draft);
    formData.set("asset:cover-image", pngFile("image/svg+xml"));

    await expect(parseDesignBookletFormData(formData)).rejects.toBeInstanceOf(
      DesignBookletRequestError,
    );
    await expect(parseDesignBookletFormData(formData)).rejects.toThrow(
      /PNG or JPEG/i,
    );
  });

  it("rejects unreadable and mismatched image signatures", async () => {
    const draft = createToniDesignBookletDraft();
    draft.contentPages = [];
    const unreadable = formDataForDraft(draft);
    unreadable.set(
      "asset:cover-image",
      new File(["not an image"], "concept.png", { type: "image/png" }),
    );
    const mismatched = formDataForDraft(draft);
    mismatched.set("asset:cover-image", pngFile("image/jpeg"));

    await expect(parseDesignBookletFormData(unreadable)).rejects.toThrow(
      /not a readable PNG or JPEG/i,
    );
    await expect(parseDesignBookletFormData(mismatched)).rejects.toThrow(
      /does not match its file type/i,
    );
  });

  it("rejects a single image above the upload limit with status 413", async () => {
    const draft = createToniDesignBookletDraft();
    draft.contentPages = [];
    const formData = formDataForDraft(draft);
    formData.set(
      "asset:cover-image",
      new File(
        [new Uint8Array(DESIGN_BOOKLET_MAX_IMAGE_BYTES + 1).buffer],
        "oversized.png",
        { type: "image/png" },
      ),
    );

    await expect(parseDesignBookletFormData(formData)).rejects.toMatchObject({
      status: 413,
    });
  });

  it("rejects duplicate, unused, and string-based asset entries", async () => {
    const draft = createToniDesignBookletDraft();
    draft.contentPages = [];

    const duplicate = formDataForDraft(draft);
    duplicate.append("asset:cover-image", pngFile());
    duplicate.append("asset:cover-image", pngFile());

    const unused = formDataForDraft(draft);
    unused.set("asset:unused-image", pngFile());

    const remote = formDataForDraft(draft);
    remote.set("asset:cover-image", "https://example.com/concept.png");

    await expect(parseDesignBookletFormData(duplicate)).rejects.toThrow(
      /uploaded more than once/i,
    );
    await expect(parseDesignBookletFormData(unused)).rejects.toThrow(
      /not used by this booklet/i,
    );
    await expect(parseDesignBookletFormData(remote)).rejects.toThrow(
      /uploaded image data is invalid/i,
    );
  });
});
