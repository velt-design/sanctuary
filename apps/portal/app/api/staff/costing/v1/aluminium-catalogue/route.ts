import { requireStaffSession } from '@/lib/api/staffApi';
import { buildAdditionalAluminiumCatalogue } from '@/lib/costing/additionalAluminiumCatalogue';
import { resolvePublishedCostingConfiguration } from '@/lib/costing/configurationResolver';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { config, provenance } = await resolvePublishedCostingConfiguration();
  return NextResponse.json({
    items: buildAdditionalAluminiumCatalogue(config),
    costingConfiguration: provenance,
  });
}
