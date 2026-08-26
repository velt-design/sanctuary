import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import process from "node:process";
import {
  ENGINEERING_TASK_MANIFEST_SCHEMA_V1,
  parseEngineeringTaskCompletionForManifestV1,
  type EngineeringTaskManifestV1,
} from "../../packages/ai/src/index";

type Command = "validate-task" | "validate-completion" | "render-worker-prompt";

function usage(): never {
  console.error(
    "Usage:\n" +
      "  tsx scripts/ai/engineering-contract.ts validate-task <task-json>\n" +
      "  tsx scripts/ai/engineering-contract.ts render-worker-prompt <task-json>\n" +
      "  tsx scripts/ai/engineering-contract.ts validate-completion " +
      "<task-json> <completion-json>",
  );
  process.exit(2);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Unable to read JSON contract: ${(error as Error).message}`,
    );
  }
}

function canonicalTask(manifest: EngineeringTaskManifestV1): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function manifestHash(manifest: EngineeringTaskManifestV1): string {
  return `sha256:${createHash("sha256").update(canonicalTask(manifest)).digest("hex")}`;
}

function renderWorkerPrompt(manifest: EngineeringTaskManifestV1): string {
  const hash = manifestHash(manifest);
  return `# Sanctuary Coding Worker Task

Manifest hash: \`${hash}\`

The JSON manifest below is the complete authority for this worker run. Read every
\`readFirst\` file before editing. Work only on the exact feature branch and inside
\`ownedPaths\`; do not touch \`excludedPaths\`. Run focused local checks, push only
the feature branch, open a draft pull request, and return a
\`sanctuary-engineering-completion-v1\` report.

Stop and return a blocked completion report if scope must expand, an ownership
boundary is unclear, a dependency is incomplete, a consequential action is
requested, or another manifest stop condition is reached. Never merge, deploy,
contact a customer or staff member, or use production data or credentials.

## Immutable task manifest

\`\`\`json
${canonicalTask(manifest).trimEnd()}
\`\`\`
`;
}

function main(): void {
  const command = process.argv[2] as Command | undefined;
  const taskPath = process.argv[3];
  if (!command || !taskPath) usage();

  if (command === "validate-task") {
    const manifest = ENGINEERING_TASK_MANIFEST_SCHEMA_V1.parse(
      readJson(taskPath),
    );
    console.log(
      JSON.stringify(
        {
          valid: true,
          schema: manifest.schema,
          taskId: manifest.taskId,
          branch: manifest.branch,
          manifestHash: manifestHash(manifest),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (command === "validate-completion") {
    const completionPath = process.argv[4];
    if (!completionPath) usage();
    const manifest = ENGINEERING_TASK_MANIFEST_SCHEMA_V1.parse(
      readJson(taskPath),
    );
    const completion = parseEngineeringTaskCompletionForManifestV1(
      manifest,
      manifestHash(manifest),
      readJson(completionPath),
    );
    console.log(
      JSON.stringify(
        {
          valid: true,
          schema: completion.schema,
          taskId: completion.taskId,
          outcome: completion.outcome,
          pullRequest: completion.pullRequest?.url ?? null,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (command === "render-worker-prompt") {
    const manifest = ENGINEERING_TASK_MANIFEST_SCHEMA_V1.parse(
      readJson(taskPath),
    );
    process.stdout.write(renderWorkerPrompt(manifest));
    return;
  }
  usage();
}

try {
  main();
} catch (error) {
  console.error(`Engineering contract: ERROR - ${(error as Error).message}`);
  process.exitCode = 1;
}
