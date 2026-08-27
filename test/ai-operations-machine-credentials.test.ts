import { describe, expect, it } from "vitest";

import {
  evaluateMachineCredentialEvidence,
  readGitHubVaultFields,
  resolveMachineServiceTokenPath,
} from "../scripts/ai/mac-machine-credential-gate.mjs";

const passingEvidence = {
  runtimeUser: "sanctuary-runner",
  onePasswordCliReady: true,
  onePasswordTokenFileProtected: true,
  onePasswordVaults: ["Sanctuary - Node Runtime"],
  onePasswordReadOnlyAttested: true,
  githubVaultItemPresent: true,
  githubRepository: "velt-design/sanctuary",
  githubPermissions: {
    contents: "write",
    metadata: "read",
    pull_requests: "write",
  },
};

describe("Mac machine credential gate", () => {
  it("passes the exact least-privilege contract", () => {
    expect(evaluateMachineCredentialEvidence(passingEvidence).passed).toBe(
      true,
    );
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
      githubPermissions: {
        ...passingEvidence.githubPermissions,
        workflows: "write",
      },
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

    expect(Object.keys(report)).toEqual([
      "schemaVersion",
      "gate",
      "passed",
      "checks",
    ]);
    expect(report).not.toHaveProperty("credentials");
  });

  it("reads the standard 1Password login fields without exposing them", () => {
    expect(
      readGitHubVaultFields([
        { id: "username", label: "username", value: "app" },
        { id: "password", label: "password", value: "private" },
        {
          id: "installation_id",
          label: "installation_id",
          value: "installation",
        },
      ]),
    ).toEqual({
      appId: "app",
      installationId: "installation",
      privateKey: "private",
    });
  });

  it("keeps the service token inside the selected OpenClaw state", () => {
    expect(
      resolveMachineServiceTokenPath(
        { OPENCLAW_STATE_DIR: "/tmp/sanctuary-engineering" },
        "/Users/example",
      ).replaceAll("\\", "/"),
    ).toBe(
      "/tmp/sanctuary-engineering/credentials/onepassword/service-account-token",
    );
    expect(
      resolveMachineServiceTokenPath({}, "/Users/example").replaceAll(
        "\\",
        "/",
      ),
    ).toBe(
      "/Users/example/.openclaw/credentials/onepassword/service-account-token",
    );
  });
});
