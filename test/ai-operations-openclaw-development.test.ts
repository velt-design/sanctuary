import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(resolve("infra/openclaw/development/openclaw.json"), "utf8"),
);
const approvals = JSON.parse(
  readFileSync(
    resolve("infra/openclaw/development/exec-approvals.json"),
    "utf8",
  ),
);
const headlessLauncher = readFileSync(
  resolve("scripts/ai/mac-openclaw-headless-start.mjs"),
  "utf8",
);

describe("OpenClaw development configuration", () => {
  it("selects the Codex coding runtime and Sanctuary workspace", () => {
    expect(config.agents.defaults).toMatchObject({
      workspace: "/Users/sanctuary-runner/workspaces/sanctuary",
      skipBootstrap: true,
      model: "openai/gpt-5.6-sol",
      sandbox: { mode: "off" },
    });
    expect(config.plugins).toMatchObject({
      allow: ["codex"],
      entries: {
        codex: {
          enabled: true,
          config: {
            appServer: {
              approvalPolicy: "never",
              sandbox: "danger-full-access",
            },
          },
        },
      },
    });
  });

  it("runs coding work without approval prompts", () => {
    expect(config.tools).toMatchObject({
      profile: "coding",
      exec: {
        host: "gateway",
        mode: "full",
        applyPatch: { enabled: true, workspaceOnly: true },
      },
      elevated: { enabled: false },
    });
    expect(approvals.defaults).toMatchObject({
      security: "full",
      ask: "off",
      askFallback: "full",
    });
  });

  it("keeps remote control and production-facing surfaces disabled", () => {
    expect(config.gateway).toMatchObject({
      bind: "loopback",
      controlUi: { enabled: false },
      terminal: { enabled: false },
      tailscale: { mode: "off" },
    });
    expect(config).toMatchObject({
      browser: { enabled: false },
      channels: {},
      hooks: { enabled: false },
      acp: { enabled: false },
    });
  });

  it("supports a headless, sleep-resistant gateway process", () => {
    expect(headlessLauncher).toContain('"/usr/bin/caffeinate"');
    expect(headlessLauncher).toContain("detached: true");
    expect(headlessLauncher).toContain('["gateway", "health"]');
  });
});
