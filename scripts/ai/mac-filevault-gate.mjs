import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PASS = "pass";
const FAIL = "fail";
const UNKNOWN = "unknown";

function result(status, detail) {
  return { status, detail };
}

export function evaluateFileVaultEvidence(evidence) {
  const checks = {
    architecture: /^arm64$/i.test(evidence.architecture.trim())
      ? result(PASS, "Apple silicon (arm64)")
      : result(FAIL, `Expected arm64; observed ${evidence.architecture.trim() || "no value"}`),
    fileVault: /FileVault is On/i.test(evidence.fileVaultStatus)
      ? result(PASS, "FileVault is on")
      : /Encryption in progress/i.test(evidence.fileVaultStatus)
        ? result(FAIL, "FileVault encryption is still in progress")
        : result(FAIL, "FileVault is not on"),
    automaticUpdateChecks: /Automatic checking for updates is (?:turned )?on/i.test(
      evidence.automaticUpdateStatus,
    )
      ? result(PASS, "Automatic update checks are on")
      : result(FAIL, "Automatic update checks are not confirmed on"),
    firewall: /enabled|State\s*=\s*1/i.test(evidence.firewallStatus)
      ? result(PASS, "Application firewall is enabled")
      : result(FAIL, "Application firewall is not confirmed enabled"),
    stealthMode: /stealth mode is on/i.test(evidence.stealthModeStatus)
      ? result(PASS, "Firewall stealth mode is on")
      : result(FAIL, "Firewall stealth mode is not confirmed on"),
    automaticLogin:
      evidence.autoLoginUser === null || evidence.autoLoginUser.trim() === ""
        ? result(PASS, "Automatic login is off")
        : result(FAIL, "Automatic login is configured"),
    runnerPrivilege: evidence.groups.split(/\s+/).includes("admin")
      ? result(FAIL, "The runtime account is an administrator")
      : result(PASS, "The runtime account is not an administrator"),
  };

  const passed = Object.values(checks).every((check) => check.status === PASS);

  return {
    schemaVersion: 1,
    gate: "mac-filevault",
    passed,
    checks,
    manualAttestations: {
      recoveryKeyCustody: {
        status: UNKNOWN,
        detail:
          "Confirm separately that the FileVault personal recovery key is in the business vault and one controlled offline location.",
      },
    },
  };
}

function run(command, args = [], { missingValue = "" } = {}) {
  const execution = spawnSync(command, args, { encoding: "utf8" });
  if (execution.status === 0) return execution.stdout.trim();
  if (execution.status === 1 && missingValue !== undefined) return missingValue;

  const diagnostic = (execution.stderr || execution.stdout || "command failed").trim();
  throw new Error(`${command} failed: ${diagnostic}`);
}

function collectMacEvidence() {
  if (process.platform !== "darwin") {
    throw new Error("This gate must be run on the Mac mini.");
  }

  return {
    architecture: run("/usr/bin/uname", ["-m"]),
    fileVaultStatus: run("/usr/bin/fdesetup", ["status"]),
    automaticUpdateStatus: run("/usr/sbin/softwareupdate", ["--schedule"]),
    firewallStatus: run(
      "/usr/libexec/ApplicationFirewall/socketfilterfw",
      ["--getglobalstate"],
    ),
    stealthModeStatus: run(
      "/usr/libexec/ApplicationFirewall/socketfilterfw",
      ["--getstealthmode"],
    ),
    autoLoginUser: run(
      "/usr/bin/defaults",
      ["read", "/Library/Preferences/com.apple.loginwindow", "autoLoginUser"],
      { missingValue: null },
    ),
    groups: run("/usr/bin/id", ["-Gn"]),
  };
}

function printHuman(report) {
  console.log(`Mac FileVault gate: ${report.passed ? "PASS" : "FAIL"}`);
  for (const [name, check] of Object.entries(report.checks)) {
    console.log(`- ${name}: ${check.status.toUpperCase()} — ${check.detail}`);
  }
  console.log(
    `- recoveryKeyCustody: MANUAL — ${report.manualAttestations.recoveryKeyCustody.detail}`,
  );
}

function main() {
  const report = evaluateFileVaultEvidence(collectMacEvidence());
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
    console.error(`Mac FileVault gate: ERROR — ${error.message}`);
    process.exitCode = 2;
  }
}
