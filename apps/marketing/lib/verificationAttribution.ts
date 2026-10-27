/** Explicit measurement suppression, never an access grant or customer classifier. */
export function verificationAttribution(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const attribution=value as Record<string,unknown>;
  const utm=attribution.utm as Record<string,unknown>|undefined;
  return attribution.verification===true || Boolean(utm && utm.utm_source==='codex_qa' && utm.utm_medium==='qa');
}
