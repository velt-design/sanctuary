import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const throttleLine = /^(?:docker: |Error response from daemon: )?toomanyrequests: Rate exceeded$/;
const backoffMs = [30_000, 60_000];

// Pull only: database startup and SQL remain in the subsequent, single-run harness.
export async function pullAiDatabaseImage(image, {
  run = spawnSync,
  sleep = delay,
  log = (message) => process.stdout.write(`${message}\n`),
} = {}) {
  if (!image?.trim()) throw new Error("AI_TASK_LEDGER_DB_IMAGE is required.");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    log(`AI database image pull attempt ${attempt}/3: ${image}`);
    const result = run("docker", ["pull", image], {
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    if (output) log(output);
    if (result.error) throw new Error(`AI database image pull could not complete: ${result.error.message}`);
    if (result.status === 0) return;

    const throttled = output.split(/\r?\n/).some((line) => throttleLine.test(line));
    if (!throttled || result.status === null || attempt === 3) {
      throw new Error(`AI database image pull failed on attempt ${attempt}/3 (exit ${result.status}).`);
    }
    const waitMs = backoffMs[attempt - 1];
    log(`Registry reported toomanyrequests: Rate exceeded; retrying pull in ${waitMs / 1000}s.`);
    await sleep(waitMs);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await pullAiDatabaseImage(process.env.AI_TASK_LEDGER_DB_IMAGE);
}
