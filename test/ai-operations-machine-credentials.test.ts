import { describe, expect, it } from "vitest";

import { evaluateMachineCredentialEvidence } from "../scripts/ai/mac-machine-credential-gate.mjs";

const passingEvidence = {
  runtimeUser: "sanctuary-runner",
  onePasswordCliReady: true,
  onePasswordKeychainItemPresent: true,
  onePasswordVaults: ["Sanctuary - Node Runtime"],
  onePasswordReadOnlyAttested: true,
  githubKeychainItemsPresent: true,
  githubRepository: "velt-design/sanctuary",
  githubPermissions: {
    contents: "write",
    metadata: "read",
    pull_requests: "write",
  },
};

describe("Mac machine credential gate", () => {
  it("passes the exact least-privilege contract", () => {
    expect(evaluateMachineCredentialEvidence(passingEvidence).passed).toBe(true);
  });

  it("fails access to an additional 1Password vault", () => {
    const report = evaluateMachineCredentialEvidence({
      ...passingEvidence,
      onePasswordVaults: ["Sanctuary - Node Runtime", "Sanctuary - Owners"],
    });

    expect(report.passed).toBe(false);
    expect(report.checks.onePasswordVaultScope.status).toBe("fail");
  });

  it("fails a broader GitHub App permission", () => {
    const report = evaluateMachineCredentialEvidence({
      ...passingEvidence,
      githubPermissions: { ...passingEvidence.githubPermissions, workflows: "write" },
    });

    expect(report.passed).toBe(false);
    expect(report.checks.githubPermissions.status).toBe("fail");
  });

  it("requires read-only service-account attestation", () => {
    const report = evaluateMachineCredentialEvidence({
      ...passingEvidence,
      onePasswordReadOnlyAttested: false,
    });

    expect(report.passed).toBe(false);
    expect(report.checks.onePasswordReadOnly.status).toBe("fail");
  });

  it("returns only the public gate shape", () => {
    const report = evaluateMachineCredentialEvidence(passingEvidence);

    expect(Object.keys(report)).toEqual(["schemaVersion", "gate", "passed", "checks"]);
    expect(report).not.toHaveProperty("credentials");
  });
});
