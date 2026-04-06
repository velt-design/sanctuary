export function logPortalClientError(event: string, payload: Record<string, unknown>) {
  console.error('[portal]', {
    event,
    ...payload,
  });
}
