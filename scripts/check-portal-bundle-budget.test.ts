import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analyzePortalBundleRoute,
  assertPortalBundleBudgets,
  formatBytes,
  PORTAL_BUNDLE_ROUTES,
  PortalBundleBudgetError,
  type PortalBundleBudgetReport,
  type PortalBundleRouteConfig,
} from '../apps/portal/lib/performance/portalBundleBudgets';

vi.mock('../apps/portal/lib/performance/portalBundleBudgets', async (importOriginal) => ({
  ...await importOriginal<typeof import('../apps/portal/lib/performance/portalBundleBudgets')>(),
  analyzePortalBundleRoute: vi.fn(),
  assertPortalBundleBudgets: vi.fn(),
}));

const activeConfigs = PORTAL_BUNDLE_ROUTES.filter(config => config.id !== 'design-workbench');
const retiredConfig = PORTAL_BUNDLE_ROUTES.find(config => config.id === 'design-workbench')!;

function reportFor(config: PortalBundleRouteConfig): PortalBundleBudgetReport {
  const largestEntry = { id: 'fixture-lazy', files: [], rawBytes: 700, gzipBytes: 300 };
  return {
    id: config.id,
    route: config.route,
    nextDir: 'fictional-build',
    budgets: config.budgets,
    initial: { files: [], rawBytes: 1000, gzipBytes: 400 },
    lazy: { entries: [largestEntry], files: [], rawBytes: 700, gzipBytes: 300, largestEntry },
    topContributors: [{ file: 'static/chunks/fixture.js', rawBytes: 700, gzipBytes: 300 }],
    failures: [],
  };
}

describe('Portal bundle budget CLI policy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(analyzePortalBundleRoute).mockReset().mockReturnValue(reportFor(retiredConfig));
    vi.mocked(assertPortalBundleBudgets).mockReset().mockReturnValue(activeConfigs.map(reportFor));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw Object.assign(new Error('CLI exited'), { exitCode: code });
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('records all retired metrics and exceeded limits while enforcing exactly five active routes', async () => {
    const retired = reportFor(retiredConfig);
    retired.initial.gzipBytes = retired.budgets.initialGzipBytes + 175;
    retired.lazy.rawBytes = retired.budgets.lazyTotalRawBytes + 5;
    retired.failures = [
      { budget: 'initialGzipBytes', actual: retired.initial.gzipBytes, limit: retired.budgets.initialGzipBytes },
      { budget: 'lazyTotalRawBytes', actual: retired.lazy.rawBytes, limit: retired.budgets.lazyTotalRawBytes },
    ];
    vi.mocked(analyzePortalBundleRoute).mockReturnValue(retired);
    await import('./check-portal-bundle-budget');

    expect(analyzePortalBundleRoute).toHaveBeenCalledExactlyOnceWith({ config: retiredConfig });
    expect(activeConfigs.map(config => config.id)).toEqual([
      'schedule', 'projects-index', 'contacts-index', 'project-detail', 'calculator',
    ]);
    expect(assertPortalBundleBudgets).toHaveBeenCalledExactlyOnceWith({ configs: activeConfigs });
    const output = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(output).toContain(`${retired.route} retired bundle diagnostic (not enforced).`);
    expect(output).toContain(`- Initial: ${formatBytes(retired.initial.rawBytes)} raw, ${formatBytes(retired.initial.gzipBytes)} gzip`);
    expect(output).toContain(`- Lazy total: ${formatBytes(retired.lazy.rawBytes)} raw, ${formatBytes(retired.lazy.gzipBytes)} gzip`);
    expect(output).toContain('- Largest lazy entry: 0.7 KiB raw, 0.3 KiB gzip');
    for (const failure of retired.failures) {
      expect(output).toContain(`- Diagnostic ${failure.budget}: ${failure.actual} bytes exceeds recorded limit ${failure.limit} bytes`);
    }
    expect(output).not.toContain(`${retired.route} bundle budget passed.`);
    for (const config of activeConfigs) expect(output).toContain(`${config.route} bundle budget passed.`);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it.each(activeConfigs)('keeps $id budget failure fatal with its original contributor evidence', async (config) => {
    const failed = reportFor(config);
    failed.failures = [{ budget: 'initialGzipBytes', actual: config.budgets.initialGzipBytes + 1, limit: config.budgets.initialGzipBytes }];
    const failure = new PortalBundleBudgetError(`${config.route} exceeds its active budget`, [failed]);
    vi.mocked(assertPortalBundleBudgets).mockImplementation(() => { throw failure; });
    await expect(import('./check-portal-bundle-budget')).rejects.toMatchObject({ exitCode: 1 });
    expect(process.exit).toHaveBeenCalledExactlyOnceWith(1);
    const errors = vi.mocked(console.error).mock.calls.flat().join('\n');
    expect(errors).toContain(failure.message);
    expect(errors).toContain(`${config.route} top contributors:`);
    expect(errors).toContain('static/chunks/fixture.js');
  });

  it('keeps a missing retired build artifact fatal instead of treating it as a size diagnostic', async () => {
    vi.mocked(analyzePortalBundleRoute).mockImplementation(() => {
      throw new PortalBundleBudgetError('Missing fresh Portal build artifact.');
    });
    await expect(import('./check-portal-bundle-budget')).rejects.toMatchObject({ exitCode: 1 });
    expect(process.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(console.error).toHaveBeenCalledWith('Missing fresh Portal build artifact.');
    expect(assertPortalBundleBudgets).not.toHaveBeenCalled();
  });

  it('does not swallow an unexpected retired analyzer exception', async () => {
    const failure = new Error('Fictional analyzer failure');
    vi.mocked(analyzePortalBundleRoute).mockImplementation(() => { throw failure; });
    await expect(import('./check-portal-bundle-budget')).rejects.toBe(failure);
    expect(process.exit).not.toHaveBeenCalled();
    expect(assertPortalBundleBudgets).not.toHaveBeenCalled();
  });

  it('labels a retired route without exceeded limits as diagnostic rather than passed', async () => {
    await import('./check-portal-bundle-budget');
    const output = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(output).toContain(`${retiredConfig.route} retired bundle diagnostic (not enforced).`);
    expect(output).not.toContain(`${retiredConfig.route} bundle budget passed.`);
    expect(output).not.toContain('- Diagnostic ');
    expect(assertPortalBundleBudgets).toHaveBeenCalledExactlyOnceWith({ configs: activeConfigs });
    expect(process.exit).not.toHaveBeenCalled();
  });
});
