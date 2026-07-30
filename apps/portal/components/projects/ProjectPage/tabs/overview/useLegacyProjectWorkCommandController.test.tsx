import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectCommandCentreOperations } from "@/lib/projects/commandCentre/types";
import { renderIntoDocument } from "../../../../../../../test/reactHarness";
import {
  useLegacyProjectWorkCommandController,
  type LegacyProjectWorkCommandController,
} from "./useLegacyProjectWorkCommandController";

const mocks = vi.hoisted(() => ({
  invalidateProjectWorkReads: vi.fn(async (..._args: unknown[]) => undefined),
  patchProjectCommandCentreCache: vi.fn(),
  runProjectActionCommand: vi.fn(),
}));

vi.mock("@/lib/projects/commandCentre/client", () => ({
  runProjectActionCommand: (...args: unknown[]) =>
    mocks.runProjectActionCommand(...args),
}));

vi.mock("@/lib/queries/projectWorkCache", () => ({
  invalidateProjectWorkReads: (...args: unknown[]) =>
    mocks.invalidateProjectWorkReads(...args),
  patchProjectCommandCentreCache: (...args: unknown[]) =>
    mocks.patchProjectCommandCentreCache(...args),
}));

const PROJECT_ID = "proj_22222222-2222-4222-8222-222222222222";
const operations: ProjectCommandCentreOperations = {
  owner: {
    owner: { key: "jordan", displayName: "Jordan" },
    required: true,
    missing: false,
    version: "2026-07-29T00:00:00.000Z",
    permissions: { canManage: false },
  },
  primaryAction: null,
  candidates: [],
  candidateCount: 0,
  candidateRevision: "fixture-revision",
  manualSelectionBaselineHash: "fixture-manual",
  selectionConflict: null,
  permissions: {
    canCreate: true,
    canSelect: false,
    canComplete: false,
    canReschedule: false,
    canReassign: false,
    canSetCritical: false,
    canResolveConflict: false,
  },
  audit: [],
  exceptions: {
    missingOwner: false,
    noPrimaryAction: true,
    selectionConflict: false,
  },
};

let currentController: LegacyProjectWorkCommandController | null = null;
const mounted: Array<() => void> = [];

function ControllerProbe() {
  currentController = useLegacyProjectWorkCommandController({
    projectId: PROJECT_ID,
    host: "fixture",
    operations,
    stale: false,
    onRefresh: vi.fn(),
  });
  return null;
}

function controller(): LegacyProjectWorkCommandController {
  if (!currentController) {
    throw new Error("Legacy Project Work controller was not rendered.");
  }
  return currentController;
}

function renderController() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  currentController = null;
  const rendered = renderIntoDocument(
    <QueryClientProvider client={queryClient}>
      <ControllerProbe />
    </QueryClientProvider>,
  );
  mounted.push(rendered.unmount);
}

describe("useLegacyProjectWorkCommandController", () => {
  beforeEach(() => {
    mocks.invalidateProjectWorkReads.mockClear();
    mocks.patchProjectCommandCentreCache.mockClear();
    mocks.runProjectActionCommand.mockReset();
  });

  afterEach(() => {
    while (mounted.length) mounted.pop()?.();
    currentController = null;
    document.body.innerHTML = "";
  });

  it.each(["Call customer", "Book Site Visit"])(
    "rejects prohibited manual legacy work before any server command: %s",
    async (title) => {
      renderController();

      await act(async () => {
        await expect(
          controller().executeCommand({
            command: "create_manual",
            title,
            category: "Follow-up",
            dueDate: "2026-08-01",
          }),
        ).resolves.toBe(false);
      });

      expect(controller().error).toBe(
        "Call and Site Visit actions cannot be created from Project Work.",
      );
      expect(mocks.runProjectActionCommand).not.toHaveBeenCalled();
      expect(mocks.patchProjectCommandCentreCache).not.toHaveBeenCalled();
      expect(mocks.invalidateProjectWorkReads).not.toHaveBeenCalled();
    },
  );
});
