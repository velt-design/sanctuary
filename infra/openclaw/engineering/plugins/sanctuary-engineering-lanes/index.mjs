import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import {
  cleanupEngineeringLane,
  provisionEngineeringLane,
  publishEngineeringLane,
  statusEngineeringLane,
} from "./lane-runtime.mjs";

const taskIdentityProperties = {
  taskId: {
    type: "string",
    pattern: "^eng_[0-9]{8}_[a-z0-9][a-z0-9_-]{2,63}$",
  },
  manifestHash: {
    type: "string",
    pattern: "^sha256:[0-9a-f]{64}$",
  },
};

function jsonToolResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    details: value,
  };
}

export default definePluginEntry({
  id: "sanctuary-engineering-lanes",
  name: "Sanctuary Engineering Lanes",
  description:
    "Manifest-bound worktree, draft-PR, and cleanup operations for Sanctuary engineering.",
  register(api) {
    api.registerTool(
      {
        name: "sanctuary_engineering_lane_provision",
        description:
          "Validate one approved Sanctuary engineering manifest and provision or resume its exact isolated Git worktree.",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["manifest"],
          properties: {
            manifest: { type: "object" },
          },
        },
        async execute(_id, params) {
          return jsonToolResult(provisionEngineeringLane(params.manifest));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "sanctuary_engineering_lane_status",
        description:
          "Read the exact branch, head, cleanliness, changed paths, and draft-PR state for one bound engineering lane.",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["taskId", "manifestHash"],
          properties: taskIdentityProperties,
        },
        async execute(_id, params) {
          return jsonToolResult(
            statusEngineeringLane(params.taskId, params.manifestHash),
          );
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "sanctuary_engineering_lane_publish",
        description:
          "Push only the bound feature branch and create or confirm its exact open draft pull request after ownership and cleanliness checks pass.",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["taskId", "manifestHash", "title", "body"],
          properties: {
            ...taskIdentityProperties,
            title: { type: "string", minLength: 5, maxLength: 200 },
            body: { type: "string", minLength: 20, maxLength: 30000 },
          },
        },
        async execute(_id, params) {
          return jsonToolResult(publishEngineeringLane(params));
        },
      },
      { optional: true },
    );

    api.registerTool(
      {
        name: "sanctuary_engineering_lane_cleanup",
        description:
          "Remove only a clean, pushed worktree with a recorded open draft PR; retain its local and remote feature branches.",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["taskId", "manifestHash"],
          properties: taskIdentityProperties,
        },
        async execute(_id, params) {
          return jsonToolResult(
            cleanupEngineeringLane(params.taskId, params.manifestHash),
          );
        },
      },
      { optional: true },
    );
  },
});
