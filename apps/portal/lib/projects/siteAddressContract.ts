/** Project-owned address only. Provider suggestions never enter authored design or pricing state. */
export type ProjectSiteAddress = {
  projectId: string;
  address: string;
  updatedAt: string;
};

export type SiteAddressSuggestion = { placeId: string; address: string };

export type SiteAddressSelection = {
  action: 'select';
  requestId: string;
  placeId: string;
  address: string;
  sessionToken: string;
  expectedUpdatedAt: string;
};

export type SiteAddressSearch = {
  action: 'search';
  query: string;
  sessionToken: string;
};

export function isProjectSiteAddress(value: unknown, projectId: string): value is ProjectSiteAddress {
  if (!value || typeof value !== 'object') return false;
  const row = value as ProjectSiteAddress;
  return row.projectId === projectId && typeof row.address === 'string'
    && typeof row.updatedAt === 'string' && Number.isFinite(Date.parse(row.updatedAt));
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const plain = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

/** Strict bounded request contract. A client can submit a provider reference, never a confirmed free-text address. */
export function parseSiteAddressRequest(value: unknown): SiteAddressSearch | SiteAddressSelection | null {
  if (!plain(value) || typeof value.sessionToken !== 'string' || !uuid.test(value.sessionToken)) return null;
  if (value.action === 'search' && Object.keys(value).every(key => ['action', 'query', 'sessionToken'].includes(key))
    && typeof value.query === 'string' && value.query.trim().length >= 3 && value.query.length <= 200
    && !/[\u0000-\u001f]/.test(value.query)) {
    return { action: 'search', query: value.query.trim(), sessionToken: value.sessionToken };
  }
  if (value.action === 'select' && Object.keys(value).every(key => ['action', 'requestId', 'placeId', 'address', 'sessionToken', 'expectedUpdatedAt'].includes(key))
    && typeof value.requestId === 'string' && uuid.test(value.requestId)
    && typeof value.placeId === 'string' && /^[A-Za-z0-9_-]{1,255}$/.test(value.placeId)
    && typeof value.address === 'string' && value.address.trim().length >= 5 && value.address.length <= 280
    && !/[\u0000-\u001f]/.test(value.address)
    && typeof value.expectedUpdatedAt === 'string' && value.expectedUpdatedAt.length <= 40
    && Number.isFinite(Date.parse(value.expectedUpdatedAt))) {
    return { action: 'select', requestId: value.requestId, placeId: value.placeId, address: value.address.trim(),
      sessionToken: value.sessionToken, expectedUpdatedAt: value.expectedUpdatedAt };
  }
  return null;
}
