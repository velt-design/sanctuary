import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";
import ProjectEnquiryFilesPanel from "./ProjectEnquiryFilesPanel";

const mocks = vi.hoisted(() => ({
  fetchProjectEnquiryAttachments: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, prefetch: _prefetch, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/projects/enquiryAttachments/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/projects/enquiryAttachments/client")>(
    "@/lib/projects/enquiryAttachments/client",
  );
  return { ...actual, fetchProjectEnquiryAttachments: mocks.fetchProjectEnquiryAttachments };
});

const projectId = "proj_11111111-1111-4111-8111-111111111111";
let queryClient: QueryClient;
let unmount: (() => void) | null = null;

async function renderPanel() {
  const mounted = renderIntoDocument(
    <QueryClientProvider client={queryClient}>
      <ProjectEnquiryFilesPanel projectId={projectId} host="portal.test" />
    </QueryClientProvider>,
  );
  unmount = mounted.unmount;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
  });
  return mounted.container;
}

async function renderFixturePanel() {
  const mounted = renderIntoDocument(
    <QueryClientProvider client={queryClient}>
      <ProjectEnquiryFilesPanel
        projectId={projectId}
        host="fixture"
        initialAttachments={[{
          id: "attachment-fixture",
          filename: "large-inspiration.jpg",
          contentType: "image/jpeg",
          sizeBytes: 9_437_184,
          submittedAt: "2026-08-27T00:00:00Z",
        }]}
        disableActions
      />
    </QueryClientProvider>,
  );
  unmount = mounted.unmount;
  await act(async () => {
    await Promise.resolve();
  });
  return mounted.container;
}

describe("ProjectEnquiryFilesPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.fetchProjectEnquiryAttachments.mockResolvedValue({ attachments: [], generatedAt: "2026-08-27T00:00:00Z" });
  });

  afterEach(() => {
    unmount?.();
    unmount = null;
    queryClient.clear();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows the approved empty state", async () => {
    const container = await renderPanel();
    expect(container.textContent).toContain("No website enquiry files");
  });

  it("shows file metadata and on-demand View and Download actions", async () => {
    const attachmentId = "22222222-2222-4222-8222-222222222222";
    mocks.fetchProjectEnquiryAttachments.mockResolvedValueOnce({
      generatedAt: "2026-08-27T00:00:00Z",
      attachments: [{
        id: attachmentId,
        filename: "site-plan.pdf",
        contentType: "application/pdf",
        sizeBytes: 1_572_864,
        submittedAt: "2026-08-27T00:00:00Z",
      }],
    });
    const container = await renderPanel();
    expect(container.textContent).toContain("site-plan.pdf");
    expect(container.textContent).toContain("1.5 MB");
    expect(container.querySelector<HTMLAnchorElement>('a[href*="disposition=view"]')?.target).toBe("_blank");
    expect(container.querySelector<HTMLAnchorElement>('a[href*="disposition=download"]')?.getAttribute("href"))
      .toBe(`/api/staff/v1/projects/${projectId}/enquiry-attachments/${attachmentId}/open?disposition=download`);
  });

  it("renders synthetic fixture files without an API read or live actions", async () => {
    const container = await renderFixturePanel();
    expect(container.textContent).toContain("large-inspiration.jpg");
    expect(container.textContent).toContain("9.0 MB");
    expect(mocks.fetchProjectEnquiryAttachments).not.toHaveBeenCalled();
    expect(container.querySelectorAll("a")).toHaveLength(0);
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });
});
