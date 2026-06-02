import { describe, expect, it } from 'vitest';

import {
  buildPortalAgentScorecard,
  formatPortalAgentScorecard,
  parseRepoHealthForScorecard,
} from './portalAgentScorecard';
import { portalRouteCatalog } from './portalRouteCatalog';
import { portalScenarioRegistry } from './portalScenarioRegistry';

const REPO_HEALTH_SAMPLE = `repo-health-trends: current advisory snapshot
Date: 2026-06-02

Headline
Metric                         Current  Vs previous  Vs baseline  Direction
-----------------------------  -------  -----------  -----------  ---------
Dead-code delete candidates        489         -104         -130     better
Critical files                      31           +3           +1      worse
Root compatibility files           134            0            0       flat
Browser-direct Supabase files        5            0           -2     better

Recommended next lane: large-file decomposition, because Critical files is up 1 from baseline.
`;

describe('portal agent scorecard', () => {
  it('counts route catalog smoke and debug coverage from the executable catalog', () => {
    const scorecard = buildPortalAgentScorecard({
      repoHealthText: REPO_HEALTH_SAMPLE,
      generatedAt: '2026-06-02T00:00:00.000Z',
    });

    expect(scorecard.routeCoverage.totalRoutes).toBe(portalRouteCatalog.length);
    expect(scorecard.routeCoverage.smokeStatus['agent-access']).toBe(
      portalRouteCatalog.filter((entry) => entry.smokeStatus === 'agent-access').length,
    );
    expect(scorecard.routeCoverage.smokeStatus['scenario-required']).toBe(
      portalRouteCatalog.filter((entry) => entry.smokeStatus === 'scenario-required').length,
    );
    expect(scorecard.routeCoverage.smokeStatus['fixture-only']).toBe(
      portalRouteCatalog.filter((entry) => entry.smokeStatus === 'fixture-only').length,
    );
    expect(scorecard.routeCoverage.smokeStatus['admin-only']).toBe(
      portalRouteCatalog.filter((entry) => entry.smokeStatus === 'admin-only').length,
    );
    expect(scorecard.routeCoverage.smokeStatus['catalog-only']).toBe(
      portalRouteCatalog.filter((entry) => entry.smokeStatus === 'catalog-only').length,
    );
    expect(scorecard.routeCoverage.debugExportStatus.exported).toBe(
      portalRouteCatalog.filter((entry) => entry.debugExportStatus === 'exported').length,
    );
    expect(scorecard.routeCoverage.debugExportStatus.planned).toBe(
      portalRouteCatalog.filter((entry) => entry.debugExportStatus === 'planned').length,
    );
    expect(scorecard.routeCoverage.debugExportStatus['not-applicable']).toBe(
      portalRouteCatalog.filter((entry) => entry.debugExportStatus === 'not-applicable').length,
    );
  });

  it('counts seeded and planned scenarios from the scenario registry', () => {
    const scorecard = buildPortalAgentScorecard({ repoHealthText: REPO_HEALTH_SAMPLE });

    expect(scorecard.scenarioCoverage.totalScenarios).toBe(portalScenarioRegistry.length);
    expect(scorecard.scenarioCoverage.seeded).toBe(
      portalScenarioRegistry.filter((scenario) => scenario.status === 'seeded').length,
    );
    expect(scorecard.scenarioCoverage.planned).toBe(
      portalScenarioRegistry.filter((scenario) => scenario.status === 'planned').length,
    );
  });

  it('identifies the specs that adopted the shared browser evidence lane', () => {
    const scorecard = buildPortalAgentScorecard({ repoHealthText: REPO_HEALTH_SAMPLE });

    expect(scorecard.evidenceCoverage.totalSpecs).toBe(4);
    expect(scorecard.evidenceCoverage.adoptedSpecs).toBe(4);
    expect(scorecard.evidenceCoverage.missingSpecs).toEqual([]);
    expect(scorecard.evidenceCoverage.specs.map((spec) => spec.id).sort()).toEqual([
      'agent-access',
      'agent-scenarios',
      'auth-runtime',
      'workbench-fixture',
    ]);
  });

  it('parses the repo health headline metrics deterministically', () => {
    const repoHealth = parseRepoHealthForScorecard(REPO_HEALTH_SAMPLE);

    expect(repoHealth.available).toBe(true);
    expect(repoHealth.metrics).toEqual({
      deadCodeDeleteCandidates: 489,
      criticalFiles: 31,
      rootCompatibilityFiles: 134,
      browserDirectSupabaseFiles: 5,
    });
    expect(repoHealth.recommendedNextLane).toBe(
      'large-file decomposition, because Critical files is up 1 from baseline.',
    );
  });

  it('formats a concise human-readable scorecard', () => {
    const scorecard = buildPortalAgentScorecard({
      repoHealthText: REPO_HEALTH_SAMPLE,
      generatedAt: '2026-06-02T00:00:00.000Z',
    });

    expect(formatPortalAgentScorecard(scorecard)).toContain('Portal Agent Quality Scorecard');
    expect(formatPortalAgentScorecard(scorecard)).toContain('Browser evidence lane');
    expect(formatPortalAgentScorecard(scorecard)).toContain('Recommended next lane');
  });

  it('JSON output shape does not include secrets or browser storage state', () => {
    const scorecard = buildPortalAgentScorecard({ repoHealthText: REPO_HEALTH_SAMPLE });
    const json = JSON.stringify(scorecard).toLowerCase();

    expect(json).not.toContain('portal_test_password');
    expect(json).not.toContain('supabase_service_role_key');
    expect(json).not.toContain('cooki');
    expect(json).not.toContain('storagestate');
    expect(json).not.toContain('authorization');
    expect(json).not.toContain('bearer ');
  });
});
