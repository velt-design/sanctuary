#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PASS = "pass";
const FAIL = "fail";

function result(status, detail) {
  return { status, detail };
}

export function evaluateBackupRestoreEvidence(evidence) {
  const checks = {
    destination: evidence.destinationConfigured
      ? result(PASS, "A Time Machine destination is configured")
      : result(FAIL, "No Time Machine destination is configured"),
    encryption: evidence.destinationEncrypted
      ? result(PASS, "The mounted Time Machine destination is encrypted")
      : result(FAIL, "Destination encryption is not verified"),
    completedBackup: evidence.latestBackupPresent
      ? result(PASS, "At least one completed Time Machine backup is present")
      : result(FAIL, "No completed Time Machine backup was found"),
    restoreProof:
      evidence.sourceDigest &&
      evidence.restoredDigest &&
      evidence.sourceDigest === evidence.restoredDigest
        ? result(PASS, "The restored sample exactly matches its source")
        : result(FAIL, "A matching restored sample was not provided"),
  };

  return {
    schemaVersion: 1,
    gate: "mac-backup-restore",
    passed: Object.values(checks).every((check) => check.status === PASS),
    checks,
  };
}

function run(command, args = []) {
  const execution = spawnSync(command, args, { encoding: "utf8" });
  return {
    ok: execution.status === 0,
    stdout: execution.stdout.trim(),
    stderr: execution.stderr.trim(),
  };
}

function digestFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a file path.`);
  }
  return value;
}

function collectMacEvidence() {
  if (process.platform !== "darwin") {
    throw new Error("This gate must be run on the Mac mini.");
  }

  const sourcePath = readOption("--source");
  const restoredPath = readOption("--restored");
  if ((sourcePath && !restoredPath) || (!sourcePath && restoredPath)) {
    throw new Error("Use --source and --restored together.");
  }

  const destination = run("/usr/bin/tmutil", ["destinationinfo"]);
  const destinationConfigured =
    destination.ok && !/No destinations configured/i.test(destination.stdout);
  const mountPoint = destination.stdout.match(/^Mount Point\s*:\s*(.+)$/im)?.[1]?.trim();

  let destinationEncrypted = false;
  if (destinationConfigured && mountPoint) {
    const diskInfo = run("/usr/sbin/diskutil", ["info", "-plist", mountPoint]);
    destinationEncrypted =
      diskInfo.ok && /<key>Encrypted<\/key>\s*<true\/>/i.test(diskInfo.stdout);
  }

  const latestBackup = run("/usr/bin/tmutil", ["latestbackup"]);

  return {
    destinationConfigured,
    destinationEncrypted,
    latestBackupPresent: latestBackup.ok && latestBackup.stdout.length > 0,
    sourceDigest: sourcePath ? digestFile(sourcePath) : null,
    restoredDigest: restoredPath ? digestFile(restoredPath) : null,
  };
}

function printHuman(report) {
  console.log(`Mac backup and restore gate: ${report.passed ? "PASS" : "FAIL"}`);
  for (const [name, check] of Object.entries(report.checks)) {
    console.log(`- ${name}: ${check.status.toUpperCase()} — ${check.detail}`);
  }
}

function main() {
  const report = evaluateBackupRestoreEvidence(collectMacEvidence());
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
  process.exitCode = report.passed ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`Mac backup and restore gate: ERROR — ${error.message}`);
    process.exitCode = 2;
  }
}
