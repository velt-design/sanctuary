const messages: Record<string, string> = {
  XERO_DISABLED: 'Xero is disabled in this deployment.',
  XERO_NOT_CONFIGURED: 'A required Xero setting is missing from this deployment.',
  XERO_INVALID_ORIGIN: 'The configured portal origin is invalid.',
  XERO_INVALID_KEY: 'The token encryption key must decode to 32 bytes.',
  XERO_INVALID_TENANT: 'The configured organisation ID is invalid.',
  XERO_DATABASE_TLS_REQUIRED: 'The database URL must require certificate verification.',
  XERO_DATABASE_ROLE_INVALID: 'The database login does not have the required restricted role.',
  XERO_STORE_UNAVAILABLE: 'The connection storage row is missing.',
  '28P01': 'The database rejected the connector password.',
  '28000': 'The database rejected the connector login.',
  '42501': 'The connector is missing a required database permission.',
  '42P01': 'The connection storage migration is missing.',
  SELF_SIGNED_CERT_IN_CHAIN: 'The database certificate chain is not trusted.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'The database certificate chain could not be verified.',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'The database certificate issuer is not trusted.',
  ERR_TLS_CERT_ALTNAME_INVALID: 'The database certificate does not match its hostname.',
  CONNECT_TIMEOUT: 'The database connection timed out.',
  ETIMEDOUT: 'The database connection timed out.',
  ENOTFOUND: 'The database hostname could not be resolved.',
  ECONNREFUSED: 'The database refused the connection.',
};

// Only fixed categories reach the verified developer. Never include raw provider/DB messages.
export function setupError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Connection setup failed; further diagnosis is required.';
  const candidate = error as { code?: unknown; message?: unknown };
  for (const value of [candidate.code, candidate.message]) {
    if (typeof value === 'string' && Object.hasOwn(messages, value)) return messages[value];
  }
  return 'Connection setup failed; further diagnosis is required.';
}
