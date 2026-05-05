// Notify-only Stop hook for Claude Code.
//
// After each agent turn, run `npm run files:changed` and surface the
// report in the activity feed. Does not block the agent's stop — this
// is the advisory step on the path described in
// docs/file-decomposition-and-ownership.md ("Enforcement Direction").
//
// To enforce instead of notify, swap the script name to
// `files:changed:strict` and add a non-zero-exit branch that emits
// `{"decision":"block","reason":...}` on stdout.

import { execFileSync } from 'node:child_process';

try {
  const output = execFileSync('npm', ['run', 'files:changed', '--silent'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  const trimmed = output.trim();
  if (trimmed) {
    process.stdout.write('[file-decomposition]\n' + trimmed + '\n');
  }
} catch (err) {
  process.stdout.write(
    '[agent-stop-hook] files:changed errored (non-blocking): ' + (err?.message ?? String(err)) + '\n',
  );
}

process.exit(0);
