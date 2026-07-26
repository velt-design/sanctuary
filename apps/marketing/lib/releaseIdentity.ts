export const MARKETING_RELEASE_HEADER = 'X-Sanctuary-Release';

const GIT_SHA_PATTERN = /^[a-f0-9]{7,40}$/i;

type ReleaseEnvironment = Readonly<Record<string, string | undefined>>;

export function normalizeMarketingReleaseSha(
  value: string | undefined,
): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  return GIT_SHA_PATTERN.test(normalized) ? normalized : null;
}

export function resolveMarketingReleaseId(
  environment: ReleaseEnvironment,
): string {
  return (
    normalizeMarketingReleaseSha(environment.MARKETING_RELEASE_SHA)
    ?? normalizeMarketingReleaseSha(environment.VERCEL_GIT_COMMIT_SHA)
    ?? normalizeMarketingReleaseSha(environment.GITHUB_SHA)
    ?? 'local'
  );
}
