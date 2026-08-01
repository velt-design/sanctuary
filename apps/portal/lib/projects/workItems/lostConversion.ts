import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  recentMarketingConversionOccurrence,
  recordMarketingConversionEvent,
} from "@/lib/marketingAttribution/server";
import type { ProjectClosedOutcome } from "./types";

function instant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

export async function recordProjectLostConversion(input: {
  supabase: SupabaseClient;
  projectId: string;
  commandId: string;
  outcome: ProjectClosedOutcome;
  replayed: boolean;
}): Promise<void> {
  const event = await input.supabase
    .from("project_state_events")
    .select("occurred_at")
    .eq("project_id", input.projectId)
    .eq("command_id", input.commandId)
    .eq("event_sequence", 0)
    .maybeSingle();
  const occurredAt = event.error ? null : instant(event.data?.occurred_at);
  if (!input.replayed || recentMarketingConversionOccurrence(occurredAt)) {
    await recordMarketingConversionEvent({
      type: "marketing.project_lost",
      projectId: input.projectId,
      occurredAt,
      payload: { outcome: input.outcome },
    });
  }
}
