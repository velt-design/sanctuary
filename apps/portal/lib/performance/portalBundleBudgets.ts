import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';

export type PortalBundleBudgets = {
  initialRawBytes: number;
  initialGzipBytes: number;
  lazyTotalRawBytes: number;
  lazyTotalGzipBytes: number;
  largestLazyRawBytes: number;
  largestLazyGzipBytes: number;
};

export type PortalBundleRouteConfig = {
  id: 'schedule' | 'project-detail' | 'calculator' | 'design-workbench';
  route: string;
  routeKey: string;
  clientReferenceManifest: string;
  reactLoadableManifest: string;
  budgets: PortalBundleBudgets;
};

type PortalBundleFileMetric = { file: string; rawBytes: number; gzipBytes: number };
type PortalLazyChunkMetric = {
  id: string;
  files: PortalBundleFileMetric[];
  rawBytes: number;
  gzipBytes: number;
};
type PortalBundleBudgetFailure = {
  budget: keyof PortalBundleBudgets;
  actual: number;
  limit: number;
};
export type PortalBundleBudgetReport = {
  id: PortalBundleRouteConfig['id'];
  route: string;
  nextDir: string;
  budgets: PortalBundleBudgets;
  initial: { files: PortalBundleFileMetric[]; rawBytes: number; gzipBytes: number };
  lazy: {
    entries: PortalLazyChunkMetric[];
    files: PortalBundleFileMetric[];
    rawBytes: number;
    gzipBytes: number;
    largestEntry: PortalLazyChunkMetric | null;
  };
  topContributors: PortalBundleFileMetric[];
  failures: PortalBundleBudgetFailure[];
};

export class PortalBundleBudgetError extends Error {
  constructor(message: string, readonly reports: PortalBundleBudgetReport[] = []) {
    super(message);
    this.name = 'PortalBundleBudgetError';
  }
}

type ClientReferenceManifest = {
  clientModules?: Record<string, { async?: boolean; chunks?: string[] }>;
};
type ReactLoadableManifest = Record<string, { id?: string | number; files?: string[] }>;

// Schedule limits are the original production gate and must remain exact.
// Other limits are the 2026-07-18 fresh production measurement plus 5%, rounded up to KiB.
export const PORTAL_BUNDLE_ROUTES: readonly PortalBundleRouteConfig[] = [
  {
    id: 'schedule',
    route: '/staff/schedule',
    routeKey: '/staff/schedule/page',
    clientReferenceManifest: 'server/app/staff/schedule/page_client-reference-manifest.js',
    reactLoadableManifest: 'server/app/staff/schedule/page/react-loadable-manifest.json',
    budgets: {
      initialRawBytes: 750_000,
      initialGzipBytes: 225_000,
      lazyTotalRawBytes: 360_000,
      lazyTotalGzipBytes: 84_000,
      largestLazyRawBytes: 210_000,
      largestLazyGzipBytes: 43_000,
    },
  },
  {
    id: 'project-detail',
    route: '/staff/projects/[projectId]',
    routeKey: '/staff/projects/[projectId]/page',
    clientReferenceManifest: 'server/app/staff/projects/[projectId]/page_client-reference-manifest.js',
    reactLoadableManifest: 'server/app/staff/projects/[projectId]/page/react-loadable-manifest.json',
    budgets: {
      // 2026-07-19 fresh build after making every project tab a workflow boundary.
      // The initial route is now 661 KiB; the lazy values are newly visible because
      // Turbopack leaves this route's React loadable manifest empty.
      initialRawBytes: 694_272,
      initialGzipBytes: 200_704,
      lazyTotalRawBytes: 2_856_960,
      lazyTotalGzipBytes: 655_360,
      largestLazyRawBytes: 2_591_744,
      largestLazyGzipBytes: 587_776,
    },
  },
  {
    id: 'calculator',
    route: '/staff/calculator',
    routeKey: '/staff/calculator/page',
    clientReferenceManifest: 'server/app/staff/calculator/page_client-reference-manifest.js',
    reactLoadableManifest: 'server/app/staff/calculator/page/react-loadable-manifest.json',
    budgets: {
      initialRawBytes: 1_210_368,
      initialGzipBytes: 319_488,
      lazyTotalRawBytes: 0,
      lazyTotalGzipBytes: 0,
      largestLazyRawBytes: 0,
      largestLazyGzipBytes: 0,
    },
  },
  {
    id: 'design-workbench',
    route: '/staff/projects/[projectId]/design-workbench',
    routeKey: '/staff/projects/[projectId]/design-workbench/page',
    clientReferenceManifest: 'server/app/staff/projects/[projectId]/design-workbench/page_client-reference-manifest.js',
    reactLoadableManifest: 'server/app/staff/projects/[projectId]/design-workbench/page/react-loadable-manifest.json',
    budgets: {
      initialRawBytes: 2_681_856,
      initialGzipBytes: 671_744,
      lazyTotalRawBytes: 0,
      lazyTotalGzipBytes: 0,
      largestLazyRawBytes: 0,
      largestLazyGzipBytes: 0,
    },
  },
] as const;

