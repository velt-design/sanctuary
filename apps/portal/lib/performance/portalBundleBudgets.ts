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
  id: 'schedule' | 'projects-index' | 'contacts-index' | 'project-detail' | 'calculator' | 'design-workbench';
  route: string;
  routeKey: string;
  clientReferenceManifest: string;
  reactLoadableManifest: string;
  budgets: PortalBundleBudgets;
};

type PortalBundleFileMetric = { file: string; rawBytes: number; gzipBytes: number };
type PortalLazyChunkMetric = {
  id: string;
  moduleId?: string;
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
  entryCSSFiles?: Record<string, Array<string | { path: string; inlined?: boolean }>>;
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
    id: 'projects-index',
    route: '/staff/projects',
    routeKey: '/staff/projects/page',
    clientReferenceManifest: 'server/app/staff/projects/page_client-reference-manifest.js',
    reactLoadableManifest: 'server/app/staff/projects/page/react-loadable-manifest.json',
    budgets: {
      // 2026-07-19 fresh production measurement plus 5%, rounded up to KiB.
      initialRawBytes: 733_184,
      initialGzipBytes: 210_944,
      lazyTotalRawBytes: 2_850_816,
      lazyTotalGzipBytes: 653_312,
      largestLazyRawBytes: 2_606_080,
      largestLazyGzipBytes: 589_824,
    },
  },
  {
    id: 'contacts-index',
    route: '/staff/contacts',
    routeKey: '/staff/contacts/page',
    clientReferenceManifest: 'server/app/staff/contacts/page_client-reference-manifest.js',
    reactLoadableManifest: 'server/app/staff/contacts/page/react-loadable-manifest.json',
    budgets: {
      // 2026-07-19 fresh Slice 3 measurement plus 5%, rounded up to KiB.
      initialRawBytes: 602_112,
      initialGzipBytes: 172_032,
      lazyTotalRawBytes: 130_048,
      lazyTotalGzipBytes: 21_504,
      largestLazyRawBytes: 130_048,
      largestLazyGzipBytes: 21_504,
    },
  },
  {
    id: 'project-detail',
    route: '/staff/projects/[projectId]',
    routeKey: '/staff/projects/[projectId]/page',
    clientReferenceManifest: 'server/app/staff/projects/[projectId]/page_client-reference-manifest.js',
    reactLoadableManifest: 'server/app/staff/projects/[projectId]/page/react-loadable-manifest.json',
    budgets: {
      // 2026-07-19 fresh build after splitting 3D Review behind explicit
      // viewport intent. Each value is the fresh measurement plus 5%, rounded
      // to KiB; the combined ceiling remains below the original route cap.
      initialRawBytes: 742_400,
      initialGzipBytes: 212_992,
      lazyTotalRawBytes: 1_822_720,
      lazyTotalGzipBytes: 380_928,
      largestLazyRawBytes: 1_567_744,
      largestLazyGzipBytes: 321_536,
    },
  },
  {
    id: 'calculator',
    route: '/staff/calculator',
    routeKey: '/staff/calculator/page',
    clientReferenceManifest: 'server/app/staff/calculator/page_client-reference-manifest.js',
    reactLoadableManifest: 'server/app/staff/calculator/page/react-loadable-manifest.json',
    budgets: {
      // 2026-08-18 fresh build after the calculator workflow, trust UI, and
      // commercial handoff work landed: 1,233,342 raw / 322,008 gzip. Keep
      // the established measured-size-plus-5% policy, rounded up to KiB.
      initialRawBytes: 1_295_360,
      initialGzipBytes: 338_944,
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
      // The old all-initial ceiling is redistributed across initial and 3D-lazy
      // code without increasing the combined raw or gzip allowance.
      initialRawBytes: 1_701_888,
      initialGzipBytes: 415_744,
      lazyTotalRawBytes: 979_968,
      lazyTotalGzipBytes: 256_000,
      largestLazyRawBytes: 979_968,
      largestLazyGzipBytes: 256_000,
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

function initialCssFiles(manifest: ClientReferenceManifest): string[] {
  return Object.values(manifest.entryCSSFiles ?? {}).flatMap((entries) =>
    entries.map((entry) => typeof entry === 'string' ? entry : entry.path),
  );
}

function staticChunkJavaScriptFiles(nextDir: string): string[] {
  const chunksDir = path.join(nextDir, 'static/chunks');
  if (!fs.existsSync(chunksDir)) return [];

  const directories = [chunksDir];
  const files: string[] = [];
  while (directories.length > 0) {
    const directory = directories.pop();
    if (!directory) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) directories.push(absolute);
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(path.relative(nextDir, absolute).split(path.sep).join('/'));
      }
    }
  }
  return files.sort();
}

function missingLoadableJavaScriptModuleIds(
  nextDir: string,
  manifest: ReactLoadableManifest,
): ReadonlySet<string> {
  const moduleIds = new Set<string>();
  for (const [key, entry] of Object.entries(manifest)) {
    if (
      (entry.files ?? []).some((file) => {
      const normalized = normalizeChunkPath(file);
      return normalized.endsWith('.js') && !fs.existsSync(path.join(nextDir, normalized));
      })
    ) {
      moduleIds.add(String(entry.id ?? key));
    }
  }
  return moduleIds;
}

