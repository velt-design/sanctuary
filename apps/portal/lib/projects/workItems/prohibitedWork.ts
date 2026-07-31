const PROHIBITED_PROJECT_WORK_IDENTITY = /\b(?:call|site[\s_-]*visits?)\b/i;

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
