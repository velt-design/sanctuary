import { spawnSync } from 'node:child_process';

import { buildPortalAgentScorecard, formatPortalAgentScorecard } from '../playwright/support/portalAgentScorecard';
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

function main() {
  const json = process.argv.includes('--json');
  const repoHealth = runRepoHealth();
  const scorecard = buildPortalAgentScorecard({
    repoHealthText: repoHealth.text,
    repoHealthError: repoHealth.error,
  });

  if (json) {
    process.stdout.write(`${JSON.stringify(scorecard, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatPortalAgentScorecard(scorecard)}\n`);
}

main();
