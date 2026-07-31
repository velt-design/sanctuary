import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  requireStaffContext: vi.fn(),
  parseJsonBody: vi.fn(),
}));

vi.mock("@/lib/api/staffApi", () => ({
  jsonError: (message: string, status = 400, _diagnostics?: unknown, extra?: object) =>
    Response.json({ error: message, ...(extra ?? {}) }, { status }),
  jsonOk: (payload: object, status = 200) => Response.json(payload, { status }),
  parseJsonBody: mocks.parseJsonBody,
  requireStaffContext: mocks.requireStaffContext,
}));

vi.mock("@/lib/designBooklets/projectPersistence", () => ({
  loadProjectDesignBooklet: mocks.load,
  saveProjectDesignBooklet: mocks.save,
  ProjectDesignBookletError: class extends Error {},
}));

vi.mock("@/lib/designBooklets/projectApi", () => ({
  privateProjectDesignBookletResponse: (response: Response) => {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  },
  projectDesignBookletErrorResponse: () =>
    Response.json({ error: "failed" }, { status: 500 }),
}));

import { GET, PUT } from "./route";

const context = {
  params: Promise.resolve({ projectId: "proj_project-1" }),
};

describe("project design booklet route", () => {
  beforeEach(() => {
    mocks.load.mockReset();
    mocks.save.mockReset();
    mocks.requireStaffContext.mockReset().mockResolvedValue({
      ok: true,
      session: { user: { id: "staff-1" } },
      supabase: { client: true },
    });
    mocks.parseJsonBody.mockReset().mockResolvedValue({
      ok: true,
      body: { draft: { schemaVersion: 2 }, expectedRevision: 3 },
    });
  });

  it("keeps unauthenticated project booklet reads behind the staff boundary", async () => {
    mocks.requireStaffContext.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await GET(new Request("http://portal.test"), context);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("returns the project-scoped booklet snapshot without caching it", async () => {
    mocks.load.mockResolvedValue({ project: { id: "proj_project-1" } });
    const response = await GET(new Request("http://portal.test"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.load).toHaveBeenCalledWith(
      { client: true },
      "proj_project-1",
    );
  });

  it("passes the authenticated user and optimistic revision into saves", async () => {
    mocks.save.mockResolvedValue({
      revision: 4,
      updatedAt: "2026-07-31T00:00:00.000Z",
    });
    const response = await PUT(
      new Request("http://portal.test", { method: "PUT" }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(
      { client: true },
      {
        projectId: "proj_project-1",
        draft: { schemaVersion: 2 },
        expectedRevision: 3,
        userId: "staff-1",
      },
    );
  });
});
