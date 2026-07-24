type PublicTokenAccessState = 'active' | 'expired';

export function publicTokenAccessState(
  expiresAt: string | null,
  nowMs: number = Date.now(),
): PublicTokenAccessState {
  if (!expiresAt) return 'active';
  const parsed = new Date(expiresAt);
  if (!Number.isFinite(parsed.getTime())) return 'expired';
  return nowMs >= parsed.getTime() ? 'expired' : 'active';
}
