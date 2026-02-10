import { getPortalSession } from '@/lib/auth';
import { ACTIVE_COSTING_MANIFEST_PATH, loadCostingConfigV1 } from '@sp/costing';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function resolveConfigPath(relativePath: string): string {
  if (relativePath.startsWith('packages/')) return relativePath;
  return `packages/costing/src/config/${relativePath}`;
}

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = loadCostingConfigV1();
  const files = config.manifest.files;

  return NextResponse.json({
    manifestPath: ACTIVE_COSTING_MANIFEST_PATH,
    manifestVersion: config.manifest.version,
    generatedAt: config.manifest.generated_at,
    files,
    configVersions: {
      manifest: ACTIVE_COSTING_MANIFEST_PATH,
      rules: resolveConfigPath(files.costing_rules),
      pricebook: resolveConfigPath(files.pricebook_materials),
      installActions: resolveConfigPath(files.install_actions),
      overheads: resolveConfigPath(files.overheads),
    },
  });
}
