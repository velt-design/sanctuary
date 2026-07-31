import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "./next.config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("portal security headers", () => {
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
