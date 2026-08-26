// @vitest-environment node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const CLI = resolve("node_modules/tsx/dist/cli.mjs");
const SCRIPT = resolve("scripts/ai/engineering-contract.ts");
const TASK = resolve("infra/openclaw/engineering/task.example.json");
const COMPLETION = resolve(
  "infra/openclaw/engineering/completion.example.json",
);
const temporaryDirectories: string[] = [];

function run(command: string, path: string) {
  return spawnSync(process.execPath, [CLI, SCRIPT, command, path], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("engineering contract CLI", () => {
  it("validates and identifies the canonical task", () => {
    const result = run("validate-task", TASK);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      valid: true,
      schema: "sanctuary-engineering-task-v1",
      taskId: "eng_20260826_foundation_contracts",
      branch: "ai/autonomy-foundation-contracts",
      manifestHash:
        "sha256:3a5de0bcc30bc5877c72b8149c15a2ed5bda64e34c568dcd6d059dbbe2e7def4",
    });
  });

  it("renders a worker prompt from the validated task", () => {
    const result = run("render-worker-prompt", TASK);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("# Sanctuary Coding Worker Task");
    expect(result.stdout).toContain(
      "The JSON manifest below is the complete authority",
    );
    expect(result.stdout).toContain('"merge": "human_required"');
    expect(result.stdout).toContain('"production": "prohibited"');
  });

  it("returns the canonical manifest and identity for runtime binding", () => {
    const result = run("resolve-task", TASK);
    expect(result.status).toBe(0);
    const resolved = JSON.parse(result.stdout);
    expect(resolved.manifest).toMatchObject({
      schema: "sanctuary-engineering-task-v1",
      taskId: "eng_20260826_foundation_contracts",
      branch: "ai/autonomy-foundation-contracts",
    });
    expect(resolved.manifestHash).toBe(
      "sha256:3a5de0bcc30bc5877c72b8149c15a2ed5bda64e34c568dcd6d059dbbe2e7def4",
    );
  });

  it("validates the canonical completion report", () => {
    const result = run("validate-completion", COMPLETION);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      valid: true,
      schema: "sanctuary-engineering-completion-v1",
      taskId: "eng_20260826_foundation_contracts",
      outcome: "succeeded",
      pullRequest: "https://github.com/velt-design/sanctuary/pull/73",
    });
  });

  it("fails closed when task authority changes to main", () => {
    const directory = mkdtempSync(
      join(tmpdir(), "sanctuary-engineering-contract-"),
    );
    temporaryDirectories.push(directory);
    const task = JSON.parse(readFileSync(TASK, "utf8")) as Record<
      string,
      unknown
    >;
    task.branch = "main";
    const path = join(directory, "unsafe-task.json");
    writeFileSync(path, JSON.stringify(task), "utf8");

    const result = run("validate-task", path);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid Sanctuary AI contract");
    expect(result.stdout).toBe("");
  });
});
