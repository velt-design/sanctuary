import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CODEX_PLUGIN_SPEC,
  ENGINEERING_AGENT_IDS,
  ENGINEERING_GATEWAY_PORT,
  ENGINEERING_PROFILE,
  LANE_PLUGIN_ID,
  LANE_PLUGIN_VERSION,
  buildActivationRecord,
  buildEngineeringLaneWrapper,
  buildGitHubWrapper,
  buildOpenClawWrapper,
  resolveEngineeringRuntimePaths,
} from "../scripts/ai/openclaw-engineering-runtime.mjs";
import {
  inspectEngineeringGatewayProcess,
  parseEngineeringGatewayPid,
  stopEngineeringGateway,
} from "../scripts/ai/mac-openclaw-engineering-stop.mjs";
import {
  OVERSIGHT_ALLOWED_TOOLS,
  REVIEW_DIFF_REGISTRATION_AGENTS,
  enforceOversightToolPolicy,
} from "../infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/oversight-tool-policy.mjs";

const config = JSON.parse(
  readFileSync(resolve("infra/openclaw/engineering/openclaw.json"), "utf8"),
);
const approvals = JSON.parse(
  readFileSync(
    resolve("infra/openclaw/engineering/exec-approvals.json"),
    "utf8",
  ),
);
const lanePluginPackage = JSON.parse(
  readFileSync(
    resolve(
      "infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/package.json",
    ),
    "utf8",
  ),
);
const lanePluginManifest = JSON.parse(
  readFileSync(
    resolve(
      "infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/openclaw.plugin.json",
    ),
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
const stopSource = readFileSync(
  resolve("scripts/ai/mac-openclaw-engineering-stop.mjs"),
  "utf8",
);
const supervisorInstructions = readFileSync(
  resolve("infra/openclaw/engineering/agents/supervisor/AGENTS.md"),
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
        "session_status",
        "read",
        "agents_list",
        "sessions_spawn",
        "sessions_yield",
        "sessions_history",
        "sanctuary_engineering_lane_status",
        "sanctuary_engineering_lane_cleanup",
        "sanctuary_engineering_supervision_enqueue",
        "sanctuary_engineering_supervision_claim",
        "sanctuary_engineering_supervision_attach",
        "sanctuary_engineering_supervision_reconcile",
        "sanctuary_engineering_supervision_recover",
        "sanctuary_engineering_supervision_status",
      ]),
    );
    expect(lead.tools.alsoAllow).not.toContain(
      "sanctuary_engineering_lane_provision",
    );
    expect(lead.tools.alsoAllow).not.toEqual(
      expect.arrayContaining(["exec", "write", "edit", "apply_patch"]),
    );
    expect(lead.tools.byProvider["openai/gpt-5.6-sol"].allow).toEqual(
      lead.tools.alsoAllow,
    );
    expect(lead.tools.exec).toMatchObject({
      host: "gateway",
      mode: "auto",
    });
    expect(lead.tools.deny).toEqual(
      expect.arrayContaining([
        "exec",
        "process",
        "write",
        "edit",
        "apply_patch",
      ]),
    );
    expect(lead.subagents).toMatchObject({
      allowAgents: ["sanctuary-coding-worker", "sanctuary-code-reviewer"],
      requireAgentId: true,
    });
    expect(supervisorInstructions).toContain(
      "explicit session label can collide with a retained recovery session",
    );
    expect(supervisorInstructions).toContain(
      "sanctuary_engineering_supervision_recover",
    );
    expect(supervisorInstructions).toContain("timeoutMs: 180000");
    expect(config.agents.defaults.subagents).toMatchObject({
      maxSpawnDepth: 1,
      maxChildrenPerAgent: 1,
      maxConcurrent: 1,
      requireAgentId: true,
    });
    expect(config.tools.agentToAgent).toEqual({
      enabled: true,
      allow: ENGINEERING_AGENT_IDS,
    });
    expect(config.tools.sessions).toEqual({ visibility: "all" });
  });

  it("keeps no-prompt coding authority on the worker only", () => {
    const worker = agentsById["sanctuary-coding-worker"];
    const reviewer = agentsById["sanctuary-code-reviewer"];

    expect(worker.tools.profile).toBe("coding");
    expect(worker.tools.alsoAllow).toEqual([
      "sanctuary_engineering_lane_status",
      "sanctuary_engineering_lane_publish",
    ]);
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
      alsoAllow: [
        "session_status",
        "read",
        "sanctuary_engineering_lane_status",
        "sanctuary_engineering_review_diff_chunk",
      ],
      byProvider: {
        "openai/gpt-5.6-sol": {
          allow: [
            "session_status",
            "read",
            "sanctuary_engineering_lane_status",
            "sanctuary_engineering_review_diff_chunk",
          ],
        },
      },
      exec: { host: "gateway", mode: "auto" },
      deny: ["exec", "process", "write", "edit", "apply_patch"],
      elevated: { enabled: false },
    });
    expect(config.tools.exec).toMatchObject({
      host: "gateway",
      mode: "deny",
    });
    expect(approvals.agents).toMatchObject({
      "sanctuary-engineering-supervisor": {
        security: "allowlist",
        ask: "on-miss",
        askFallback: "deny",
      },
      "sanctuary-coding-worker": {
        security: "full",
        ask: "off",
        askFallback: "full",
      },
      "sanctuary-code-reviewer": {
        security: "allowlist",
        ask: "on-miss",
        askFallback: "deny",
      },
    });
  });

  it("blocks every unlisted native tool for oversight roles", () => {
    const configuredSupervisorTools =
      agentsById["sanctuary-engineering-supervisor"].tools.alsoAllow;
    const inheritedSupervisorTools = [
      ...OVERSIGHT_ALLOWED_TOOLS["sanctuary-engineering-supervisor"],
      "sanctuary_engineering_lane_publish",
      "sanctuary_engineering_review_diff_chunk",
    ];
    expect(new Set(configuredSupervisorTools)).toEqual(
      new Set(inheritedSupervisorTools),
    );
    expect(configuredSupervisorTools).toHaveLength(
      inheritedSupervisorTools.length,
    );
    expect(OVERSIGHT_ALLOWED_TOOLS["sanctuary-code-reviewer"]).toEqual(
      agentsById["sanctuary-code-reviewer"].tools.alsoAllow,
    );
    expect(REVIEW_DIFF_REGISTRATION_AGENTS).toEqual([
      "sanctuary-engineering-supervisor",
      "sanctuary-code-reviewer",
    ]);
    expect(
      enforceOversightToolPolicy(
        { toolName: "bash" },
        { agentId: "sanctuary-code-reviewer" },
      ),
    ).toMatchObject({ block: true });
    expect(
      enforceOversightToolPolicy(
        { toolName: "apply_patch" },
        { agentId: "sanctuary-engineering-supervisor" },
      ),
    ).toMatchObject({ block: true });
    expect(
      enforceOversightToolPolicy(
        { toolName: "sanctuary_engineering_lane_publish" },
        { agentId: "sanctuary-engineering-supervisor" },
      ),
    ).toMatchObject({ block: true });
    expect(
      enforceOversightToolPolicy(
        { toolName: "sanctuary_engineering_lane_status" },
        { agentId: "sanctuary-code-reviewer" },
      ),
    ).toBeUndefined();
    expect(
      enforceOversightToolPolicy(
        { toolName: "sanctuary_engineering_review_diff_chunk" },
        { agentId: "sanctuary-code-reviewer" },
      ),
    ).toBeUndefined();
    expect(
      enforceOversightToolPolicy(
        { toolName: "sanctuary_engineering_review_diff_chunk" },
        { agentId: "sanctuary-engineering-supervisor" },
      ),
    ).toMatchObject({ block: true });
    expect(
      enforceOversightToolPolicy(
        { toolName: "bash" },
        { agentId: "sanctuary-coding-worker" },
      ),
    ).toBeUndefined();
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
      allow: ["codex", LANE_PLUGIN_ID],
      entries: {
        codex: {
          enabled: true,
          config: {
            codexDynamicToolsLoading: "direct",
            appServer: {
              mode: "yolo",
              homeScope: "agent",
              approvalPolicy: "never",
              sandbox: "danger-full-access",
              clearEnv: ["CODEX_API_KEY", "OPENAI_API_KEY"],
            },
          },
        },
        [LANE_PLUGIN_ID]: {
          enabled: true,
          config: {},
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

  it("declares the reviewed lane plugin as optional narrow tools", () => {
    expect(lanePluginPackage).toMatchObject({
      name: "@sanctuary/openclaw-engineering-lanes",
      version: LANE_PLUGIN_VERSION,
      type: "module",
      openclaw: {
        extensions: ["./index.mjs"],
        compat: { minGatewayVersion: "2026.7.1-2" },
      },
    });
    expect(lanePluginManifest).toMatchObject({
      id: LANE_PLUGIN_ID,
      contracts: {
        tools: [
          "sanctuary_engineering_lane_provision",
          "sanctuary_engineering_lane_status",
          "sanctuary_engineering_lane_publish",
          "sanctuary_engineering_lane_cleanup",
          "sanctuary_engineering_supervision_enqueue",
          "sanctuary_engineering_supervision_claim",
          "sanctuary_engineering_supervision_attach",
          "sanctuary_engineering_supervision_reconcile",
          "sanctuary_engineering_supervision_recover",
          "sanctuary_engineering_supervision_status",
          "sanctuary_engineering_supervision_ci",
          "sanctuary_engineering_review_attach",
          "sanctuary_engineering_review_reconcile",
          "sanctuary_engineering_review_redispatch",
          "sanctuary_engineering_review_diff_chunk",
        ],
      },
    });
    for (const tool of lanePluginManifest.contracts.tools) {
      expect(lanePluginManifest.toolMetadata[tool]).toEqual({
        optional: true,
      });
    }
  });

  it("builds isolated wrappers without embedding credentials", () => {
    const paths = resolveEngineeringRuntimePaths({
      home: "/Users/sanctuary-runner",
      repoRoot: "/repo",
    });
    const openclawWrapper = buildOpenClawWrapper(paths);
    const laneWrapper = buildEngineeringLaneWrapper(
      paths,
      "/usr/local/bin/node",
    );
    const githubWrapper = buildGitHubWrapper(paths, "/usr/local/bin/node");

    for (const wrapper of [openclawWrapper, laneWrapper, githubWrapper]) {
      expect(portablePath(wrapper)).toContain(
        "OPENCLAW_STATE_DIR='/Users/sanctuary-runner/.openclaw-sanctuary-engineering'",
      );
      expect(wrapper).not.toMatch(
        /(?:ghp_|github_pat_|sk-[A-Za-z0-9]|ops_[A-Za-z0-9])/,
      );
    }
    expect(githubWrapper).toContain("GH_PROMPT_DISABLED=1");
    expect(githubWrapper).toContain("GIT_TERMINAL_PROMPT=0");
    expect(githubWrapper).toContain("--safe-gh");
    expect(githubWrapper).not.toContain("--raw");
    expect(laneWrapper).toContain("SANCTUARY_ENGINEERING_REPO_ROOT='/repo'");
    expect(portablePath(laneWrapper)).toContain(
      "'/repo/scripts/ai/engineering-lane.mjs' \"$@\"",
    );
    expect(portablePath(laneWrapper)).toContain(
      "'/Users/sanctuary-runner/bin'",
    );
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
    expect(LANE_PLUGIN_ID).toBe("sanctuary-engineering-lanes");
    expect(LANE_PLUGIN_VERSION).toBe("1.2.19");
    expect(activationSource.indexOf("prepareApprovals();")).toBeLessThan(
      activationSource.lastIndexOf('runOpenClaw(["config", "validate"]'),
    );
    expect(activationSource).toContain('["approvals", "set", "--file"');
    expect(activationSource).toContain(
      '["plugins", "install", "--pin", CODEX_PLUGIN_SPEC]',
    );
    expect(activationSource).toContain(
      '["plugins", "install", "--force", paths.lanePluginSource]',
    );
    expect(activationSource).toContain("buildEngineeringLaneWrapper(paths)");
    expect(activationSource).toContain('["plugins", "doctor"]');
    expect(activationSource).toContain('"--post-upgrade"');
    expect(activationSource).toContain(
      '"core/doctor/configured-plugin-installs"',
    );
    expect(activationSource).toContain('"core/doctor/security"');
    expect(activationSource).toContain('"--severity-min"');
    expect(activationSource).toContain("assertDefaultAuthorityUnchanged");
    expect(activationSource).toContain("One supervisor OpenAI sign-in");
    expect(startSource).toContain('"/usr/bin/caffeinate"');
    expect(startSource).toContain('["gateway", "health"]');
    expect(startSource).toContain("detached: true");
  });

  it("stops only the exact owned gateway process and clears its PID", () => {
    const paths = resolveEngineeringRuntimePaths({
      home: "/Users/sanctuary-runner",
      repoRoot: "/repo",
    });
    const signals: number[] = [];
    const removed: string[] = [];
    let inspected = 0;
    let healthChecks = 0;
    const result = stopEngineeringGateway({
      platform: "darwin",
      paths,
      fileExists: () => true,
      readFile: () => "1234\n",
      readGatewayToken: () => "fixture-token",
      fingerprintAuthority: () => ({ config: "before" }),
      assertAuthorityUnchanged: (_runtimePaths, expected) => {
        expect(expected).toEqual({ config: "before" });
      },
      inspectProcess: () => ({
        running: inspected++ === 0,
        pid: 1234,
      }),
      isHealthy: () => healthChecks++ === 0,
      signal: (pid) => signals.push(pid),
      pause: () => undefined,
      removeFile: (path) => removed.push(path),
    });
    expect(result).toEqual({
      stopped: true,
      alreadyStopped: false,
      pid: 1234,
    });
    expect(signals).toEqual([1234]);
    expect(removed).toEqual([paths.pidPath]);
  });

  it("refuses an unowned live gateway and never uses broad process killing", () => {
    const paths = resolveEngineeringRuntimePaths({
      home: "/Users/sanctuary-runner",
      repoRoot: "/repo",
    });
    expect(() =>
      stopEngineeringGateway({
        platform: "darwin",
        paths,
        fileExists: () => false,
        readGatewayToken: () => "fixture-token",
        fingerprintAuthority: () => ({}),
        assertAuthorityUnchanged: () => undefined,
        isHealthy: () => true,
      }),
    ).toThrow(/PID file is missing/);
    expect(stopSource).not.toMatch(/pkill|killall|SIGKILL/);
  });

  it("validates the PID, owner, process title and isolated listener", () => {
    expect(parseEngineeringGatewayPid("1234\n")).toBe(1234);
    expect(() => parseEngineeringGatewayPid("0")).toThrow(/invalid/);
    expect(() => parseEngineeringGatewayPid("12 other")).toThrow(/invalid/);

    const calls: string[][] = [];
    const state = inspectEngineeringGatewayProcess(1234, {
      currentUser: "sanctuary-runner",
      run: (_binary, args) => {
        calls.push(args);
        return calls.length === 1
          ? { status: 0, stdout: "sanctuary-runner openclaw-gateway\n" }
          : { status: 0, stdout: "listener\n" };
      },
    });
    expect(state).toMatchObject({
      running: true,
      pid: 1234,
      owner: "sanctuary-runner",
      command: "openclaw-gateway",
      port: ENGINEERING_GATEWAY_PORT,
    });
    expect(calls[1]).toContain(`-iTCP:${ENGINEERING_GATEWAY_PORT}`);
  });
});
