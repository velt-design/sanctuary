import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("CalculatorGridClient navigation boundary", () => {
  it("routes standalone project handoffs through the portal transition owner", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "apps/portal/app/staff/calculator/CalculatorGridClient.tsx",
      ),
      "utf8",
    );

    expect(source).toContain(
      "const { navigateRoute } = usePortalRouteTransition();",
    );
    expect(source).toContain("source: 'calculator-status'");
    expect(source).toContain("source: 'calculator-project-picker'");
    expect(source).not.toContain("router.push");
    expect(source).toContain("const router = useRouter();");
  });
});
