import { spawnSync } from 'node:child_process';

import {
  buildPortalAgentScorecard,
  formatPortalAgentScorecard,
  type PortalAgentScorecardStrictResult,
  validatePortalAgentScorecardStrict,
} from '../playwright/support/portalAgentScorecard';
import { redactSensitiveText } from '../playwright/support/portalBrowserEvidence';

function runRepoHealth(): { text: string | null; error: string | null } {
  const result = spawnSync('npm', ['run', '--silent', 'repo:health'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status === 0) {
    return { text: result.stdout, error: null };
  }

  return {
    text: result.stdout || null,
    error: redactSensitiveText(result.stderr || result.error?.message || 'npm run repo:health failed.'),
  };
}

function formatStrictResult(result: PortalAgentScorecardStrictResult): string {
  if (result.passed) {
    return 'Strict portal-agent ratchet: passed';
  }

  return [
    'Strict portal-agent ratchet: failed',
    ...result.failures.map((failure) => `  - ${failure.message}`),
  ].join('\n');
}

function main() {
  const json = process.argv.includes('--json');
  const strict = process.argv.includes('--strict');
  const repoHealth = runRepoHealth();
  const scorecard = buildPortalAgentScorecard({
    repoHealthText: repoHealth.text,
    repoHealthError: repoHealth.error,
  });
  const strictResult = strict ? validatePortalAgentScorecardStrict(scorecard) : null;

  if (json) {
    if (strictResult) {
      process.stdout.write(`${JSON.stringify({ scorecard, strict: strictResult }, null, 2)}\n`);
      if (!strictResult.passed) {
        process.exitCode = 1;
      }
      return;
    }

    process.stdout.write(`${JSON.stringify(scorecard, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatPortalAgentScorecard(scorecard)}\n`);

  if (strictResult) {
    process.stdout.write(`\n${formatStrictResult(strictResult)}\n`);
    if (!strictResult.passed) {
      process.exitCode = 1;
    }
  }
}

main();
