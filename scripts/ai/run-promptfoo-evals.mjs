import { spawnSync } from 'node:child_process';
import path from 'node:path';

const PROMPTFOO_IMAGE = 'ghcr.io/promptfoo/promptfoo@sha256:36c7ea4fee2cc30d48a90cc8f3ee2222dd70be8c3ec6d36932c3a96ae33b72cd';
const repositoryRoot = process.cwd();
const mount = `${path.resolve(repositoryRoot)}:/workspace:ro`;

const result = spawnSync('docker', [
  'run',
  '--rm',
  '--network',
  'none',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges',
  '--env',
  'PROMPTFOO_DISABLE_TELEMETRY=1',
  '--env',
  'PROMPTFOO_DISABLE_UPDATE=1',
  '--env',
  'PROMPTFOO_SELF_HOSTED=true',
  '--volume',
  mount,
  '--workdir',
  '/workspace',
  '--entrypoint',
  'promptfoo',
  PROMPTFOO_IMAGE,
  'eval',
  '--config',
  'evals/ai/synthetic/promptfooconfig.yaml',
  '--no-cache',
  '--no-share',
], {
  cwd: repositoryRoot,
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Unable to run the offline Promptfoo container: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