function missingArtifact(file: string): string {
  return `Portal bundle budget check could not find ${file}. Run npm run build:portal first to create a fresh portal build, then rerun npm run portal:bundle-budget.`;
}

function readRequiredFile(file: string): string {
  if (!fs.existsSync(file)) throw new PortalBundleBudgetError(missingArtifact(file));
  return fs.readFileSync(file, 'utf8');
}

function normalizeChunkPath(file: string): string {
  return file.replace(/^\/_next\//, '').replace(/^_next\//, '').replace(/^\//, '');
}

function readClientManifest(nextDir: string, config: PortalBundleRouteConfig): ClientReferenceManifest {
  const file = path.join(nextDir, config.clientReferenceManifest);
  const context = { globalThis: {} as { __RSC_MANIFEST?: Record<string, ClientReferenceManifest> } };
  vm.createContext(context);
  vm.runInContext(readRequiredFile(file), context, { filename: file });
  const manifest = context.globalThis.__RSC_MANIFEST?.[config.routeKey];
  if (!manifest?.clientModules) {
    throw new PortalBundleBudgetError(
      `Portal client reference manifest did not contain ${config.routeKey}. Run npm run build:portal first to create a fresh portal build, then rerun npm run portal:bundle-budget.`,
    );
  }
  return manifest;
}

function readLoadableManifest(nextDir: string, config: PortalBundleRouteConfig): ReactLoadableManifest {
  return JSON.parse(readRequiredFile(path.join(nextDir, config.reactLoadableManifest))) as ReactLoadableManifest;
}

function byteMetric(nextDir: string, file: string): PortalBundleFileMetric {
  const normalized = normalizeChunkPath(file);
  const absolute = path.join(nextDir, normalized);
  if (!fs.existsSync(absolute)) throw new PortalBundleBudgetError(missingArtifact(absolute));
  const bytes = fs.readFileSync(absolute);
  return { file: normalized, rawBytes: bytes.length, gzipBytes: zlib.gzipSync(bytes).length };
}

function uniqueMetrics(nextDir: string, files: Iterable<string>): PortalBundleFileMetric[] {
  return Array.from(new Set(Array.from(files).map(normalizeChunkPath))).sort().map((file) => byteMetric(nextDir, file));
}

const sumRaw = (files: PortalBundleFileMetric[]) => files.reduce((sum, file) => sum + file.rawBytes, 0);
const sumGzip = (files: PortalBundleFileMetric[]) => files.reduce((sum, file) => sum + file.gzipBytes, 0);

function initialFiles(manifest: ClientReferenceManifest): string[] {
  return Object.values(manifest.clientModules ?? {}).flatMap((entry) => entry.async === false ? entry.chunks ?? [] : []);
}

function lazyEntries(nextDir: string, manifest: ReactLoadableManifest): PortalLazyChunkMetric[] {
  return Object.entries(manifest)
    .map(([key, entry]) => {
      const files = uniqueMetrics(nextDir, entry.files ?? []);
      return { id: String(entry.id ?? key), files, rawBytes: sumRaw(files), gzipBytes: sumGzip(files) };
    })
    .filter((entry) => entry.files.length > 0)
    .sort((a, b) => b.rawBytes - a.rawBytes);
}

function turbopackLazyEntries(
  nextDir: string,
  initial: PortalBundleFileMetric[],
): PortalLazyChunkMetric[] {
  const entries: PortalLazyChunkMetric[] = [];
  const loaderPattern = /Promise\.all\(\[((?:["']static\/chunks\/[^"']+["']\s*,?\s*)+)\]\.map\([^)]*=>[^)]*\.l\([^)]*\)\)\)/g;
  const filePattern = /["'](static\/chunks\/[^"']+\.(?:js|css))["']/g;

  for (const initialFile of initial) {
    if (!initialFile.file.endsWith('.js')) continue;
    const source = readRequiredFile(path.join(nextDir, initialFile.file));
    let loaderMatch: RegExpExecArray | null;
    let loaderIndex = 0;
    while ((loaderMatch = loaderPattern.exec(source)) !== null) {
      const referencedFiles = Array.from(loaderMatch[1].matchAll(filePattern), (match) => match[1]);
      const files = uniqueMetrics(nextDir, referencedFiles);
      if (!files.length) continue;
      entries.push({
        id: `turbopack:${initialFile.file}:${loaderIndex}`,
        files,
        rawBytes: sumRaw(files),
        gzipBytes: sumGzip(files),
      });
      loaderIndex += 1;
    }
  }

  return entries;
}

