import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';

const SCHEDULE_ROUTE_KEY = '/staff/schedule/page';
const CLIENT_REFERENCE_MANIFEST = 'server/app/staff/schedule/page_client-reference-manifest.js';
const REACT_LOADABLE_MANIFEST = 'server/app/staff/schedule/page/react-loadable-manifest.json';

const SCHEDULE_BUNDLE_BUDGETS = {
  initialRawBytes: 750_000,
  initialGzipBytes: 225_000,
  lazyTotalRawBytes: 360_000,
  lazyTotalGzipBytes: 84_000,
  largestLazyRawBytes: 210_000,
  largestLazyGzipBytes: 43_000,
} as const;

export type ScheduleBundleBudgets = {
  initialRawBytes: number;
  initialGzipBytes: number;
  lazyTotalRawBytes: number;
  lazyTotalGzipBytes: number;
  largestLazyRawBytes: number;
  largestLazyGzipBytes: number;
};

type ScheduleBundleFileMetric = {
  file: string;
  rawBytes: number;
  gzipBytes: number;
};

type ScheduleLazyChunkMetric = {
  id: string;
  files: ScheduleBundleFileMetric[];
  rawBytes: number;
  gzipBytes: number;
};

type ScheduleBundleBudgetFailure = {
  budget: keyof ScheduleBundleBudgets;
  actual: number;
  limit: number;
};

type ScheduleBundleBudgetReport = {
  route: '/staff/schedule';
  nextDir: string;
  budgets: ScheduleBundleBudgets;
  initial: {
    files: ScheduleBundleFileMetric[];
    rawBytes: number;
    gzipBytes: number;
  };
  lazy: {
    entries: ScheduleLazyChunkMetric[];
    files: ScheduleBundleFileMetric[];
    rawBytes: number;
    gzipBytes: number;
    largestEntry: ScheduleLazyChunkMetric | null;
  };
  topContributors: ScheduleBundleFileMetric[];
  failures: ScheduleBundleBudgetFailure[];
};

export class ScheduleBundleBudgetError extends Error {
  constructor(message: string, readonly report?: ScheduleBundleBudgetReport) {
    super(message);
    this.name = 'ScheduleBundleBudgetError';
  }
}

type ClientReferenceManifest = {
  clientModules?: Record<string, { async?: boolean; chunks?: string[] }>;
};

type ReactLoadableManifest = Record<string, { id?: string | number; files?: string[] }>;

function withDefaultBudgets(budgets?: Partial<ScheduleBundleBudgets>): ScheduleBundleBudgets {
  return { ...SCHEDULE_BUNDLE_BUDGETS, ...(budgets ?? {}) };
}

function actionableMissingArtifactMessage(file: string): string {
  return `Schedule bundle budget check could not find ${file}. Run npm run build:portal first, then rerun npm run schedule:bundle-budget.`;
}

function readRequiredFile(file: string): string {
  if (!fs.existsSync(file)) throw new ScheduleBundleBudgetError(actionableMissingArtifactMessage(file));
  return fs.readFileSync(file, 'utf8');
}

function normalizeChunkPath(file: string): string {
  return file.replace(/^\/_next\//, '').replace(/^_next\//, '').replace(/^\//, '');
}

function readClientReferenceManifest(nextDir: string): ClientReferenceManifest {
  const file = path.join(nextDir, CLIENT_REFERENCE_MANIFEST);
  const code = readRequiredFile(file);
  const context = { globalThis: {} as { __RSC_MANIFEST?: Record<string, ClientReferenceManifest> } };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: file });
  const manifest = context.globalThis.__RSC_MANIFEST?.[SCHEDULE_ROUTE_KEY];
  if (!manifest?.clientModules) throw new ScheduleBundleBudgetError(`Schedule client reference manifest did not contain ${SCHEDULE_ROUTE_KEY}. Run npm run build:portal first.`);
  return manifest;
}

function readReactLoadableManifest(nextDir: string): ReactLoadableManifest {
  const file = path.join(nextDir, REACT_LOADABLE_MANIFEST);
  return JSON.parse(readRequiredFile(file)) as ReactLoadableManifest;
}

function byteMetric(nextDir: string, file: string): ScheduleBundleFileMetric {
  const normalized = normalizeChunkPath(file);
  const absolute = path.join(nextDir, normalized);
  if (!fs.existsSync(absolute)) throw new ScheduleBundleBudgetError(actionableMissingArtifactMessage(absolute));
  const bytes = fs.readFileSync(absolute);
  return {
    file: normalized,
    rawBytes: bytes.length,
    gzipBytes: zlib.gzipSync(bytes).length,
  };
}

function sumRaw(files: ScheduleBundleFileMetric[]): number {
  return files.reduce((sum, file) => sum + file.rawBytes, 0);
}

function sumGzip(files: ScheduleBundleFileMetric[]): number {
  return files.reduce((sum, file) => sum + file.gzipBytes, 0);
}

function metricsForUniqueFiles(nextDir: string, files: Iterable<string>): ScheduleBundleFileMetric[] {
  return Array.from(new Set(Array.from(files).map(normalizeChunkPath)))
    .sort()
    .map((file) => byteMetric(nextDir, file));
}

