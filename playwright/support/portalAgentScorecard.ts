import fs from 'node:fs';
import path from 'node:path';

import { portalScenarioRegistry } from './portalScenarioRegistry';
import { portalRouteCatalog, type PortalRouteDebugExportStatus, type PortalRouteSmokeStatus } from './portalRouteCatalog';

interface PortalAgentScorecardRouteCoverage {
  totalRoutes: number;
  smokeStatus: Record<PortalRouteSmokeStatus, number>;
  debugExportStatus: Record<PortalRouteDebugExportStatus, number>;
}

interface PortalAgentScorecardScenarioCoverage {
  totalScenarios: number;
  seeded: number;
  planned: number;
}

interface PortalEvidenceSpecAdoption {
  id: string;
  file: string;
  adopted: boolean;
  missingMarkers: string[];
}

interface PortalAgentScorecardEvidenceCoverage {
  totalSpecs: number;
  adoptedSpecs: number;
  missingSpecs: PortalEvidenceSpecAdoption[];
  specs: PortalEvidenceSpecAdoption[];
}

export interface PortalAgentScorecardRepoHealth {
  source: 'repo:health';
  available: boolean;
  metrics: Partial<Record<PortalRepoHealthMetricKey, number>>;
  recommendedNextLane: string | null;
  error?: string;
}

export interface PortalAgentScorecard {
  generatedAt: string;
  routeCoverage: PortalAgentScorecardRouteCoverage;
  scenarioCoverage: PortalAgentScorecardScenarioCoverage;
  evidenceCoverage: PortalAgentScorecardEvidenceCoverage;
  repoHealth: PortalAgentScorecardRepoHealth;
}

export interface BuildPortalAgentScorecardOptions {
  repoRoot?: string;
  repoHealthText?: string | null;
  repoHealthError?: string | null;
  generatedAt?: string;
}

type PortalRepoHealthMetricKey =
  | 'deadCodeDeleteCandidates'
  | 'criticalFiles'
  | 'rootCompatibilityFiles'
  | 'browserDirectSupabaseFiles';

const SMOKE_STATUSES: PortalRouteSmokeStatus[] = [
  'agent-access',
  'scenario-required',
  'admin-only',
  'fixture-only',
  'catalog-only',
];

const DEBUG_EXPORT_STATUSES: PortalRouteDebugExportStatus[] = ['exported', 'planned', 'not-applicable'];

const EVIDENCE_SPEC_MARKERS = [
  {
    id: 'agent-access',
    file: 'playwright/portal.agent-access.spec.ts',
    markers: ['withPortalBrowserEvidence'],
  },
  {
    id: 'agent-scenarios',
    file: 'playwright/portal.agent-scenarios.spec.ts',
    markers: ['withPortalBrowserEvidence'],
  },
  {
    id: 'auth-runtime',
    file: 'playwright/portal.auth-runtime.spec.ts',
    markers: ['withPortalBrowserEvidence'],
  },
  {
    id: 'workbench-fixture',
    file: 'playwright/portal.workbench-fixture.spec.ts',
    markers: ['installPortalBrowserEvidence', 'attachPortalBrowserEvidence', 'attachWorkbenchViewportEvidence'],
  },
] as const;

function countBy<T extends string>(values: readonly T[], allValues: readonly T[]): Record<T, number> {
  const counts = Object.fromEntries(allValues.map((value) => [value, 0])) as Record<T, number>;
  for (const value of values) {
    counts[value] += 1;
  }
  return counts;
}

function buildRouteCoverage(): PortalAgentScorecardRouteCoverage {
  return {
    totalRoutes: portalRouteCatalog.length,
    smokeStatus: countBy(
      portalRouteCatalog.map((entry) => entry.smokeStatus),
      SMOKE_STATUSES,
    ),
    debugExportStatus: countBy(
      portalRouteCatalog.map((entry) => entry.debugExportStatus),
      DEBUG_EXPORT_STATUSES,
    ),
  };
}

function buildScenarioCoverage(): PortalAgentScorecardScenarioCoverage {
  return {
    totalScenarios: portalScenarioRegistry.length,
    seeded: portalScenarioRegistry.filter((scenario) => scenario.status === 'seeded').length,
    planned: portalScenarioRegistry.filter((scenario) => scenario.status === 'planned').length,
  };
}

