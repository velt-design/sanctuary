type AcceptedLifecycleStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'SUPERSEDED';

export type AcceptedLifecycleCandidate = {
  id: string;
  familyKey: string;
  status: AcceptedLifecycleStatus;
  versionNumber: number | null;
  createdAt: string | null;
  acceptedAt: string | null;
};

function compareVersionDesc(left: AcceptedLifecycleCandidate, right: AcceptedLifecycleCandidate): number {
  const version = (right.versionNumber ?? 0) - (left.versionNumber ?? 0);
  if (version) return version;
  const timestamp = String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''));
  return timestamp || right.id.localeCompare(left.id);
}

/**
 * Returns the one commercially current accepted version for each quote family.
 * A terminal row that was previously accepted prevents an older acceptance
 * from silently becoming current again.
 */
export function selectAuthoritativeAcceptedVersions<T extends AcceptedLifecycleCandidate>(
  candidates: readonly T[],
): T[] {
  const byFamily = new Map<string, T[]>();
  for (const candidate of candidates) {
    if (candidate.status !== 'ACCEPTED' && !candidate.acceptedAt) continue;
    const bucket = byFamily.get(candidate.familyKey) ?? [];
    bucket.push(candidate);
    byFamily.set(candidate.familyKey, bucket);
  }

  return [...byFamily.values()].flatMap((bucket) => {
    const latestAcceptedLifecycle = bucket.slice().sort(compareVersionDesc)[0];
    return latestAcceptedLifecycle?.status === 'ACCEPTED' ? [latestAcceptedLifecycle] : [];
  });
}
