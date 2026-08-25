import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CODEX_PLUGIN_SPEC,
  ENGINEERING_AGENT_IDS,
  ENGINEERING_GATEWAY_PORT,
  ENGINEERING_PROFILE,
  buildActivationRecord,
  buildGitHubWrapper,
  buildOpenClawWrapper,
  resolveEngineeringRuntimePaths,
} from "../scripts/ai/openclaw-engineering-runtime.mjs";

const config = JSON.parse(
  readFileSync(resolve("infra/openclaw/engineering/openclaw.json"), "utf8"),
);
const approvals = JSON.parse(
  readFileSync(
    resolve("infra/openclaw/engineering/exec-approvals.json"),
    "utf8",
  ),
);
const activationSource = readFileSync(
  resolve("scripts/ai/mac-openclaw-engineering-activate.mjs"),
  "utf8",
);
const startSource = readFileSync(
  resolve("scripts/ai/mac-openclaw-engineering-start.mjs"),
  "utf8",
);
const agentsById = Object.fromEntries(
  config.agents.list.map((agent: { id: string }) => [agent.id, agent]),
);

const portablePath = (value: string) => value.replaceAll("\\", "/");

describe("isolated OpenClaw engineering runtime", () => {
  it("uses an explicit fleet on a dedicated state, port, and workspace root", () => {
    const paths = resolveEngineeringRuntimePaths({
      home: "/Users/sanctuary-runner",
      repoRoot: "/repo",
    });

    expect(ENGINEERING_PROFILE).toBe("sanctuary-engineering");
    expect(ENGINEERING_GATEWAY_PORT).toBe(19011);
    expect(portablePath(paths.stateDir)).toBe(
      "/Users/sanctuary-runner/.openclaw-sanctuary-engineering",
    );
    expect(portablePath(paths.configPath)).not.toBe(
      "/Users/sanctuary-runner/.openclaw/openclaw.json",
    );
    expect(portablePath(paths.approvalsPath)).toBe(
      "/Users/sanctuary-runner/.openclaw-sanctuary-engineering/exec-approvals.json",
    );
    expect(config.gateway).toMatchObject({
      port: ENGINEERING_GATEWAY_PORT,
      bind: "loopback",
      reload: { mode: "off" },
      auth: {
        token: {
          source: "env",
          provider: "default",
          id: "OPENCLAW_GATEWAY_TOKEN",
        },
      },
    });
    expect(config.agents.list.map((agent: { id: string }) => agent.id)).toEqual(
      ENGINEERING_AGENT_IDS,
    );
    expect(
      config.agents.list
        .filter((agent: { default?: boolean }) => agent.default)
        .map((agent: { id: string }) => agent.id),
    ).toEqual(["sanctuary-engineering-supervisor"]);
  });

  it("gives only the lead the bounded delegation surface", () => {
    const lead = agentsById["sanctuary-engineering-supervisor"];

    expect(lead.tools.profile).toBe("minimal");
    expect(lead.tools.alsoAllow).toEqual(
      expect.arrayContaining([
        "read",
        "agents_list",
        "sessions_spawn",
        "sessions_yield",
        "sessions_history",
      ]),
    );
    expect(lead.tools.alsoAllow).not.toEqual(
      expect.arrayContaining(["exec", "write", "edit", "apply_patch"]),
    );
    expect(lead.subagents).toMatchObject({
      allowAgents: ["sanctuary-coding-worker", "sanctuary-code-reviewer"],
      requireAgentId: true,
    });
    expect(config.agents.defaults.subagents).toMatchObject({
      maxSpawnDepth: 1,
      maxChildrenPerAgent: 1,
      maxConcurrent: 1,
      requireAgentId: true,
    });
  });

  it("keeps no-prompt coding authority on the worker only", () => {
    const worker = agentsById["sanctuary-coding-worker"];
    const reviewer = agentsById["sanctuary-code-reviewer"];

    expect(worker.tools.profile).toBe("coding");
    expect(worker.tools.exec).toMatchObject({
      host: "gateway",
      mode: "full",
      applyPatch: { enabled: true, workspaceOnly: true },
    });
    expect(worker.subagents).toMatchObject({
      allowAgents: [],
      requireAgentId: true,
    });
    expect(reviewer.tools).toMatchObject({
      profile: "minimal",
      alsoAllow: ["read"],
      elevated: { enabled: false },
    });
    expect(config.tools.exec).toMatchObject({
      host: "gateway",
      mode: "deny",
    });
    expect(approvals.agents).toMatchObject({
      "sanctuary-engineering-supervisor": {
        security: "deny",
        ask: "off",
        askFallback: "deny",
      },
      "sanctuary-coding-worker": {
        security: "full",
        ask: "off",
        askFallback: "full",
      },
      "sanctuary-code-reviewer": {
        security: "deny",
        ask: "off",
        askFallback: "deny",
      },
    });
  });

  it("pins the isolated Codex harness and disables unrelated surfaces", () => {
    expect(config.agents.defaults).toMatchObject({
      model: "openai/gpt-5.6-sol",
      models: {
        "openai/gpt-5.6-sol": { agentRuntime: { id: "codex" } },
      },
      maxConcurrent: 1,
      sandbox: { mode: "off" },
    });
    expect(config.plugins).toMatchObject({
      allow: ["codex"],
      entries: {
        codex: {
          enabled: true,
          config: {
            appServer: {
              mode: "yolo",
              homeScope: "agent",
              approvalPolicy: "never",
              sandbox: "danger-full-access",
              clearEnv: ["CODEX_API_KEY", "OPENAI_API_KEY"],
            },
          },
        },
      },
    });
    expect(config.plugins.entries.codex.config).not.toHaveProperty(
      "sessionCatalog",
    );
    expect(config.plugins.entries.codex.config).not.toHaveProperty(
      "supervision",
    );
    expect(config).toMatchObject({
      browser: { enabled: false },
      channels: {},
      hooks: { enabled: false },
      cron: { enabled: false, triggers: { enabled: false } },
      acp: { enabled: false },
      discovery: { mdns: { mode: "off" } },
    });
  });

  it("builds isolated wrappers without embedding credentials", () => {
    const paths = resolveEngineeringRuntimePaths({
      home: "/Users/sanctuary-runner",
      repoRoot: "/repo",
    });
    const openclawWrapper = buildOpenClawWrapper(paths);
    const githubWrapper = buildGitHubWrapper(paths, "/usr/local/bin/node");

    for (const wrapper of [openclawWrapper, githubWrapper]) {
      expect(portablePath(wrapper)).toContain(
        "OPENCLAW_STATE_DIR='/Users/sanctuary-runner/.openclaw-sanctuary-engineering'",
      );
      expect(wrapper).not.toMatch(
        /(?:ghp_|github_pat_|sk-[A-Za-z0-9]|ops_[A-Za-z0-9])/,
      );
    }
    expect(githubWrapper).toContain("GH_PROMPT_DISABLED=1");
    expect(githubWrapper).toContain("GIT_TERMINAL_PROMPT=0");
  });

  it("records drift-detectable activation without claiming shared-state mutation", () => {
    const paths = resolveEngineeringRuntimePaths({
      home: "/Users/sanctuary-runner",
      repoRoot: resolve("."),
    });
    const record = buildActivationRecord(
      paths,
      new Date("2026-08-26T00:00:00.000Z"),
    );

    expect(record).toMatchObject({
      state: "engineering-runtime-configured",
      profile: ENGINEERING_PROFILE,
      gatewayPort: ENGINEERING_GATEWAY_PORT,
      agents: ENGINEERING_AGENT_IDS,
      maxWorkers: 1,
      approvalMode: "worker-full-no-prompts",
      sharedDefaultStateTouched: false,
    });
    expect(record.configHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Object.values(record.agentInstructionHashes)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^sha256:[0-9a-f]{64}$/)]),
    );
  });

  it("preseeds approvals, pins the official plugin, and starts separately", () => {
    expect(CODEX_PLUGIN_SPEC).toBe("@openclaw/codex@2026.7.1-1");
    expect(activationSource.indexOf("prepareApprovals();")).toBeLessThan(
      activationSource.lastIndexOf('runOpenClaw(["config", "validate"]'),
    );
    expect(activationSource).toContain('["approvals", "set", "--file"');
    expect(activationSource).toContain(
      '["plugins", "install", "--pin", CODEX_PLUGIN_SPEC]',
    );
    expect(activationSource).toContain('["plugins", "doctor"]');
    expect(activationSource).toContain('"--post-upgrade"');
    expect(activationSource).toContain(
      '"core/doctor/configured-plugin-installs"',
    );
    expect(activationSource).toContain("assertDefaultAuthorityUnchanged");
    expect(startSource).toContain('"/usr/bin/caffeinate"');
    expect(startSource).toContain('["gateway", "health"]');
    expect(startSource).toContain("detached: true");
  });
});
