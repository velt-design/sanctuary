import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "./next.config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("portal security headers", () => {
  it("serves the service worker with an explicit no-store update contract", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers!();
    const worker = rules.find((rule) => rule.source === "/sw.js");

    expect(worker?.headers).toContainEqual({
      key: "Cache-Control",
      value: "no-cache, no-store, must-revalidate",
    });
    expect(worker?.headers).toContainEqual({ key: "Service-Worker-Allowed", value: "/" });
    expect(nextConfig.env?.NEXT_PUBLIC_PORTAL_STATIC_CACHE_VERSION).toMatch(/^v1-[a-zA-Z0-9._-]+$/);
    expect(nextConfig.generateBuildId).toBeTypeOf("function");
    const buildId = await nextConfig.generateBuildId!();
    expect(nextConfig.env?.NEXT_PUBLIC_BUILD_ID).toBe(buildId);
    expect(nextConfig.env?.NEXT_PUBLIC_PORTAL_STATIC_CACHE_VERSION).toBe(`v1-${buildId}`);
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
