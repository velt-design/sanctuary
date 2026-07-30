import type {
  ProjectWorkItem,
  ProjectWorkPrimaryCandidate,
} from "@/lib/projects/workItems/types";

const PROHIBITED_TEXT = /\b(?:call|site[\s_-]*visits?)\b/i;

export function hasProhibitedProjectWorkText(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => PROHIBITED_TEXT.test(value ?? ""));
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