function buildEvidenceCoverage(repoRoot: string): PortalAgentScorecardEvidenceCoverage {
  const specs = EVIDENCE_SPEC_MARKERS.map((spec): PortalEvidenceSpecAdoption => {
    const absolutePath = path.resolve(repoRoot, spec.file);
    const contents = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
    const missingMarkers = spec.markers.filter((marker) => !contents.includes(marker));

    return {
      id: spec.id,
      file: spec.file,
      adopted: missingMarkers.length === 0,
      missingMarkers,
    };
  });

  return {
    totalSpecs: specs.length,
    adoptedSpecs: specs.filter((spec) => spec.adopted).length,
    missingSpecs: specs.filter((spec) => !spec.adopted),
    specs,
  };
}

function parseRepoHealthMetric(text: string, label: string): number | undefined {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^${escapedLabel}\\s+(\\d+)`, 'm'));
  return match ? Number(match[1]) : undefined;
}

export function parseRepoHealthForScorecard(
  text: string | null | undefined,
  error?: string | null,
): PortalAgentScorecardRepoHealth {
  if (!text) {
    return {
      source: 'repo:health',
      available: false,
      metrics: {},
      recommendedNextLane: null,
      error: error ?? 'repo:health output was not provided.',
    };
  }

  const recommendedNextLane = text.match(/^Recommended next lane:\s*(.+)$/m)?.[1]?.trim() ?? null;

  return {
    source: 'repo:health',
    available: true,
    metrics: {
      deadCodeDeleteCandidates: parseRepoHealthMetric(text, 'Dead-code delete candidates'),
      criticalFiles: parseRepoHealthMetric(text, 'Critical files'),
      rootCompatibilityFiles: parseRepoHealthMetric(text, 'Root compatibility files'),
      browserDirectSupabaseFiles: parseRepoHealthMetric(text, 'Browser-direct Supabase files'),
    },
    recommendedNextLane,
    error: error ?? undefined,
  };
}

export function buildPortalAgentScorecard(
  options: BuildPortalAgentScorecardOptions = {},
): PortalAgentScorecard {
  const repoRoot = options.repoRoot ?? process.cwd();

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    routeCoverage: buildRouteCoverage(),
    scenarioCoverage: buildScenarioCoverage(),
    evidenceCoverage: buildEvidenceCoverage(repoRoot),
    repoHealth: parseRepoHealthForScorecard(options.repoHealthText, options.repoHealthError),
  };
}

function formatMetric(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'n/a';
}

export function formatPortalAgentScorecard(scorecard: PortalAgentScorecard): string {
  const { routeCoverage, scenarioCoverage, evidenceCoverage, repoHealth } = scorecard;
  const missingEvidence = evidenceCoverage.missingSpecs.map((spec) => spec.id).join(', ') || 'none';

  return [
    'Portal Agent Quality Scorecard',
    `Generated: ${scorecard.generatedAt}`,
    '',
    'Route catalog',
    `  Total routes: ${routeCoverage.totalRoutes}`,
    `  Agent access smoke: ${routeCoverage.smokeStatus['agent-access']}`,
    `  Scenario smoke: ${routeCoverage.smokeStatus['scenario-required']}`,
    `  Fixture-only: ${routeCoverage.smokeStatus['fixture-only']}`,
    `  Admin-only: ${routeCoverage.smokeStatus['admin-only']}`,
    `  Catalog-only: ${routeCoverage.smokeStatus['catalog-only']}`,
    '',
    'Scenarios',
    `  Seeded: ${scenarioCoverage.seeded}`,
    `  Planned: ${scenarioCoverage.planned}`,
    '',
    'Debug exports',
    `  Exported: ${routeCoverage.debugExportStatus.exported}`,
    `  Planned: ${routeCoverage.debugExportStatus.planned}`,
    `  Not applicable: ${routeCoverage.debugExportStatus['not-applicable']}`,
    '',
    'Browser evidence lane',
    `  Adopted specs: ${evidenceCoverage.adoptedSpecs}/${evidenceCoverage.totalSpecs}`,
    `  Missing adoption: ${missingEvidence}`,
    '',
    'Repo health',
    `  Dead-code delete candidates: ${formatMetric(repoHealth.metrics.deadCodeDeleteCandidates)}`,
    `  Critical files: ${formatMetric(repoHealth.metrics.criticalFiles)}`,
    `  Root compatibility files: ${formatMetric(repoHealth.metrics.rootCompatibilityFiles)}`,
    `  Browser-direct Supabase files: ${formatMetric(repoHealth.metrics.browserDirectSupabaseFiles)}`,
    `  Recommended next lane: ${repoHealth.recommendedNextLane ?? 'n/a'}`,
  ].join('\n');
}
