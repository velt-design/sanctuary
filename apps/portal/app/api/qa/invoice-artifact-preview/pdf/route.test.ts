// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("invoice artifact preview PDF QA route", () => {
  const originalFlag = process.env.ENABLE_PORTAL_QA_FIXTURES;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    } else {
      process.env.ENABLE_PORTAL_QA_FIXTURES = originalFlag;
    }
  });

  it("is unavailable unless data-free QA fixtures are enabled", async () => {
    delete process.env.ENABLE_PORTAL_QA_FIXTURES;

    const response = await GET();

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns a private inline synthetic PDF without persistence", async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = "1";

    const response = await GET();
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1_000);
  });
});
