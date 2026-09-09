import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import { getMarketingDesignBookletContent } from "../../../../marketing/lib/designBookletContent";
import {
  createProjectDesignBookletDraft,
  createToniDesignBookletDraft,
} from "@/lib/designBooklets/defaults";
import type { ProjectDesignBookletAsset } from "@/lib/designBooklets/projectTypes";
import DesignBookletWorkbenchClient from "./DesignBookletWorkbenchClient";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  upload: vi.fn(),
  copy: vi.fn(),
  publishPdf: vi.fn(),
  compress: vi.fn(),
  preload: vi.fn(),
  renderPdfPreview: vi.fn(),
}));

vi.mock("@/lib/designBooklets/projectClient", () => ({
  loadProjectDesignBookletClient: mocks.load,
  saveProjectDesignBookletClient: mocks.save,
  uploadProjectDesignBookletAssetClient: mocks.upload,
  copyProjectDesignBookletAssetClient: mocks.copy,
  publishProjectDesignBookletPdfClient: mocks.publishPdf,
}));

vi.mock("@/lib/designBooklets/imageCompression", () => ({
  compressDesignBookletImage: mocks.compress,
}));

vi.mock("./preloadDesignBookletImage", () => ({
  preloadDesignBookletImage: mocks.preload,
}));

