import type { ProjectCommandStaffSummary } from "@/lib/projects/commandCentre/types";
import type {
  ProjectWorkItem,
} from "@/lib/projects/workItems/types";
import { projectWorkEffectiveAssigneeLabel } from "@/lib/projects/workItems/presentation";

const DUE_FORMAT = new Intl.DateTimeFormat("en-NZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Pacific/Auckland",
});

export function formatProjectWorkDue(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf())
    ? DUE_FORMAT.format(parsed)
    : "Due time unavailable";
}

export function projectWorkAssigneeLabel(
  item: ProjectWorkItem,
  staff: ProjectCommandStaffSummary[] = [],
): string {
  return projectWorkEffectiveAssigneeLabel(item.effectiveAssignee, staff);
}

export function sentCommandForWorkItem(item: ProjectWorkItem): string | null {
  if (item.sourceKey?.startsWith("lead:first-email:")) {
    return "RECORD_FIRST_ENQUIRY_EMAIL_SENT";
  }
  if (item.sourceKey?.startsWith("lead:follow-up:")) {
    return "RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT";
  }
  if (item.sourceKey?.startsWith("quote:follow-up:")) {
    return "RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT";
  }
  return null;
}

export function isDecisionReviewWorkItem(item: ProjectWorkItem): boolean {
  return Boolean(
    item.sourceKey?.startsWith("lead:close-review:") ||
    item.sourceKey?.startsWith("quote:outcome-review:"),
  );
}

export function isCadenceWorkItem(item: ProjectWorkItem): boolean {
  return (
    item.sourceType === "LEAD_CADENCE" || item.sourceType === "QUOTE_CADENCE"
  );
}
