import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "./next.config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("portal security headers", () => {
  it("keeps private attachment redirects stricter than the catch-all policy", async () => {
    const rules = await nextConfig.headers!();
    const index = rules.findIndex(rule => rule.source === "/api/staff/v1/projects/:projectId/enquiry-attachments/:attachmentId/open");
    expect(index).toBeGreaterThan(rules.findIndex(rule => rule.source === "/:path*"));
    expect(rules[index].headers).toEqual(expect.arrayContaining([
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "private, no-store" },
    ]));
  });

  it("allows private Supabase booklet images in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers!();
    const catchAll = rules.find((rule) => rule.source === "/:path*");
    const policy = catchAll?.headers.find(
      (header) => header.key === "Content-Security-Policy",
    )?.value;

    expect(policy).toContain(
      "img-src 'self' data: blob: https://*.supabase.co",
    );
  });
});
