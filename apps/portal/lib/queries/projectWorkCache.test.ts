import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ProjectWorkProjection } from "@/lib/projects/workItems/types";
import { qk } from "./keys";
import {
  invalidateProjectWorkReads,
  patchProjectCommandCentreCache,
  patchProjectWorkProjectionCaches,
} from "./projectWorkCache";

const projectWork = {
  projectId: "proj_1",
  modelVersion: 2,
  operationalState: "ACTIVE",
  effectiveState: "ACTIVE",
  stateRowVersion: 2,
  waitingUntil: null,
  waitingReason: null,
  closedOutcome: null,
  openItems: [],
  blockedItems: [],
  confirmedFacts: [],
  primaryAction: {
    kind: "none",
    title: "No current project work",
    reason: "No action is currently due.",
  },
  generatedAt: "2026-07-29T00:00:00.000Z",
} as ProjectWorkProjection;

describe("projectWorkCache", () => {
  it("patches command-centre, snapshot and summary V2 projections together", () => {
    const client = new QueryClient();
    client.setQueryData(qk.projects.commandCentre("host", "proj_1"), {
      workModel: "v2",
      projectWork: { ...projectWork, stateRowVersion: 1 },
    });
    for (const key of [
      qk.projects.snapshot("host", "proj_1"),
      qk.projects.summary("host", "proj_1"),
    ]) {
      client.setQueryData(key, {
        generatedAt: "2026-07-29T00:00:00.000Z",
        snapshot: {
          workModel: "v2",
          projectWork: { ...projectWork, stateRowVersion: 1 },
        },
      });
    }

    patchProjectWorkProjectionCaches(client, "host", "proj_1", projectWork);

    expect(
      (client.getQueryData(qk.projects.commandCentre("host", "proj_1")) as any)
        .projectWork,
    ).toEqual(projectWork);
    expect(
      (client.getQueryData(qk.projects.snapshot("host", "proj_1")) as any)
        .snapshot.projectWork,
    ).toEqual(projectWork);
    expect(
      (client.getQueryData(qk.projects.summary("host", "proj_1")) as any)
        .snapshot.projectWork,
    ).toEqual(projectWork);
  });

  it("never upgrades legacy caches into V2", () => {
    const client = new QueryClient();
    const legacy = {
      generatedAt: "2026-07-29T00:00:00.000Z",
      snapshot: { workModel: "legacy" },
    };
    client.setQueryData(qk.projects.snapshot("host", "proj_1"), legacy);

    patchProjectWorkProjectionCaches(client, "host", "proj_1", projectWork);

    expect(client.getQueryData(qk.projects.snapshot("host", "proj_1"))).toBe(
      legacy,
    );
  });

  it("patches a complete server-returned command-centre response through the cache owner", () => {
    const client = new QueryClient();
    const commandCentre = {
      projectId: "proj_1",
      workModel: "v2" as const,
      projectWork,
      owner: {
        owner: null,
        required: true,
        missing: true,
        version: "2026-07-29T00:00:00.000Z",
        permissions: { canManage: false },
      },
      currentDesign: {
        source: "none" as const,
        statusLabel: "No current design",
        statusTone: "neutral" as const,
        designState: "none" as const,
        design: null,
        price: { source: "none" as const, totalIncGstCents: null },
        estimate: null,
        quote: null,
        newerEstimate: null,
        latestDeclinedQuote: null,
        warnings: [],
        links: {
          designs: "/staff/projects/proj_1?tab=estimates",
          quotes: "/staff/projects/proj_1?tab=quotes",
          estimate: null,
          quote: null,
        },
      },
      generatedAt: "2026-07-29T00:00:00.000Z",
    };

    patchProjectCommandCentreCache(client, "host", "proj_1", commandCentre);

    expect(
      client.getQueryData(qk.projects.commandCentre("host", "proj_1")),
    ).toBe(commandCentre);
  });

  it("invalidates every project and global Project Work consumer", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await invalidateProjectWorkReads(
      { invalidateQueries } as any,
      "host",
      "proj_1",
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: qk.projects.snapshot("host", "proj_1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: qk.projects.summary("host", "proj_1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: qk.projects.commandCentre("host", "proj_1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: qk.projectWork.queue("host"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: qk.dashboard.dataPrefix(),
    });
  });
});
