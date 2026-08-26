import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  cleanupEngineeringLane,
  provisionEngineeringLane,
  publishEngineeringLane,
  statusEngineeringLane,
} from "../../infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/lane-runtime.mjs";

function usage() {
  throw new Error(
    "Usage: node scripts/ai/engineering-lane.mjs " +
      "<provision MANIFEST_JSON | status TASK_ID MANIFEST_HASH | " +
      "publish TASK_ID MANIFEST_HASH --title TITLE --body-file PATH | " +
      "cleanup TASK_ID MANIFEST_HASH>",
  );
}

function flagValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) usage();
  return process.argv[index + 1];
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read manifest JSON: ${error.message}`);
  }
}

function main() {
  const command = process.argv[2];
  let result;
  if (command === "provision" && process.argv[3]) {
    result = provisionEngineeringLane(readJson(process.argv[3]));
  } else if (command === "status" && process.argv[3] && process.argv[4]) {
    result = statusEngineeringLane(process.argv[3], process.argv[4]);
  } else if (command === "publish" && process.argv[3] && process.argv[4]) {
    result = publishEngineeringLane({
      taskId: process.argv[3],
      manifestHash: process.argv[4],
      title: flagValue("--title"),
      body: readFileSync(flagValue("--body-file"), "utf8"),
    });
  } else if (command === "cleanup" && process.argv[3] && process.argv[4]) {
    result = cleanupEngineeringLane(process.argv[3], process.argv[4]);
  } else {
    usage();
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`Engineering lane: ERROR — ${error.message}`);
    process.exitCode = 1;
  }
}
