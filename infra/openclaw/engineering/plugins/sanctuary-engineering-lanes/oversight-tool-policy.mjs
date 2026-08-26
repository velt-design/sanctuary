export const OVERSIGHT_ALLOWED_TOOLS = Object.freeze({
  "sanctuary-engineering-supervisor": Object.freeze([
    "session_status",
    "read",
    "agents_list",
    "sessions_spawn",
    "sessions_yield",
    "sessions_list",
    "sessions_history",
    "sessions_send",
    "subagents",
    "progress_card",
    "sanctuary_engineering_lane_status",
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
  ]),
  "sanctuary-code-reviewer": Object.freeze([
    "session_status",
    "read",
    "sanctuary_engineering_lane_status",
    "sanctuary_engineering_review_diff_chunk",
  ]),
});

const allowedByAgent = new Map(
  Object.entries(OVERSIGHT_ALLOWED_TOOLS).map(([agentId, tools]) => [
    agentId,
    new Set(tools),
  ]),
);

export function enforceOversightToolPolicy(event, context) {
  const allowed = allowedByAgent.get(context.agentId);
  if (!allowed || allowed.has(event.toolName)) return undefined;

  return {
    block: true,
    blockReason: `Sanctuary oversight role ${context.agentId} cannot call ${event.toolName}.`,
  };
}
