import {
  analyzePortalBundleRoute,
  formatBytes,
  PORTAL_BUNDLE_ROUTES,
  PortalBundleBudgetError,
  type PortalBundleBudgetReport,
  type PortalBundleBudgets,
} from '../performance/portalBundleBudgets';

export type ScheduleBundleBudgets = PortalBundleBudgets;
type ScheduleBundleBudgetReport = PortalBundleBudgetReport & { route: '/staff/schedule' };

export class ScheduleBundleBudgetError extends Error {
  constructor(message: string, readonly report?: ScheduleBundleBudgetReport) {
    super(message);
    this.name = 'ScheduleBundleBudgetError';
  }
}

function getScheduleConfig() {
  const config = PORTAL_BUNDLE_ROUTES.find((candidate) => candidate.id === 'schedule');
  if (!config) throw new Error('Schedule bundle route configuration is missing.');
  return config;
}

export function analyzeScheduleBundleBudgets(options?: {
  rootDir?: string;
  nextDir?: string;
  budgets?: Partial<ScheduleBundleBudgets>;
  topContributors?: number;
}): ScheduleBundleBudgetReport {
  try {
    return analyzePortalBundleRoute({ config: getScheduleConfig(), ...options }) as ScheduleBundleBudgetReport;
  } catch (error) {
    if (error instanceof PortalBundleBudgetError) throw new ScheduleBundleBudgetError(error.message);
    throw error;
  }
}

export function assertScheduleBundleBudgets(options?: Parameters<typeof analyzeScheduleBundleBudgets>[0]): ScheduleBundleBudgetReport {
  const report = analyzeScheduleBundleBudgets(options);
  if (!report.failures.length) return report;
  const details = report.failures.map((failure) =>
    `- ${failure.budget}: ${formatBytes(failure.actual)} over ${formatBytes(failure.limit)}`,
  ).join('\n');
  throw new ScheduleBundleBudgetError(`Schedule bundle budget check failed:\n${details}`, report);
}

export { formatBytes };
