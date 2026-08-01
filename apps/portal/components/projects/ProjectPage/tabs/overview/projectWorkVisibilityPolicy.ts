import type {
  ProjectWorkItem,
  ProjectWorkPrimaryCandidate,
} from "@/lib/projects/workItems/types";
import {
  hasProhibitedProjectWorkText,
  isApprovedSiteVisitSpecialistIdentity,
  isRetiredProjectWorkIdentity,
} from "@/lib/projects/workItems/prohibitedWork";

export { hasProhibitedProjectWorkText };

export function isProhibitedProjectWorkItem(item: ProjectWorkItem): boolean {
  return isRetiredProjectWorkIdentity(item);
}

export function isProhibitedProjectWorkPrimary(
  primary: ProjectWorkPrimaryCandidate,
): boolean {
  if (primary.kind === "workItem") {
    return isProhibitedProjectWorkItem(primary.item);
  }
  if (primary.kind === "specialist") {
    if (
      isApprovedSiteVisitSpecialistIdentity({
        actionKind: primary.kind,
        key: primary.key,
        href: primary.href,
      })
    ) {
      return false;
    }
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