function uniqueLazyEntries(entries: PortalLazyChunkMetric[]): PortalLazyChunkMetric[] {
  const seen = new Set<string>();
  return entries
    .filter((entry) => {
      const key = entry.files.map((file) => file.file).sort().join('|');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.rawBytes - a.rawBytes);
}

function excludeInitialChunks(
  entries: PortalLazyChunkMetric[],
  initial: PortalBundleFileMetric[],
): PortalLazyChunkMetric[] {
  const initialFiles = new Set(initial.map((file) => file.file));
  return entries
    .map((entry) => {
      const files = entry.files.filter((file) => !initialFiles.has(file.file));
      return { ...entry, files, rawBytes: sumRaw(files), gzipBytes: sumGzip(files) };
    })
    .filter((entry) => entry.files.length > 0);
}

function failuresFor(report: Omit<PortalBundleBudgetReport, 'failures'>): PortalBundleBudgetFailure[] {
  const actual: PortalBundleBudgets = {
    initialRawBytes: report.initial.rawBytes,
    initialGzipBytes: report.initial.gzipBytes,
    lazyTotalRawBytes: report.lazy.rawBytes,
    lazyTotalGzipBytes: report.lazy.gzipBytes,
    largestLazyRawBytes: report.lazy.largestEntry?.rawBytes ?? 0,
    largestLazyGzipBytes: report.lazy.largestEntry?.gzipBytes ?? 0,
  };
  return (Object.keys(actual) as Array<keyof PortalBundleBudgets>)
    .filter((budget) => actual[budget] > report.budgets[budget])
    .map((budget) => ({ budget, actual: actual[budget], limit: report.budgets[budget] }));
}

export function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

export function analyzePortalBundleRoute(options: {
  config: PortalBundleRouteConfig;
  rootDir?: string;
  nextDir?: string;
  budgets?: Partial<PortalBundleBudgets>;
  topContributors?: number;
}): PortalBundleBudgetReport {
  const nextDir = options.nextDir ?? path.join(options.rootDir ?? process.cwd(), 'apps/portal/.next');
  if (!fs.existsSync(nextDir)) throw new PortalBundleBudgetError(missingArtifact(nextDir));
  const config = options.config;
  const budgets = { ...config.budgets, ...(options.budgets ?? {}) };
  const initial = uniqueMetrics(nextDir, initialFiles(readClientManifest(nextDir, config)));
  const entries = uniqueLazyEntries(excludeInitialChunks(
    [
      ...lazyEntries(nextDir, readLoadableManifest(nextDir, config)),
      ...turbopackLazyEntries(nextDir, initial),
    ],
    initial,
  ));
  const lazy = uniqueMetrics(nextDir, entries.flatMap((entry) => entry.files.map((file) => file.file)));
  const topContributors = uniqueMetrics(nextDir, [...initial, ...lazy].map((file) => file.file))
    .sort((a, b) => b.rawBytes - a.rawBytes)
    .slice(0, options.topContributors ?? 10);
  const withoutFailures: Omit<PortalBundleBudgetReport, 'failures'> = {
    id: config.id,
    route: config.route,
    nextDir,
    budgets,
    initial: { files: initial, rawBytes: sumRaw(initial), gzipBytes: sumGzip(initial) },
    lazy: {
      entries,
      files: lazy,
      rawBytes: sumRaw(lazy),
      gzipBytes: sumGzip(lazy),
      largestEntry: entries[0] ?? null,
    },
    topContributors,
  };
  return { ...withoutFailures, failures: failuresFor(withoutFailures) };
}

function analyzePortalBundleBudgets(options?: {
  rootDir?: string;
  nextDir?: string;
  configs?: readonly PortalBundleRouteConfig[];
}): PortalBundleBudgetReport[] {
  return (options?.configs ?? PORTAL_BUNDLE_ROUTES).map((config) => analyzePortalBundleRoute({ ...options, config }));
}

export function assertPortalBundleBudgets(options?: Parameters<typeof analyzePortalBundleBudgets>[0]): PortalBundleBudgetReport[] {
  const reports = analyzePortalBundleBudgets(options);
  const failures = reports.flatMap((report) => report.failures.map((failure) => ({ report, failure })));
  if (!failures.length) return reports;
  const details = failures.map(({ report, failure }) =>
    `- ${report.route} ${failure.budget}: ${formatBytes(failure.actual)} over ${formatBytes(failure.limit)}`,
  ).join('\n');
  throw new PortalBundleBudgetError(`Portal bundle budget check failed:\n${details}`, reports);
}

export function budgetAtFivePercent(actualBytes: number): number {
  return Math.ceil((actualBytes * 1.05) / 1024) * 1024;
}
