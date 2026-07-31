import { describe, expect, it } from "vitest";

import { validateProjectWorkReadOnlyTarget } from "../playwright/support/projectWorkReadOnlyAuth";

const PRODUCTION_REF = "iytanftukulcnavossmd";
const STAGING_REF = "tnsiprehuldksnuowubv";

describe("Project Work authenticated read-only target guard", () => {
  it("accepts an explicitly named staging host with distinct project refs", () => {
    expect(
      validateProjectWorkReadOnlyTarget({
        baseUrl: "https://sanctuary-portal-project-work-staging.vercel.app",
        env: {
          PORTAL_PROJECT_WORK_V2_READINESS_TARGET: "staging",
          PORTAL_PROJECT_WORK_V2_STAGING_PROJECT_REF: STAGING_REF,
          PORTAL_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
        },
      }),
    ).toBe("staging");
  });

  it("accepts only the exact production portal and Supabase identities", () => {
    expect(
      validateProjectWorkReadOnlyTarget({
        baseUrl: "https://portal.sanctuarypergolas.co.nz",
        env: {
          PORTAL_PROJECT_WORK_V2_READINESS_TARGET: "production",
          PORTAL_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
        },
      }),
    ).toBe("production");
  });

  it.each([
    {
      baseUrl: "https://sanctuary-portal.example.com",
      productionRef: PRODUCTION_REF,
    },
    {
      baseUrl: "https://portal.sanctuarypergolas.co.nz",
      productionRef: STAGING_REF,
    },
    {
      baseUrl: "http://portal.sanctuarypergolas.co.nz",
      productionRef: PRODUCTION_REF,
    },
    {
      baseUrl: "https://portal.sanctuarypergolas.co.nz/dashboard",
      productionRef: PRODUCTION_REF,
    },
  ])(
    "rejects a production smoke identity mismatch",
    ({ baseUrl, productionRef }) => {
      expect(() =>
        validateProjectWorkReadOnlyTarget({
          baseUrl,
          env: {
            PORTAL_PROJECT_WORK_V2_READINESS_TARGET: "production",
            PORTAL_PRODUCTION_SUPABASE_PROJECT_REF: productionRef,
          },
        }),
      ).toThrow();
    },
  );

  it("still rejects an ambiguous remote staging host", () => {
    expect(() =>
      validateProjectWorkReadOnlyTarget({
        baseUrl: "https://sanctuary-portal.vercel.app",
        env: {
          PORTAL_PROJECT_WORK_V2_READINESS_TARGET: "staging",
          PORTAL_PROJECT_WORK_V2_STAGING_PROJECT_REF: STAGING_REF,
          PORTAL_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
        },
      }),
    ).toThrow(/ambiguous or production-like host/);
  });
});
