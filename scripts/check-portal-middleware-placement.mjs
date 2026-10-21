import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORTAL_DIR = fileURLToPath(new URL('../apps/portal/', import.meta.url));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function readObject(file, prefix) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { failure: `${prefix}_unreadable` };
  }
  try {
    const value = JSON.parse(text);
    return isObject(value) ? { value } : { failure: `${prefix}_invalid` };
  } catch {
    return { failure: `${prefix}_invalid` };
  }
}

// Next awaits the Vercel adapter's onBuildComplete before npm runs postbuild.
// Check its deployment input, never repair it or infer placement from Next's manifest.
export function checkPortalMiddlewarePlacement({ portalDir = PORTAL_DIR, env = process.env } = {}) {
  if (env.VERCEL !== '1' && !env.NEXT_ADAPTER_PATH?.trim()) return 'local_build';

  const configured = readObject(path.join(portalDir, 'vercel.json'), 'source_config');
  if (configured.failure) return configured.failure;
  const regions = configured.value.functions?.['middleware.ts']?.regions;
  if (!Array.isArray(regions) || regions.length !== 1 || !/^[a-z]{3}\d$/.test(regions[0])) {
    return 'source_regions_invalid';
  }

  // This is the same explicit distDir input used by apps/portal/next.config.ts.
  const distDir = env.PORTAL_PLAYWRIGHT_DIST_DIR?.trim() || '.next';
  const outputPath = path.resolve(portalDir, distDir, 'output/functions/_middleware.func/.vc-config.json');
  const generated = readObject(outputPath, 'middleware_output');
  if (generated.failure) return generated.failure;
  const output = generated.value;
  if (!Array.isArray(output.regions) || output.regions.length !== 1 || output.regions[0] !== regions[0]) {
    return 'middleware_regions_mismatch';
  }
  // Match the currently qualified Portal Node 24 deployment, including Node middleware semantics.
  if (output.runtime !== 'nodejs24.x' || output.useWebApi !== true) return 'middleware_runtime_mismatch';
  return 'verified';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkPortalMiddlewarePlacement();
  if (result === 'local_build' || result === 'verified') {
    console.log(`[portal-middleware-placement] ${result}`);
  } else {
    // Do not print configuration bodies, environment values or raw filesystem errors.
    console.error(`[portal-middleware-placement] failed: ${result}`);
    process.exitCode = 1;
  }
}
