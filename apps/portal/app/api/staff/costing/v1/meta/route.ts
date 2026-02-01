import { authOptions } from '@/lib/auth';
import { ACTIVE_COSTING_MANIFEST_PATH, loadCostingConfigV1 } from '@/src/costing/engine/config';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function resolveConfigPath(relativePath: string): string {
  if (relativePath.startsWith('src/')) return relativePath;
  return `src/costing/config/${relativePath}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
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

