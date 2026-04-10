import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseClosedProfileDxf, serializeGeneratedProfileAssetsModule } from '../packages/geometry/src/profileAssets';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const ASSET_ROOT = path.join(REPO_ROOT, 'packages/geometry/assets/profiles/mono');
const GENERATED_OUTPUT_PATH = path.join(REPO_ROOT, 'packages/geometry/src/generated/profileAssets.ts');

function readProfileAsset(filename: string) {
  const assetPath = path.join(ASSET_ROOT, filename);
  const source = fs.readFileSync(assetPath, 'utf8');
  return parseClosedProfileDxf(source, assetPath);
}

function main() {
  const assets = {
    sp_gutter: readProfileAsset('sp-gutter.dxf'),
    sp_joiners: readProfileAsset('sp-joiners.dxf'),
  };

  fs.mkdirSync(path.dirname(GENERATED_OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(GENERATED_OUTPUT_PATH, serializeGeneratedProfileAssetsModule(assets));
  console.log(`Generated ${path.relative(REPO_ROOT, GENERATED_OUTPUT_PATH)}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to generate geometry profile assets: ${message}`);
  process.exitCode = 1;
}