function lazyEntries(
  nextDir: string,
  manifest: ReactLoadableManifest,
  turbopackEntries: PortalLazyChunkMetric[],
): PortalLazyChunkMetric[] {
  return Object.entries(manifest)
    .map(([key, entry]) => {
      const id = String(entry.id ?? key);
      const manifestFiles = Array.from(new Set((entry.files ?? []).map(normalizeChunkPath))).sort();
      const missingFiles = manifestFiles.filter((file) => !fs.existsSync(path.join(nextDir, file)));
      let resolvedFiles = manifestFiles;

      if (missingFiles.length > 0) {
        const missingNonJavaScriptFile = missingFiles.find((file) => !file.endsWith('.js'));
        const matchingTurbopackEntries = uniqueLazyEntries(
          turbopackEntries.filter((candidate) => candidate.moduleId === id),
        );
        if (missingNonJavaScriptFile || matchingTurbopackEntries.length !== 1) {
          throw new PortalBundleBudgetError(missingArtifact(path.join(nextDir, missingFiles[0])));
        }

        // Next can leave a stale JavaScript hash in the route's loadable
        // manifest while the emitted Turbopack loader points the same module
        // id at the real chunk group. Reconcile only that proven one-to-one
        // match so missing or ambiguous artifacts still fail closed.
        resolvedFiles = [
          ...manifestFiles.filter((file) => fs.existsSync(path.join(nextDir, file))),
          ...matchingTurbopackEntries[0].files.map((file) => file.file),
        ];
      }

      const files = uniqueMetrics(nextDir, resolvedFiles);
      return { id, files, rawBytes: sumRaw(files), gzipBytes: sumGzip(files) };
    })
    .filter((entry) => entry.files.length > 0)
    .sort((a, b) => b.rawBytes - a.rawBytes);
}

function turbopackLazyEntries(
  nextDir: string,
  sourceFiles: Iterable<string>,
  moduleIds?: ReadonlySet<string>,
): PortalLazyChunkMetric[] {
  const entries: PortalLazyChunkMetric[] = [];
  const loaderPattern = /Promise\.all\(\[((?:["']static\/chunks\/[^"']+["']\s*,?\s*)+)\]\.map\([^)]*=>[^)]*\.l\([^)]*\)\)\)/g;
  const loaderTargetPattern = /^\.then\(\(\)=>[A-Za-z_$][\w$]*\((["']?)([^)"']+)\1\)\)/;
  const filePattern = /["'](static\/chunks\/[^"']+\.(?:js|css))["']/g;

  for (const sourceFile of new Set(sourceFiles)) {
    if (!sourceFile.endsWith('.js')) continue;
    const source = readRequiredFile(path.join(nextDir, sourceFile));
    let loaderMatch: RegExpExecArray | null;
    let loaderIndex = 0;
    while ((loaderMatch = loaderPattern.exec(source)) !== null) {
      const loaderTarget = source.slice(loaderPattern.lastIndex).match(loaderTargetPattern);
      const moduleId = loaderTarget?.[2];
      if (moduleIds && (!moduleId || !moduleIds.has(moduleId))) continue;
      const referencedFiles = Array.from(loaderMatch[1].matchAll(filePattern), (match) => match[1]);
      const files = uniqueMetrics(nextDir, referencedFiles);
      if (!files.length) continue;
      entries.push({
        id: `turbopack:${sourceFile}:${loaderIndex}`,
        moduleId,
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
  const clientManifest = readClientManifest(nextDir, config);
  const initial = uniqueMetrics(nextDir, initialFiles(clientManifest));
  // Turbopack can repeat layout/page CSS in a dynamic import's loadable entry.
  // Those files are already linked by the route and must not be charged again
  // as lazy bytes. Keep the established initial-JS metric unchanged while
  // using the complete initially loaded set for lazy-entry de-duplication.
  const initiallyLoaded = uniqueMetrics(nextDir, [
    ...initial.map((file) => file.file),
    ...initialCssFiles(clientManifest),
  ]);
  const loadableManifest = readLoadableManifest(nextDir, config);
  const emittedTurbopackEntries = turbopackLazyEntries(nextDir, initial.map((file) => file.file));
  const missingLoadableModuleIds = missingLoadableJavaScriptModuleIds(nextDir, loadableManifest);
  const reconciliationEntries = missingLoadableModuleIds.size > 0
    ? [
        ...emittedTurbopackEntries,
        ...turbopackLazyEntries(
          nextDir,
          staticChunkJavaScriptFiles(nextDir),
          missingLoadableModuleIds,
        ),
      ]
    : emittedTurbopackEntries;
  const entries = uniqueLazyEntries(excludeInitialChunks(
    [
      ...lazyEntries(nextDir, loadableManifest, reconciliationEntries),
      ...emittedTurbopackEntries,
    ],
    initiallyLoaded,
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
