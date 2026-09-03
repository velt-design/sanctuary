export const PRAXIS_CONTEXT_SCHEMA_VERSION = 'sanctuary.praxis.context.v1' as const;
export const PRAXIS_HEALTH_SCHEMA_VERSION = 'sanctuary.praxis.health.v1' as const;
export const PRAXIS_ERROR_SCHEMA_VERSION = 'sanctuary.praxis.error.v1' as const;
export const PRAXIS_PROJECTION_VERSION = 'sanctuary.praxis.core.v1' as const;

export const PRAXIS_RESOURCES = [
  'all',
  'enquiry_request',
  'contact',
  'project',
  'estimate',
  'quote',
  'quote_version',
  'quote_line_item',
  'invoice',
  'invoice_plan_item',
  'payment',
  'payment_allocation',
  'project_financial_truth',
] as const;

export type PraxisResource = (typeof PRAXIS_RESOURCES)[number];
export type PraxisRecordResource = Exclude<PraxisResource, 'all'>;

export type PraxisContextRecord = {
  resource: PraxisRecordResource;
  id: string;
  projectId: string | null;
  parentId: string | null;
  recordedAt: string;
  recordVersion: string;
  payload: Record<string, unknown>;
};

export type PraxisContextQuery = {
  resource: PraxisResource;
  projectId: string | null;
  changedAfter: string | null;
  limit: number;
};

export type PraxisSourceEvidence = {
  sourceKey: string;
  connectionId: string;
  environment: string;
  authority: 'canonical';
  projectionVersion: typeof PRAXIS_PROJECTION_VERSION;
  retrievedAt: string;
  asOf: string;
};

export type PraxisContextResponse = {
  schemaVersion: typeof PRAXIS_CONTEXT_SCHEMA_VERSION;
  requestId: string;
  source: PraxisSourceEvidence;
  query: PraxisContextQuery;
  page: { hasMore: boolean; nextCursor: string | null };
  records: PraxisContextRecord[];
};

export type PraxisHealthResponse = {
  schemaVersion: typeof PRAXIS_HEALTH_SCHEMA_VERSION;
  requestId: string;
  source: Omit<PraxisSourceEvidence, 'asOf'>;
  status: {
    connector: 'ready';
    database: 'reachable';
    projection: 'ready';
  };
};

export type PraxisErrorCode =
  | 'INVALID_QUERY'
  | 'INVALID_CURSOR'
  | 'UNAUTHORIZED'
  | 'SOURCE_BINDING_MISMATCH'
  | 'CONNECTOR_NOT_CONFIGURED'
  | 'SOURCE_UNAVAILABLE'
  | 'PROJECTION_NOT_READY';

export type PraxisErrorResponse = {
  schemaVersion: typeof PRAXIS_ERROR_SCHEMA_VERSION;
  requestId: string;
  error: { code: PraxisErrorCode; message: string; retryable: boolean };
};
