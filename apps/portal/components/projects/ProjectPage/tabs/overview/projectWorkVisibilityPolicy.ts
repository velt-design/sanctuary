import type { ProjectCommandActionSummary } from "@/lib/projects/commandCentre/types";
import type {
  ProjectPageSnapshot,
  ProjectTaskItem,
} from "@/lib/projects/types";
import type {
  ProjectWorkItem,
  ProjectWorkPrimaryCandidate,
} from "@/lib/projects/workItems/types";

const PROHIBITED_ACTION_CATEGORIES = new Set(["Call", "Site visit"]);
const PROHIBITED_TASK_KEYS = new Set([
  "call_enquiry",
  "call_again_later_contacted",
  "call_again_later_sent",
  "book_site_visit",
  "upload_photos_site_visit",
]);
const PROHIBITED_TEXT = /\b(?:call|site[\s_-]*visits?)\b/i;

export function hasProhibitedProjectWorkText(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => PROHIBITED_TEXT.test(value ?? ""));
}

export function isProhibitedLegacyAction(
  action: ProjectCommandActionSummary | null | undefined,
): boolean {
  if (!action) return false;
  return (
    PROHIBITED_ACTION_CATEGORIES.has(action.category) ||
    hasProhibitedProjectWorkText(action.title, action.sourceType)
  );
}

export function isProhibitedLegacyTask(
  task: ProjectTaskItem,
  stage: ProjectPageSnapshot["tasks"]["stage"],
): boolean {
  if (stage === "site_visit") return true;
  return (
    PROHIBITED_TASK_KEYS.has(task.key) ||
    hasProhibitedProjectWorkText(task.label, task.cta?.label, task.cta?.href)
  );
}

export function isProhibitedProjectWorkItem(item: ProjectWorkItem): boolean {
  return hasProhibitedProjectWorkText(
    item.title,
    item.sourceType,
    item.sourceKey,
    item.seriesKey,
  );
}

export function isProhibitedProjectWorkPrimary(
  primary: ProjectWorkPrimaryCandidate,
): boolean {
  if (primary.kind === "workItem") {
    return isProhibitedProjectWorkItem(primary.item);
  }
  if (primary.kind === "specialist") {
    return hasProhibitedProjectWorkText(
      primary.key,
      primary.title,
      primary.expectedResult,
      primary.href,
    );
  }
  if (primary.kind === "recovery") {
    return hasProhibitedProjectWorkText(
      primary.key,
      primary.title,
      primary.href,
    );
  }
  return false;
}
