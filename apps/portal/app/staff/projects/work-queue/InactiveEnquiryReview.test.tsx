import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  fetchReport: vi.fn(),
  closeEnquiries: vi.fn(),
}));

vi.mock("@/lib/projects/inactiveEnquiries/client", () => ({
  fetchInactiveEnquiryReport: mocks.fetchReport,
  closeInactiveEnquiries: mocks.closeEnquiries,
  inactiveEnquiryReportQueryKey: (host: string) => [
    "projectWork",
    host,
    "inactiveEnquiryReview",
  ],
}));

vi.mock("@/components/ui/PipelineModal", () => ({
  PipelineModal: ({ open, title, description, actions, hint, children }: any) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
        <div>{actions}</div>
        <small>{hint}</small>
      </div>
    ) : null,
}));

import InactiveEnquiryReview from "./InactiveEnquiryReview.client";

const candidate = {
  projectId: "proj_11111111-1111-4111-8111-111111111111",
  projectName: "Stale Enquiry",
  pipelineStage: "new",
  operationalState: "ACTIVE",
  waitingUntil: null,
  ownerKey: "ellen",
  lastActivityAt: "2026-05-01T00:00:00.000Z",
  lastActivitySource: "project_note",
  inactiveForDays: 92,
  protectedByFutureWait: false,
  evidenceFingerprint: "a".repeat(32),
};
const protectedCandidate = {
  ...candidate,
  projectId: "proj_22222222-2222-4222-8222-222222222222",
  projectName: "Protected Waiting Enquiry",
  operationalState: "WAITING",
  protectedByFutureWait: true,
  evidenceFingerprint: "b".repeat(32),
};
const report = {
  reportAsOf: "2026-08-01T00:00:00.000Z",
  inactiveDays: 30,
  candidateCount: 1,
  candidates: [candidate, protectedCandidate],
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let client: QueryClient | null = null;

async function renderReview() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root!.render(
      <QueryClientProvider client={client!}>
        <InactiveEnquiryReview host="test-host" />
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (container.textContent?.includes("eligible")) break;
  }
  return container;
}

function button(label: string) {
  return Array.from(container!.querySelectorAll("button")).find(
    (item) => item.textContent === label,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchReport.mockResolvedValue(report);
  mocks.closeEnquiries.mockResolvedValue({
    command: { id: "33333333-3333-4333-8333-333333333333", committed: true, replayed: false },
    result: {
      reportAsOf: report.reportAsOf,
      revalidatedAt: "2026-08-01T00:01:00.000Z",
      inactiveDays: 30,
      closedCount: 1,
      projects: [
        {
          projectId: candidate.projectId,
          commandId: "44444444-4444-4444-8444-444444444444",
          rowVersion: 2,
          cancelledCount: 1,
        },
      ],
    },
  });
  vi.stubGlobal("crypto", {
    randomUUID: () => "33333333-3333-4333-8333-333333333333",
  });
});

afterEach(() => {
  act(() => root?.unmount());
  client?.clear();
  container?.remove();
  vi.unstubAllGlobals();
  root = null;
  client = null;
  container = null;
});

describe("InactiveEnquiryReview", () => {
  it("shows a read-only count and selects nothing by default", async () => {
    const rendered = await renderReview();
    expect(rendered.textContent).toContain("1 eligible");
    expect(rendered.textContent).toContain("Nothing closes automatically");
    act(() => button("Review exact list")?.click());
    const checkboxes = Array.from(
      rendered.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((checkbox) => !checkbox.checked)).toBe(true);
    expect(checkboxes[1]?.disabled).toBe(true);
    expect(button("Review selected (0)")?.disabled).toBe(true);
  });

  it("requires a second exact-list confirmation before closing", async () => {
    const rendered = await renderReview();
    act(() => button("Review exact list")?.click());
    const first = rendered.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!;
    act(() => first.click());
    expect(button("Review selected (1)")?.disabled).toBe(false);
    act(() => button("Review selected (1)")?.click());
    expect(rendered.textContent).toContain("Confirm 1 stale enquiry");
    expect(rendered.textContent).toContain("Stale Enquiry");
    expect(rendered.textContent).toContain("92 days inactive");

    await act(async () => {
      button("Close 1 as Lost - No response")?.click();
      await Promise.resolve();
    });

    expect(mocks.closeEnquiries).toHaveBeenCalledWith(
      expect.objectContaining({
        reportAsOf: report.reportAsOf,
        inactiveDays: 30,
        candidates: [candidate],
      }),
    );
  });
});
