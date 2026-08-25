import { describe, expect, it } from "vitest";

import { evaluateFileVaultEvidence } from "../scripts/ai/mac-filevault-gate.mjs";

const passingEvidence = {
  architecture: "arm64",
  fileVaultStatus: "FileVault is On.",
  automaticUpdateStatus: "Automatic checking for updates is on",
  firewallStatus: "Firewall is enabled. (State = 1)",
  stealthModeStatus: "Firewall stealth mode is on",
  autoLoginUser: null,
  groups: "staff everyone localaccounts",
};

describe("Mac FileVault gate", () => {
  it("passes only the observable machine controls", () => {
    const report = evaluateFileVaultEvidence(passingEvidence);

    expect(report.passed).toBe(true);
    expect(report.manualAttestations.recoveryKeyCustody.status).toBe("unknown");
  });

  it("fails while FileVault is off", () => {
    const report = evaluateFileVaultEvidence({
      ...passingEvidence,
      fileVaultStatus: "FileVault is Off.",
    });

    expect(report.passed).toBe(false);
    expect(report.checks.fileVault.status).toBe("fail");
  });

  it("accepts the wording used by current macOS for scheduled updates", () => {
    const report = evaluateFileVaultEvidence({
      ...passingEvidence,
      automaticUpdateStatus: "Automatic checking for updates is turned on",
    });

    expect(report.checks.automaticUpdateChecks.status).toBe("pass");
  });

  it("fails an administrator runtime account", () => {
    const report = evaluateFileVaultEvidence({
      ...passingEvidence,
      groups: "staff admin everyone",
    });

    expect(report.passed).toBe(false);
    expect(report.checks.runnerPrivilege.status).toBe("fail");
  });

  it("does not include a recovery key field", () => {
    const report = evaluateFileVaultEvidence(passingEvidence);

    expect(JSON.stringify(report)).not.toMatch(/recoveryKey["']?\s*:/i);
  });
});
