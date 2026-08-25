import { describe, expect, it } from "vitest";

import { evaluateBackupRestoreEvidence } from "../scripts/ai/mac-backup-restore-gate.mjs";

const passingEvidence = {
  destinationConfigured: true,
  destinationEncrypted: true,
  latestBackupPresent: true,
  sourceDigest: "same-digest",
  restoredDigest: "same-digest",
};

describe("Mac backup and restore gate", () => {
  it("passes only with an encrypted destination, completed backup, and matching restore", () => {
    expect(evaluateBackupRestoreEvidence(passingEvidence).passed).toBe(true);
  });

  it("fails an unencrypted destination", () => {
    const report = evaluateBackupRestoreEvidence({
      ...passingEvidence,
      destinationEncrypted: false,
    });

    expect(report.passed).toBe(false);
    expect(report.checks.encryption.status).toBe("fail");
  });

  it("fails when no restore comparison was supplied", () => {
    const report = evaluateBackupRestoreEvidence({
      ...passingEvidence,
      sourceDigest: null,
      restoredDigest: null,
    });

    expect(report.passed).toBe(false);
    expect(report.checks.restoreProof.status).toBe("fail");
  });

  it("fails when restored content differs", () => {
    const report = evaluateBackupRestoreEvidence({
      ...passingEvidence,
      restoredDigest: "different-digest",
    });

    expect(report.passed).toBe(false);
    expect(report.checks.restoreProof.status).toBe("fail");
  });

  it("does not expose paths or file digests in its report", () => {
    const report = evaluateBackupRestoreEvidence(passingEvidence);
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain("same-digest");
    expect(serialized).not.toMatch(/(?:source|restored)Path/);
  });
});