vi.mock("./renderDesignBookletPdfPreview", () => ({
  renderDesignBookletPdfPreview: mocks.renderPdfPreview,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function renderProjectWorkbench() {
  return renderIntoDocument(
    <DesignBookletWorkbenchClient
      content={getMarketingDesignBookletContent()}
      pdfEndpoint="/api/legacy-multipart-pdf"
      projectId="proj_project-1"
    />,
  );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function waitForReact(assertion: () => void, timeout?: number) {
  await act(async () => {
    await vi.waitFor(
      assertion,
      timeout === undefined ? undefined : { timeout },
    );
  });
}

describe("project-linked Design Booklet Workbench", () => {
  beforeEach(() => {
    const draft = createProjectDesignBookletDraft("Client AAA");
    mocks.load.mockReset().mockResolvedValue({
      project: {
        id: "proj_project-1",
        name: "AAA courtyard",
        customerName: "Client AAA",
        returnHref: "/staff/projects/proj_project-1",
      },
      draft,
      revision: 3,
      saved: true,
      updatedAt: "2026-07-31T00:00:00.000Z",
      assets: [],
    });
    mocks.save.mockReset().mockResolvedValue({
      revision: 4,
      updatedAt: "2026-07-31T00:01:00.000Z",
    });
    mocks.upload.mockReset();
    mocks.copy.mockReset();
    mocks.compress.mockReset().mockImplementation(async (file: File) => file);
    mocks.preload.mockReset().mockResolvedValue(undefined);
    mocks.renderPdfPreview
      .mockReset()
      .mockImplementation(
        async (
          _source: File | string,
          fileName: string,
          pageNumber: number,
        ) => ({
          file: new File(
            [`preview-${pageNumber}`],
            `${fileName}-${pageNumber}.jpg`,
            {
              type: "image/jpeg",
            },
          ),
          pageCount: 2,
          width: 1200,
          height: 800,
        }),
      );
    mocks.publishPdf.mockReset().mockResolvedValue({
      downloadUrl: "https://storage.example.test/booklet.pdf?token=short",
      filename: "client-aaa-design-booklet.pdf",
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads project identity, restores the draft and exposes the same-project return action", async () => {
    const rendered = renderProjectWorkbench();
    await flushEffects();

    const customerInput = Array.from(
      rendered.container.querySelectorAll("input"),
    ).find(
      (input) =>
        input.closest("label")?.querySelector("span")?.textContent ===
        "Customer name",
    );
    expect((customerInput as HTMLInputElement).value).toBe("Client AAA");
    expect(
      rendered.container.querySelector(
        'a[href="/staff/projects/proj_project-1"]',
      )?.textContent,
    ).toContain("Return to AAA courtyard");
    expect(rendered.container.textContent).toContain("Saved to project");
    expect(rendered.container.textContent).not.toContain(
      "Choices and uploaded images stay with this project.",
    );
    expect(mocks.load).toHaveBeenCalledWith("proj_project-1");
    rendered.unmount();
  });

  it("does not expose Toni media from an older saved project draft", async () => {
    mocks.load.mockResolvedValueOnce({
      project: {
        id: "proj_project-1",
        name: "AAA courtyard",
        customerName: "Client AAA",
        returnHref: "/staff/projects/proj_project-1",
      },
      draft: createToniDesignBookletDraft(),
      revision: 3,
      saved: true,
      updatedAt: "2026-07-31T00:00:00.000Z",
      assets: [],
    });

    const rendered = renderProjectWorkbench();
    await flushEffects();

    expect(
      rendered.container.querySelector(
        'img[src*="/images/design-booklets/toni/"]',
      ),
    ).toBeNull();
    expect(rendered.container.textContent).not.toContain("Toni concept");
    rendered.unmount();
  });

  it("autosaves draft changes with the loaded revision", async () => {
    vi.useFakeTimers();
    const rendered = renderProjectWorkbench();
    await flushEffects();
    const customerInput = Array.from(
      rendered.container.querySelectorAll("input"),
    ).find(
      (input) =>
        input.closest("label")?.querySelector("span")?.textContent ===
        "Customer name",
    ) as HTMLInputElement;
    const paperSizeSelect = Array.from(
      rendered.container.querySelectorAll("select"),
    ).find(
      (select) =>
        select.closest("label")?.querySelector("span")?.textContent ===
        "Paper size",
    ) as HTMLSelectElement;

    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(customerInput, "Client AAA updated");
      customerInput.dispatchEvent(new Event("input", { bubbles: true }));
      customerInput.dispatchEvent(new Event("change", { bubbles: true }));
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set?.call(paperSizeSelect, "a3");
      paperSizeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(701);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.save).toHaveBeenCalledWith(
      "proj_project-1",
      expect.objectContaining({
        customerName: "Client AAA updated",
        paperSize: "a3",
      }),
      3,
    );
    rendered.unmount();
  });

  it("autosaves bullet markers in the existing draft body string", async () => {
    vi.useFakeTimers();
    const draft = createProjectDesignBookletDraft("Client AAA");
    const imagePage = draft.contentPages.find((page) => page.kind === "image");
    if (!imagePage || imagePage.kind !== "image") {
      throw new Error("Expected an image page.");
    }
    imagePage.layout = "story-image-left";
    imagePage.content.body = "Shade through summer\nShelter in winter";
    mocks.load.mockResolvedValueOnce({
      project: {
        id: "proj_project-1",
        name: "AAA courtyard",
        customerName: "Client AAA",
        returnHref: "/staff/projects/proj_project-1",
      },
      draft,
      revision: 3,
      saved: true,
      updatedAt: "2026-07-31T00:00:00.000Z",
      assets: [],
    });

    const rendered = renderProjectWorkbench();
    await flushEffects();
    act(() => {
      (
        rendered.container.querySelector(
          '[data-booklet-page-select="image-page-1"]',
        ) as HTMLButtonElement
      ).click();
    });
    const body = rendered.container.querySelector(
      'textarea[id$="-body-copy"]',
    ) as HTMLTextAreaElement;
    act(() => {
      body.focus();
      body.setSelectionRange(0, body.value.length);
      body.dispatchEvent(new Event("select", { bubbles: true }));
      (
        rendered.container.querySelector(
          'button[aria-label="Toggle bullets in Body copy"]',
        ) as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(701);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.save).toHaveBeenCalledWith(
      "proj_project-1",
      expect.objectContaining({
        contentPages: expect.arrayContaining([
          expect.objectContaining({
            id: "image-page-1",
            content: expect.objectContaining({
              body: "- Shade through summer\n- Shelter in winter",
            }),
          }),
        ]),
      }),
      3,
    );
    rendered.unmount();
  });

  it("downloads through the project PDF publisher instead of the legacy multipart endpoint", async () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const pdfBytes = new TextEncoder().encode("%PDF-1.7 fixture");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(pdfBytes, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:exact-booklet-pdf");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const rendered = renderProjectWorkbench();
    await flushEffects();
    const downloadButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Download PDF"));

    await act(async () => {
      downloadButton?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.publishPdf).toHaveBeenCalledWith("proj_project-1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://storage.example.test/booklet.pdf?token=short",
      { cache: "no-store", credentials: "omit" },
    );
    await waitForReact(() => {
      if (!anchorClick.mock.calls.length) {
        throw new Error(
          rendered.container.querySelector('[role="alert"]')?.textContent ||
            "PDF download did not create an anchor",
        );
      }
    });
    expect(fetchSpy).not.toHaveBeenCalledWith(
      "/api/legacy-multipart-pdf",
      expect.anything(),
    );
    rendered.unmount();
  });

  it("renders a drawing immediately without generating a PDF, then generates once on download", async () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(new TextEncoder().encode("%PDF-1.7 download"), {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        }),
      ),
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:exact-booklet-pdf");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const rendered = renderProjectWorkbench();
    await flushEffects();

    act(() => {
      (
        rendered.container.querySelector(
          '[data-booklet-page-select="drawing-page-1"]',
        ) as HTMLButtonElement
      ).click();
    });

    const drawingPreview = rendered.container.querySelector(
      '[data-page-kind="drawings"]',
    );
    expect(drawingPreview?.getAttribute("data-drawing-preview")).toBe(
      "instant-html",
    );
    expect(drawingPreview?.querySelector("footer")).not.toBeNull();
    expect(mocks.publishPdf).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    const downloadButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent?.trim() === "Download PDF");
    act(() => downloadButton?.click());
    await waitForReact(() => expect(anchorClick).toHaveBeenCalled());

    expect(mocks.publishPdf).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });

  it("shows a local PDF preview before persistence and atomically swaps to the saved preview", async () => {
    const documentUpload = deferred<{
      assetId: string;
      src: string;
      label: string;
      mediaType: "application/pdf";
      byteSize: number;
      width: number;
      height: number;
      pageCount: number;
      updatedAt: string;
    }>();
    const previewUpload = deferred<{
      assetId: string;
      src: string;
      label: string;
      mediaType: "image/jpeg";
      byteSize: number;
      width: number;
      height: number;
      pageCount: number;
      updatedAt: string;
    }>();
    const preload = deferred<void>();
    mocks.upload
      .mockReturnValueOnce(documentUpload.promise)
      .mockReturnValueOnce(previewUpload.promise);
    mocks.preload.mockReturnValueOnce(preload.promise);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:instant-drawing");
    const revokeObjectUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);

    const rendered = renderProjectWorkbench();
    await flushEffects();
    act(() => {
      (
        rendered.container.querySelector(
          '[data-booklet-page-select="drawing-page-1"]',
        ) as HTMLButtonElement
      ).click();
    });
    const input = rendered.container.querySelector(
      '[data-drawing-editor-slot="1"] input[type="file"]',
    ) as HTMLInputElement;
    const original = new File(["%PDF drawing"], "roof-plan.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [original],
    });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));

    await flushEffects();
    expect(mocks.renderPdfPreview).toHaveBeenCalledWith(
      original,
      "roof-plan.pdf",
      1,
    );
    expect(
      rendered.container
        .querySelector('[data-page-kind="drawings"] img')
        ?.getAttribute("src"),
    ).toBe("blob:instant-drawing");
    expect(rendered.container.textContent).toContain("Saving booklet assets");
    expect(mocks.compress).not.toHaveBeenCalled();
    expect(mocks.upload).toHaveBeenCalledWith(
      "proj_project-1",
      expect.stringMatching(/-pdf$/),
      original,
    );
    expect(mocks.upload).toHaveBeenCalledTimes(2);

    await act(async () => {
      documentUpload.resolve({
        assetId: "drawing-page-1-drawing-1-pdf",
        src: "https://storage.example.test/roof-plan.pdf",
        label: "roof-plan.pdf",
        mediaType: "application/pdf",
        byteSize: 20,
        width: 842,
        height: 595,
        pageCount: 2,
        updatedAt: "2026-08-10T00:00:00.000Z",
      });
      previewUpload.resolve({
        assetId: "drawing-page-1-drawing-1",
        src: "https://storage.example.test/saved-roof-plan.jpg",
        label: "roof-plan.jpg",
        mediaType: "image/jpeg",
        byteSize: 10,
        width: 1200,
        height: 800,
        pageCount: 1,
        updatedAt: "2026-08-10T00:00:00.000Z",
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.preload).toHaveBeenCalledWith(
      "https://storage.example.test/saved-roof-plan.jpg",
    );
    expect(
      rendered.container
        .querySelector('[data-page-kind="drawings"] img')
        ?.getAttribute("src"),
    ).toBe("blob:instant-drawing");

    await act(async () => {
      preload.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      rendered.container
        .querySelector('[data-page-kind="drawings"] img')
        ?.getAttribute("src"),
    ).toBe("https://storage.example.test/saved-roof-plan.jpg");
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:instant-drawing");
    await waitForReact(() => expect(mocks.save).toHaveBeenCalled(), 1500);
    expect(rendered.container.textContent).toContain("Saved to project");
    rendered.unmount();
  });

  it("switches a multi-page drawing locally and uploads only its refreshed preview", async () => {
    mocks.upload
      .mockResolvedValueOnce({
        assetId: "drawing-page-1-drawing-1-pdf",
        src: "https://storage.example.test/roof-set.pdf",
        label: "roof-set.pdf",
        mediaType: "application/pdf",
        byteSize: 20,
        width: 842,
        height: 595,
        pageCount: 2,
        updatedAt: "2026-08-10T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        assetId: "drawing-page-1-drawing-1",
        src: "https://storage.example.test/page-1.jpg",
        label: "page-1.jpg",
        mediaType: "image/jpeg",
        byteSize: 10,
        width: 1200,
        height: 800,
        pageCount: 1,
        updatedAt: "2026-08-10T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        assetId: "drawing-page-1-drawing-1",
        src: "https://storage.example.test/page-2.jpg",
        label: "page-2.jpg",
        mediaType: "image/jpeg",
        byteSize: 10,
        width: 1200,
        height: 800,
        pageCount: 1,
        updatedAt: "2026-08-10T00:01:00.000Z",
      });
    vi.spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:page-1")
      .mockReturnValueOnce("blob:page-2");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const rendered = renderProjectWorkbench();
    await flushEffects();
    act(() => {
      (
        rendered.container.querySelector(
          '[data-booklet-page-select="drawing-page-1"]',
        ) as HTMLButtonElement
      ).click();
    });
    const input = rendered.container.querySelector(
      '[data-drawing-editor-slot="1"] input[type="file"]',
    ) as HTMLInputElement;
    const original = new File(["%PDF drawing"], "roof-set.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [original],
    });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    await waitForReact(() => expect(mocks.upload).toHaveBeenCalledTimes(2));
    await waitForReact(() => expect(mocks.save).toHaveBeenCalled());
    expect(rendered.container.textContent).toContain("Saved to project");

    const pageSelect = Array.from(
      rendered.container.querySelectorAll("select"),
    ).find((select) => select.parentElement?.textContent?.includes("PDF page"));
    expect(pageSelect?.querySelectorAll("option")).toHaveLength(2);
    act(() => {
      if (!pageSelect) throw new Error("Expected the PDF page selector.");
      pageSelect.value = "2";
      pageSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitForReact(() =>
      expect(mocks.renderPdfPreview).toHaveBeenLastCalledWith(
        "https://storage.example.test/roof-set.pdf",
        "roof-set.pdf",
        2,
      ),
    );
    await waitForReact(() => expect(mocks.upload).toHaveBeenCalledTimes(3));
    expect(mocks.upload.mock.calls[2]?.[1]).toBe("drawing-page-1-drawing-1");
    expect(mocks.upload.mock.calls[2]?.[2]?.type).toBe("image/jpeg");
    expect(
      rendered.container
        .querySelector('[data-page-kind="drawings"] img')
        ?.getAttribute("src"),
    ).toBe("https://storage.example.test/page-2.jpg");
    rendered.unmount();
  });

  it("keeps the newest rapid PDF replacement visible and persists replacements in selection order", async () => {
    const firstDocument = deferred<ProjectDesignBookletAsset>();
    const firstPreview = deferred<ProjectDesignBookletAsset>();
    const secondDocument = deferred<ProjectDesignBookletAsset>();
    const secondPreview = deferred<ProjectDesignBookletAsset>();
    mocks.upload
      .mockReturnValueOnce(firstDocument.promise)
      .mockReturnValueOnce(firstPreview.promise)
      .mockReturnValueOnce(secondDocument.promise)
      .mockReturnValueOnce(secondPreview.promise);
    vi.spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const rendered = renderProjectWorkbench();
    await flushEffects();
    act(() => {
      (
        rendered.container.querySelector(
          '[data-booklet-page-select="drawing-page-1"]',
        ) as HTMLButtonElement
      ).click();
    });
    const input = rendered.container.querySelector(
      '[data-drawing-editor-slot="1"] input[type="file"]',
    ) as HTMLInputElement;
    const replace = (file: File) => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file],
      });
      act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    };
    const first = new File(["first"], "first.pdf", {
      type: "application/pdf",
    });
    const second = new File(["second"], "second.pdf", {
      type: "application/pdf",
    });

    replace(first);
    await flushEffects();
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    replace(second);
    await flushEffects();
    expect(
      rendered.container
        .querySelector('[data-page-kind="drawings"] img')
        ?.getAttribute("src"),
    ).toBe("blob:second");
    expect(mocks.upload).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstDocument.resolve({
        assetId: "drawing-page-1-drawing-1-pdf",
        src: "https://storage/first.pdf",
        label: "first.pdf",
        mediaType: "application/pdf",
        byteSize: 10,
        width: 842,
        height: 595,
        pageCount: 2,
        updatedAt: "2026-08-10T00:00:00.000Z",
      });
      firstPreview.resolve({
        assetId: "drawing-page-1-drawing-1",
        src: "https://storage/first.jpg",
        label: "first.jpg",
        mediaType: "image/jpeg",
        byteSize: 5,
        width: 100,
        height: 100,
        pageCount: 1,
        updatedAt: "2026-08-10T00:00:00.000Z",
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.upload).toHaveBeenCalledTimes(4);
    expect(mocks.upload.mock.calls[0]?.[2]?.name).toBe("first.pdf");
    expect(mocks.upload.mock.calls[2]?.[2]?.name).toBe("second.pdf");
    expect(mocks.preload).not.toHaveBeenCalledWith("https://storage/first.jpg");
    expect(
      rendered.container
        .querySelector('[data-page-kind="drawings"] img')
        ?.getAttribute("src"),
    ).toBe("blob:second");

    await act(async () => {
      secondDocument.resolve({
        assetId: "drawing-page-1-drawing-1-pdf",
        pageCount: 2,
        src: "https://storage.example.test/second.pdf",
        label: "second.pdf",
        mediaType: "application/pdf",
        byteSize: 10,
        width: 842,
        height: 595,
        updatedAt: "2026-08-10T00:00:01.000Z",
      });
      secondPreview.resolve({
        assetId: "drawing-page-1-drawing-1",
        src: "https://storage.example.test/second.jpg",
        label: "second.jpg",
        mediaType: "image/jpeg",
        byteSize: 6,
        width: 100,
        height: 100,
        pageCount: 1,
        updatedAt: "2026-08-10T00:00:01.000Z",
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitForReact(() =>
      expect(mocks.preload).toHaveBeenCalledWith(
        "https://storage.example.test/second.jpg",
      ),
    );
    expect(
      rendered.container
        .querySelector('[data-page-kind="drawings"] img')
        ?.getAttribute("src"),
    ).toBe("https://storage.example.test/second.jpg");
    rendered.unmount();
  });
});
