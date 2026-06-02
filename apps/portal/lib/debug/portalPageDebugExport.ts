const PORTAL_PAGE_DEBUG_EXPORT_VERSION = 1 as const;

type PortalPageDebugExportVersion = typeof PORTAL_PAGE_DEBUG_EXPORT_VERSION;

type PortalPageDebugExportEnvironment = {
  nodeEnv: string;
  debugFlag: boolean;
};

export type PortalPageDebugExportScenario = {
  scenarioId: string | null;
  label: string | null;
  notes?: string | null;
};

export type PortalPageDebugExport = {
  version: PortalPageDebugExportVersion;
  pageId: string;
  route: string;
  capturedAt: string;
  environment: PortalPageDebugExportEnvironment;
  selectedIds: Record<string, string | null>;
  serverState: Record<string, unknown>;
  clientState: Record<string, unknown>;
  diagnostics: Record<string, unknown>;
  scenario: PortalPageDebugExportScenario | null;
};

export type BuildPortalPageDebugExportInput = Omit<
  PortalPageDebugExport,
  'version' | 'capturedAt' | 'environment'
> & {
  capturedAt?: string;
  environment?: Partial<PortalPageDebugExportEnvironment>;
};

export function isPortalPageDebugExportEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') return false;

  return (
    env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES === '1' ||
    env.NEXT_PUBLIC_ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES === '1' ||
    env.PORTAL_PAGE_DEBUG_EXPORTS === '1' ||
    env.NEXT_PUBLIC_PORTAL_PAGE_DEBUG_EXPORTS === '1'
  );
}

export function buildPortalPageDebugExport(input: BuildPortalPageDebugExportInput): PortalPageDebugExport {
  const payload: PortalPageDebugExport = {
    version: PORTAL_PAGE_DEBUG_EXPORT_VERSION,
    pageId: input.pageId,
    route: input.route,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    environment: {
      nodeEnv: input.environment?.nodeEnv ?? process.env.NODE_ENV ?? 'unknown',
      debugFlag: input.environment?.debugFlag ?? isPortalPageDebugExportEnabled(),
    },
    selectedIds: input.selectedIds,
    serverState: input.serverState,
    clientState: input.clientState,
    diagnostics: input.diagnostics,
    scenario: input.scenario,
  };

  assertPortalPageDebugExport(payload);
  return payload;
}

export function assertPortalPageDebugExport(payload: unknown): asserts payload is PortalPageDebugExport {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Portal page debug export must be an object.');
  }

  const candidate = payload as Partial<PortalPageDebugExport>;
  if (candidate.version !== PORTAL_PAGE_DEBUG_EXPORT_VERSION) {
    throw new Error('Portal page debug export has an unsupported version.');
  }

  if (!candidate.pageId || typeof candidate.pageId !== 'string') {
    throw new Error('Portal page debug export requires pageId.');
  }

  if (!candidate.route || typeof candidate.route !== 'string') {
    throw new Error('Portal page debug export requires route.');
  }

  if (!candidate.capturedAt || typeof candidate.capturedAt !== 'string') {
    throw new Error('Portal page debug export requires capturedAt.');
  }

  if (!candidate.environment || typeof candidate.environment !== 'object') {
    throw new Error('Portal page debug export requires environment.');
  }

  if (!candidate.selectedIds || typeof candidate.selectedIds !== 'object') {
    throw new Error('Portal page debug export requires selectedIds.');
  }

  if (!candidate.serverState || typeof candidate.serverState !== 'object') {
    throw new Error('Portal page debug export requires serverState.');
  }

  if (!candidate.clientState || typeof candidate.clientState !== 'object') {
    throw new Error('Portal page debug export requires clientState.');
  }

  if (!candidate.diagnostics || typeof candidate.diagnostics !== 'object') {
    throw new Error('Portal page debug export requires diagnostics.');
  }
}
