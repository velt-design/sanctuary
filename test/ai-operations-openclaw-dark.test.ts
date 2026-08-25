import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildDarkPreparationRecord,
  parseBackupDeferral,
} from "../scripts/ai/mac-openclaw-dark-install.mjs";

const config = JSON.parse(
  readFileSync(resolve("infra/openclaw/dark/openclaw.json"), "utf8"),
);
const approvals = JSON.parse(
  readFileSync(resolve("infra/openclaw/dark/exec-approvals.json"), "utf8"),
);
const release = JSON.parse(
  readFileSync(resolve("infra/openclaw/dark/openclaw-release.json"), "utf8"),
);

describe("OpenClaw dark configuration", () => {
  it("binds an authenticated gateway only to loopback", () => {
    expect(config.gateway).toMatchObject({
      mode: "local",
      bind: "loopback",
      auth: {
        mode: "token",
        token: "${OPENCLAW_GATEWAY_TOKEN}",
        allowTailscale: false,
      },
      tailscale: { mode: "off" },
      controlUi: { enabled: false },
      terminal: { enabled: false },
    });
  });

  it("uses a rootless-compatible, networkless, read-only Podman sandbox", () => {
    expect(config.agents.defaults.sandbox).toMatchObject({
      mode: "all",
      backend: "podman",
      scope: "session",
      workspaceAccess: "ro",
      docker: {
        user: "1000:1000",
        readOnlyRoot: true,
        network: "none",
        capDrop: ["ALL"],
        binds: [],
      },
      browser: { enabled: false },
    });
  });

  it("denies every tool and both host execution policy layers", () => {
    expect(config.tools).toMatchObject({
      profile: "minimal",
      deny: ["*"],
      exec: {
        host: "gateway",
        mode: "deny",
      },
      elevated: { enabled: false },
    });
    expect(approvals.defaults).toEqual({
      security: "deny",
      ask: "off",
      askFallback: "deny",
      autoAllowSkills: false,
    });
  });

  it("enables no provider, channel, hook, plugin, ACP, or browser surface", () => {
    expect(config.models).toMatchObject({ mode: "replace", providers: {} });
    expect(config.channels).toEqual({});
    expect(config.hooks.enabled).toBe(false);
    expect(config.plugins.allow).toEqual([]);
    expect(config.acp.enabled).toBe(false);
    expect(config.browser.enabled).toBe(false);
    expect(config.update.checkOnStart).toBe(false);
  });

  it("pins the package version and registry integrity", () => {
    expect(release).toMatchObject({
      package: "openclaw",
      version: "2026.7.1-2",
      integrity:
        "sha512-ycF3yPcbjN6bUPeaUx6Mh6vze1hQWoD3CT/wWcmD7a8xaHHHRUaAlaq+lFxMHf1ssEgODVAwjlzYqp2twkYZ7g==",
    });
  });

  it("contains no plaintext credential", () => {
    const serialized = JSON.stringify(config);

    expect(serialized).not.toMatch(
      /(?:ghp_|github_pat_|sk-[A-Za-z0-9]|ops_[A-Za-z0-9])/,
    );
    expect(serialized).not.toContain("OPENAI_API_KEY");
  });

  it("allows only a short, future backup deferral", () => {
    const now = new Date("2026-08-25T03:00:00Z");

    expect(parseBackupDeferral("2026-09-25", now)).toBe("2026-09-25");
    expect(() => parseBackupDeferral("2026-08-25", now)).toThrow(/after today/);
    expect(() => parseBackupDeferral("2026-09-26", now)).toThrow(
      /cannot exceed 31 days/,
    );
    expect(() => parseBackupDeferral("25-09-2026", now)).toThrow(/YYYY-MM-DD/);
  });

  it("records preparation without pretending backup or activation passed", () => {
    const record = buildDarkPreparationRecord({
      backupDeferredUntil: "2026-09-25",
      preparedAt: new Date("2026-08-25T03:00:00Z"),
    });

    expect(record).toMatchObject({
      state: "prepared-dark",
      activationAllowed: false,
      backupGate: "deferred-not-passed",
      backupDeferredUntil: "2026-09-25",
    });
    expect(record.prohibitions).toEqual(
      expect.arrayContaining([
        "gateway-start",
        "launch-agent",
        "staging-access",
        "production-access",
        "customer-data",
      ]),
    );
  });
});
