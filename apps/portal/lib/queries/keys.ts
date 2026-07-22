import type { QueueMode } from '@/lib/dashboard/types';

export const qk = {
  search: {
    portal: (query: string) => ['portalSearch', query] as const,
    portalPrefix: () => ['portalSearch'] as const,
  },
  staff: {
    directory: (host: string) => ['staff', host, 'directory'] as const,
  },
  dashboard: {
    data: (queueMode: QueueMode) => ['dashboard', 'data', queueMode] as const,
  },
  contacts: {
    list: (host: string) => ['contacts', host, 'list'] as const,
    index: (scope: string) => ['contacts', scope, 'index'] as const,
    indexPrefix: (scope: string) => ['contacts', scope, 'index'] as const,
    detail: (host: string, id: string) => ['contacts', host, 'detail', id] as const,
  },
  projects: {
    list: (host: string, scope: 'active' | 'all' = 'active') => ['projects', host, 'list', scope] as const,
    listPrefix: (host: string) => ['projects', host, 'list'] as const,
    index: (host: string, archive: 'active' | 'archived' | 'all') =>
      ['projects', host, 'index', archive] as const,
    indexPrefix: (host: string) => ['projects', host, 'index'] as const,
    detail: (host: string, id: string) => ['projects', host, 'detail', id] as const,
    summary: (host: string, id: string) => ['projects', host, 'summary', id] as const,
    snapshot: (host: string, id: string) => ['projects', host, 'snapshot', id] as const,
    commandCentre: (host: string, id: string) => ['projects', host, 'commandCentre', id] as const,
    byContact: (host: string, contactId: string) => ['projects', host, 'byContact', contactId] as const,
    tooltipSummary: (host: string, id: string) => ['projects', host, 'tooltipSummary', id] as const,
  },
  estimates: {
    byProject: (host: string, projectId: string) => ['estimates', host, 'byProject', projectId] as const,
    metaByProject: (host: string, projectId: string) => ['estimates', host, 'metaByProject', projectId] as const,
    detail: (host: string, estimateId: string) => ['estimates', host, 'detail', estimateId] as const,
  },
  jobPacks: {
    list: (host: string, projectId: string) => ['jobPacks', host, 'list', projectId] as const,
    powdercoating: (host: string, estimateId: string) => ['jobPacks', host, 'powdercoating', estimateId] as const,
  },
  quotes: {
    versionsByProject: (host: string, projectId: string) => ['quotes', host, 'versionsByProject', projectId] as const,
    detail: (host: string, quoteVersionId: string) => ['quotes', host, 'detail', quoteVersionId] as const,
  },
  invoices: {
    byProject: (host: string, projectId: string) => ['invoices', host, 'byProject', projectId] as const,
  },
  automation: {
    tasks: (host: string, projectId: string) => ['automation', host, 'tasks', projectId] as const,
    designTicket: (host: string, projectId: string) => ['automation', host, 'designTicket', projectId] as const,
    followups: (host: string, projectId: string) => ['automation', host, 'followups', projectId] as const,
    outbox: (host: string, projectId: string) => ['automation', host, 'outbox', projectId] as const,
    audit: (host: string, projectId: string, limit: number) => ['automation', host, 'audit', projectId, limit] as const,
  },
  schedule: {
    snapshot: (host: string) => ['schedule', host, 'snapshot'] as const,
    board: (host: string, today: string) => ['schedule', host, 'board', today] as const,
    gantt: (host: string, rangeStart: string, rangeEnd: string, today: string) =>
      ['schedule', host, 'gantt', rangeStart, rangeEnd, today] as const,
  },
  runningJobs: {
    list: (host: string) => ['runningJobs', host, 'list'] as const,
    snapshot: (host: string) => ['runningJobs', host, 'snapshot'] as const,
  },
  designPackages: {
    list: (host: string) => ['designPackages', host, 'list'] as const,
  },
  siteVisits: {
    snapshot: (host: string, rangeKey: string) => ['siteVisits', host, 'snapshot', rangeKey] as const,
  },
  auth: {
    role: (host: string, userId: string) => ['auth', host, 'role', userId] as const,
  },
} as const;
