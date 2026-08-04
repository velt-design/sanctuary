import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import { getMarketingDesignBookletContent } from "../../../../marketing/lib/designBookletContent";
import { createProjectDesignBookletDraft } from "@/lib/designBooklets/defaults";
import DesignBookletWorkbenchClient from "./DesignBookletWorkbenchClient";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  upload: vi.fn(),
  copy: vi.fn(),
  publishPdf: vi.fn(),
}));

vi.mock("@/lib/designBooklets/projectClient", () => ({
  loadProjectDesignBookletClient: mocks.load,
  saveProjectDesignBookletClient: mocks.save,
  uploadProjectDesignBookletAssetClient: mocks.upload,
  copyProjectDesignBookletAssetClient: mocks.copy,
  publishProjectDesignBookletPdfClient: mocks.publishPdf,
}));

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
    const legacyFetch = vi.spyOn(globalThis, "fetch");
    const rendered = renderProjectWorkbench();
    await flushEffects();
    const downloadButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Download PDF"));

    await act(async () => {
      downloadButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.publishPdf).toHaveBeenCalledWith("proj_project-1");
    expect(anchorClick).toHaveBeenCalled();
    expect(legacyFetch).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
