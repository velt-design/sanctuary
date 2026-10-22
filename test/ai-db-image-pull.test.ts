// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { pullAiDatabaseImage } from "../scripts/ci/pull-ai-db-image.mjs";

const image = "public.ecr.aws/supabase/postgres@sha256:1e6caa31ec3acaf07fc9cd2e860aba029b26ff212f66731df7a0bde10be3e721";
const success = { status: 0, stdout: "Downloaded", stderr: "" };
const throttle = { status: 1, stdout: "", stderr: "Error response from daemon: toomanyrequests: Rate exceeded\n" };

function fixture(results: object[]) {
  const run = vi.fn();
  for (const result of results) run.mockReturnValueOnce(result);
  const sleep = vi.fn().mockResolvedValue(undefined);
  const log = vi.fn();
  return { run, sleep, log };
}

describe("AI database image pre-pull", () => {
  it("pulls the unchanged image once when successful, without starting a database", async () => {
    const io = fixture([success]);
    await pullAiDatabaseImage(image, io);
    expect(io.run).toHaveBeenCalledExactlyOnceWith("docker", ["pull", image], {
      encoding: "utf8", timeout: 120_000, maxBuffer: 10 * 1024 * 1024,
    });
    expect(io.sleep).not.toHaveBeenCalled();
  });

  it("retries only pull with 30/60s backoff and preserves every failed response", async () => {
    const io = fixture([throttle, throttle, success]);
    await pullAiDatabaseImage(image, io);
    expect(io.run.mock.calls.map((call) => call.slice(0, 2))).toEqual([
      ["docker", ["pull", image]], ["docker", ["pull", image]], ["docker", ["pull", image]],
    ]);
    expect(io.sleep.mock.calls).toEqual([[30_000], [60_000]]);
    expect(io.log.mock.calls.filter(([line]) => line === throttle.stderr.trim())).toHaveLength(2);
  });

  it("fails after three throttled attempts without a fourth pull or final sleep", async () => {
    const io = fixture([throttle, throttle, throttle]);
    await expect(pullAiDatabaseImage(image, io)).rejects.toThrow("attempt 3/3");
    expect(io.run).toHaveBeenCalledTimes(3);
    expect(io.sleep.mock.calls).toEqual([[30_000], [60_000]]);
  });

  it.each(["docker: toomanyrequests: Rate exceeded", "toomanyrequests: Rate exceeded"])(
    "recognizes the exact throttle message with Docker's output prefix: %s", async (stderr) => {
      const io = fixture([{ status: 1, stderr }, success]);
      await pullAiDatabaseImage(image, io);
      expect(io.run).toHaveBeenCalledTimes(2);
      expect(io.sleep.mock.calls).toEqual([[30_000]]);
    },
  );

  it.each([
    "toomanyrequests: retry-after: 769.793µs, allowed: 44000/minute",
    "toomanyrequests: retry-after: 283.837µs, allowed: 44000/minute",
    "docker: Error response from daemon: toomanyrequests: retry-after: 975.847µs, allowed: 44000/minute",
  ])("uses the same bounded backoff for the observed GHCR throttle: %s", async (stderr) => {
    const failure = { status: 1, stdout: "", stderr };
    const io = fixture([failure, failure, success]);
    await pullAiDatabaseImage(image, io);
    expect(io.run).toHaveBeenCalledTimes(3);
    expect(io.run.mock.calls.every(([command, args]) => command === "docker" && args[0] === "pull" && args[1] === image)).toBe(true);
    expect(io.sleep.mock.calls).toEqual([[30_000], [60_000]]);
    expect(io.log.mock.calls.filter(([line]) => line === stderr)).toHaveLength(2);
  });

  it("stops after three GHCR throttles without running the database or a fourth pull", async () => {
    const failure = { status: 1, stderr: "toomanyrequests: retry-after: 769.793µs, allowed: 44000/minute" };
    const io = fixture([failure, failure, failure]);
    await expect(pullAiDatabaseImage(image, io)).rejects.toThrow("attempt 3/3");
    expect(io.run).toHaveBeenCalledTimes(3);
    expect(io.sleep.mock.calls).toEqual([[30_000], [60_000]]);
  });

  it.each([
    "denied: requested access to the resource is denied",
    "manifest unknown",
    "network timeout",
    "toomanyrequests: Other rate limit",
    "prefix toomanyrequests: Rate exceeded suffix",
    "toomanyrequests: retry-after: Infinityµs, allowed: 44000/minute",
    "toomanyrequests: retry-after: -1µs, allowed: 44000/minute",
    "toomanyrequests: retry-after: 1µs, allowed: 0/minute",
    "toomanyrequests: retry-after: 1µs, allowed: unknown/minute",
    "toomanyrequests: retry-after: 1h, allowed: 44000/minute",
    "toomanyrequests: retry-after: 1µs, allowed: 44000/minute suffix",
  ])("does not retry another failure: %s", async (stderr) => {
    const io = fixture([{ status: 1, stdout: "", stderr }]);
    await expect(pullAiDatabaseImage(image, io)).rejects.toThrow("attempt 1/3");
    expect(io.run).toHaveBeenCalledTimes(1);
    expect(io.sleep).not.toHaveBeenCalled();
  });

  it("stops immediately if a later pull fails for a different reason", async () => {
    const io = fixture([throttle, { status: 1, stderr: "denied" }]);
    await expect(pullAiDatabaseImage(image, io)).rejects.toThrow("attempt 2/3");
    expect(io.run).toHaveBeenCalledTimes(2);
    expect(io.sleep.mock.calls).toEqual([[30_000]]);
  });

  it.each([new Error("spawn docker ENOENT"), new Error("spawn docker ETIMEDOUT")])(
    "does not retry a process error even when output includes throttling: %s", async (error) => {
      const io = fixture([{ ...throttle, status: null, error }]);
      await expect(pullAiDatabaseImage(image, io)).rejects.toThrow(error.message);
      expect(io.run).toHaveBeenCalledTimes(1);
      expect(io.sleep).not.toHaveBeenCalled();
    },
  );

  it("rejects missing image configuration without running a command", async () => {
    const io = fixture([]);
    await expect(pullAiDatabaseImage(undefined, io)).rejects.toThrow("is required");
    expect(io.run).not.toHaveBeenCalled();
  });

  it("does not retry a terminated pull even when it printed a throttle message", async () => {
    const io = fixture([{ ...throttle, status: null, signal: "SIGTERM" }]);
    await expect(pullAiDatabaseImage(image, io)).rejects.toThrow("attempt 1/3");
    expect(io.run).toHaveBeenCalledTimes(1);
    expect(io.sleep).not.toHaveBeenCalled();
  });

  it("keeps pre-pull before one ordinary harness step, with no workflow retry or failure bypass", () => {
    const workflow = readFileSync(".github/workflows/ai-foundation.yml", "utf8");
    const databaseJob = workflow.slice(workflow.indexOf("  database-contract:"));
    expect(databaseJob).toContain(`image: "${image}"`);
    const backgroundJob = readFileSync(".github/workflows/background-jobs.yml", "utf8");
    expect(backgroundJob).toContain(`image: "${image}"`);
    expect(backgroundJob).toContain('pgmq_version: "1.5.1"');
    expect(databaseJob).toMatch(/run: node scripts\/ci\/pull-ai-db-image\.mjs\s+- name: Exact-file rollback and executable database contract\s+run: npm run test:ai:db/);
    expect(databaseJob.match(/run: npm run test:ai:db/g)).toHaveLength(1);
    expect(databaseJob).not.toMatch(/continue-on-error|always\(\)|retry|while |until /);
    const backgroundDatabaseJob = backgroundJob.slice(backgroundJob.indexOf("  database-contract:"));
    expect(backgroundDatabaseJob).toMatch(/name: Pull database image with bounded throttle recovery\s+env:\s+AI_TASK_LEDGER_DB_IMAGE: \$\{\{ matrix.image \}\}\s+run: node scripts\/ci\/pull-ai-db-image\.mjs\s+- name: Isolated logged-PGMQ database contract\s+run: npm run test:jobs:db/);
    expect(backgroundDatabaseJob.match(/run: npm run test:jobs:db/g)).toHaveLength(1);
    expect(backgroundDatabaseJob.match(/run: node scripts\/test-xero-payment-concurrency\.mjs/g)).toHaveLength(1);
    expect(backgroundDatabaseJob).not.toMatch(/continue-on-error|always\(\)|retry|while |until /);
    expect(backgroundJob.match(/- "scripts\/ci\/pull-ai-db-image\.mjs"/g)).toHaveLength(2);
    expect(backgroundJob.match(/- "test\/ai-db-image-pull\.test\.ts"/g)).toHaveLength(2);
  });
});
