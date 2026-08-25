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
      entries: { codex: { enabled: true } },
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
});