function collectInitialFiles(manifest: ClientReferenceManifest): string[] {
  const files: string[] = [];
  for (const entry of Object.values(manifest.clientModules ?? {})) {
    if (entry.async !== false) continue;
    files.push(...(entry.chunks ?? []));
  }
  return files;
}

function collectLazyEntries(nextDir: string, manifest: ReactLoadableManifest): ScheduleLazyChunkMetric[] {
  return Object.entries(manifest)
    .map(([key, entry]) => {
      const files = metricsForUniqueFiles(nextDir, entry.files ?? []);
      return {
        id: String(entry.id ?? key),
        files,
        rawBytes: sumRaw(files),
        gzipBytes: sumGzip(files),
      };
    })
    .filter((entry) => entry.files.length > 0)
    .sort((a, b) => b.rawBytes - a.rawBytes);
}

function budgetFailures(report: Omit<ScheduleBundleBudgetReport, 'failures'>): ScheduleBundleBudgetFailure[] {
  const largest = report.lazy.largestEntry;
  const checks: Array<ScheduleBundleBudgetFailure | null> = [
    report.initial.rawBytes > report.budgets.initialRawBytes
      ? { budget: 'initialRawBytes', actual: report.initial.rawBytes, limit: report.budgets.initialRawBytes }
      : null,
    report.initial.gzipBytes > report.budgets.initialGzipBytes
      ? { budget: 'initialGzipBytes', actual: report.initial.gzipBytes, limit: report.budgets.initialGzipBytes }
      : null,
    report.lazy.rawBytes > report.budgets.lazyTotalRawBytes
      ? { budget: 'lazyTotalRawBytes', actual: report.lazy.rawBytes, limit: report.budgets.lazyTotalRawBytes }
      : null,
    report.lazy.gzipBytes > report.budgets.lazyTotalGzipBytes
      ? { budget: 'lazyTotalGzipBytes', actual: report.lazy.gzipBytes, limit: report.budgets.lazyTotalGzipBytes }
      : null,
    largest && largest.rawBytes > report.budgets.largestLazyRawBytes
      ? { budget: 'largestLazyRawBytes', actual: largest.rawBytes, limit: report.budgets.largestLazyRawBytes }
      : null,
    largest && largest.gzipBytes > report.budgets.largestLazyGzipBytes
      ? { budget: 'largestLazyGzipBytes', actual: largest.gzipBytes, limit: report.budgets.largestLazyGzipBytes }
      : null,
  ];
  return checks.filter(Boolean) as ScheduleBundleBudgetFailure[];
}

export function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

export function analyzeScheduleBundleBudgets(options?: {
  rootDir?: string;
  nextDir?: string;
  budgets?: Partial<ScheduleBundleBudgets>;
  topContributors?: number;
}): ScheduleBundleBudgetReport {
  const rootDir = options?.rootDir ?? process.cwd();
  const nextDir = options?.nextDir ?? path.join(rootDir, 'apps/portal/.next');
  if (!fs.existsSync(nextDir)) throw new ScheduleBundleBudgetError(actionableMissingArtifactMessage(nextDir));

  const budgets = withDefaultBudgets(options?.budgets);
  const clientManifest = readClientReferenceManifest(nextDir);
  const loadableManifest = readReactLoadableManifest(nextDir);

  const initialFiles = metricsForUniqueFiles(nextDir, collectInitialFiles(clientManifest));
  const lazyEntries = collectLazyEntries(nextDir, loadableManifest);
  const lazyFiles = metricsForUniqueFiles(nextDir, lazyEntries.flatMap((entry) => entry.files.map((file) => file.file)));
  const largestEntry = lazyEntries[0] ?? null;
  const topContributors = metricsForUniqueFiles(nextDir, [
    ...initialFiles.map((file) => file.file),
    ...lazyFiles.map((file) => file.file),
  ])
    .sort((a, b) => b.rawBytes - a.rawBytes)
    .slice(0, options?.topContributors ?? 10);

  const reportWithoutFailures: Omit<ScheduleBundleBudgetReport, 'failures'> = {
    route: '/staff/schedule',
    nextDir,
    budgets,
    initial: {
      files: initialFiles,
      rawBytes: sumRaw(initialFiles),
      gzipBytes: sumGzip(initialFiles),
    },
    lazy: {
      entries: lazyEntries,
      files: lazyFiles,
      rawBytes: sumRaw(lazyFiles),
      gzipBytes: sumGzip(lazyFiles),
      largestEntry,
    },
    topContributors,
  };

  return {
    ...reportWithoutFailures,
    failures: budgetFailures(reportWithoutFailures),
  };
}

export function assertScheduleBundleBudgets(options?: Parameters<typeof analyzeScheduleBundleBudgets>[0]): ScheduleBundleBudgetReport {
  const report = analyzeScheduleBundleBudgets(options);
  if (!report.failures.length) return report;
  const details = report.failures
    .map((failure) => `- ${failure.budget}: ${formatBytes(failure.actual)} over ${formatBytes(failure.limit)}`)
    .join('\n');
  throw new ScheduleBundleBudgetError(`Schedule bundle budget check failed:\n${details}`, report);
}
