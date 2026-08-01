const PROHIBITED_PROJECT_WORK_IDENTITY = /\b(?:call|site[\s_-]*visits?)\b/i;
export const SITE_VISIT_SPECIALIST_KEY_PREFIX = "journey-site-visit:";

export function isApprovedSiteVisitSpecialistIdentity(values: {
  actionKind?: string | null;
  key?: string | null;
  sourceKey?: string | null;
  href?: string | null;
}): boolean {
  const key = values.key ?? values.sourceKey ?? "";
  return (
    (values.actionKind === undefined || values.actionKind === "specialist") &&
    key.startsWith(SITE_VISIT_SPECIALIST_KEY_PREFIX) &&
    /^\/staff\/schedule\?view=site-visits&project=proj_[a-z0-9_.%-]+$/i.test(
      values.href ?? "",
    )
  );
}

export function hasProhibitedProjectWorkText(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) =>
    PROHIBITED_PROJECT_WORK_IDENTITY.test(value ?? ""),
  );
}

export function isRetiredProjectWorkIdentity(values: {
  title?: string | null;
  sourceType?: string | null;
  sourceKey?: string | null;
  seriesKey?: string | null;
  href?: string | null;
}): boolean {
  return (
    values.sourceType === "LEGACY_REVIEW" ||
    hasProhibitedProjectWorkText(
      values.title,
      values.sourceType,
      values.sourceKey,
      values.seriesKey,
      values.href,
    )
  );
}
