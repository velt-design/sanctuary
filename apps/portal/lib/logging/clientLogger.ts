export function logPortalClientError(event: string, payload: Record<string, unknown>) {
  const log = process.env.NODE_ENV === 'development' ? console.warn : console.error;
  log('[portal]', {
    event,
    ...payload,
  });
}
