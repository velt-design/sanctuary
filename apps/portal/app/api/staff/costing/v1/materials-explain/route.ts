import { getPortalSession } from '@/lib/auth';
import { getCostingConfigWithOverrides } from '@/lib/costing/overrides';
import { calculateCostV1WithMaterialsExplain } from '@sp/costing';
import type { CostInputsV1, MaterialsExplainOptions } from '@sp/costing';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseFocusLineIndex(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const debugEnabled = process.env.NODE_ENV !== 'production' || process.env.COSTING_DEBUG_ENABLED === '1';
  if (!debugEnabled) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const detailRaw = searchParams.get('detail');
  const detail: MaterialsExplainOptions['detail'] = detailRaw === 'full' ? 'full' : 'summary';
  if (detailRaw && detailRaw !== 'summary' && detailRaw !== 'full') {
    return badRequest("detail must be 'summary' or 'full'");
  }

  const focusLineIndex = parseFocusLineIndex(searchParams.get('focus_line_index'));
  if (searchParams.get('focus_line_index') && focusLineIndex === undefined) {
    return badRequest('focus_line_index must be an integer >= 0');
  }

  const focusCutGroupKeyRaw = searchParams.get('focus_cut_group_key');
  const focusCutGroupKey = focusCutGroupKeyRaw ? focusCutGroupKeyRaw.trim() : undefined;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body || typeof body !== 'object') {
    return badRequest('Body must be a costing input object');
  }

  try {
    const { config } = await getCostingConfigWithOverrides();
    const result = calculateCostV1WithMaterialsExplain(body as CostInputsV1, {
      detail,
      focus_line_index: focusLineIndex,
      focus_cut_group_key: focusCutGroupKey,
    }, config);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Costing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
