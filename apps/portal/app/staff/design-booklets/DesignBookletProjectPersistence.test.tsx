import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import { getMarketingDesignBookletContent } from "../../../../marketing/lib/designBookletContent";
import {
  createProjectDesignBookletDraft,
  createToniDesignBookletDraft,
} from "@/lib/designBooklets/defaults";
import DesignBookletWorkbenchClient from "./DesignBookletWorkbenchClient";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  upload: vi.fn(),
  copy: vi.fn(),
  publishPdf: vi.fn(),
  compress: vi.fn(),
  preload: vi.fn(),
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

    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(customerInput, "Client AAA updated");
      customerInput.dispatchEvent(new Event("input", { bubbles: true }));
      customerInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(701);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.save).toHaveBeenCalledWith(
      "proj_project-1",
      expect.objectContaining({ customerName: "Client AAA updated" }),
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
    await vi.waitFor(() => {
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
    await vi.waitFor(() => expect(anchorClick).toHaveBeenCalled());

    expect(mocks.publishPdf).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });

  it("shows the selected drawing before compression and atomically swaps to the saved source", async () => {
    const compression = deferred<File>();
    const upload = deferred<{
      assetId: string;
      src: string;
      label: string;
      mediaType: "image/jpeg";
      byteSize: number;
      width: number;
      height: number;
      updatedAt: string;
    }>();
    const preload = deferred<void>();
    mocks.compress.mockReturnValueOnce(compression.promise);
    mocks.upload.mockReturnValueOnce(upload.promise);
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
    const original = new File(["large drawing"], "roof-plan.png", {
      type: "image/png",
    });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [original],
    });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));

    expect(
      rendered.container
        .querySelector('[data-page-kind="drawings"] img')
        ?.getAttribute("src"),
    ).toBe("blob:instant-drawing");
    expect(rendered.container.textContent).toContain("Uploading image");
    await flushEffects();
    expect(mocks.compress).toHaveBeenCalledWith(original);
    expect(mocks.upload).not.toHaveBeenCalled();

    const compressed = new File(["compressed"], "roof-plan.jpg", {
      type: "image/jpeg",
    });
    await act(async () => {
      compression.resolve(compressed);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      "proj_project-1",
      expect.any(String),
      compressed,
    );

    await act(async () => {
      upload.resolve({
        assetId: "drawing-page-1-drawing-1",
        src: "https://storage.example.test/saved-roof-plan.jpg",
        label: "roof-plan.jpg",
        mediaType: "image/jpeg",
        byteSize: 10,
        width: 1200,
        height: 800,
        updatedAt: "2026-08-06T00:00:00.000Z",
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
    expect(rendered.container.textContent).toContain("Saved to project");
    rendered.unmount();
  });

  it("keeps the newest rapid replacement visible and persists replacements in selection order", async () => {
    const firstUpload = deferred<{
      assetId: string;
      src: string;
      label: string;
      mediaType: "image/jpeg";
      byteSize: number;
      width: number;
      height: number;
      updatedAt: string;
    }>();
    const secondUpload = deferred<{
      assetId: string;
      src: string;
      label: string;
      mediaType: "image/jpeg";
      byteSize: number;
      width: number;
      height: number;
      updatedAt: string;
    }>();
    mocks.upload
      .mockReturnValueOnce(firstUpload.promise)
      .mockReturnValueOnce(secondUpload.promise);
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
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.png", { type: "image/png" });

    replace(first);
    await flushEffects();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    replace(second);
    expect(
      rendered.container
        .querySelector('[data-page-kind="drawings"] img')
        ?.getAttribute("src"),
    ).toBe("blob:second");
    expect(mocks.upload).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstUpload.resolve({
        assetId: "drawing-page-1-drawing-1",
        src: "https://storage.example.test/first.jpg",
        label: "first.jpg",
        mediaType: "image/jpeg",
        byteSize: 5,
        width: 100,
        height: 100,
        updatedAt: "2026-08-06T00:00:00.000Z",
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.upload.mock.calls[0]?.[2]?.name).toBe("first.png");
    expect(mocks.upload.mock.calls[1]?.[2]?.name).toBe("second.png");
    expect(mocks.preload).not.toHaveBeenCalledWith(
      "https://storage.example.test/first.jpg",
    );
    expect(
      rendered.container
        .querySelector('[data-page-kind="drawings"] img')
        ?.getAttribute("src"),
    ).toBe("blob:second");

    await act(async () => {
      secondUpload.resolve({
        assetId: "drawing-page-1-drawing-1",
        src: "https://storage.example.test/second.jpg",
        label: "second.jpg",
        mediaType: "image/jpeg",
        byteSize: 6,
        width: 100,
        height: 100,
        updatedAt: "2026-08-06T00:00:01.000Z",
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await vi.waitFor(() =>
      expect(
        rendered.container
          .querySelector('[data-page-kind="drawings"] img')
          ?.getAttribute("src"),
      ).toBe("https://storage.example.test/second.jpg"),
    );
    rendered.unmount();
  });
});
