import { NextResponse } from 'next/server';
import { jsonError, requireStaffContext } from '@/lib/api/staffApi';
import { emptyEstimateEditability } from '@/lib/estimates/editability';
import { buildVersionLabelMap, mapEstimateDetail } from '@/lib/estimates/server';
import { generateJobPackPdf } from '@/lib/jobPacks/pdf';
import { isMissingSchemaError, listPowdercoatProfileOptions, loadLatestJobPackGenerationForEstimate, loadPowdercoatOverrideState } from '@/lib/jobPacks/server';
import { JOB_PACK_SHEETS, type JobPackSheetKey, buildWorkbook } from '@/lib/jobPacks/workbook';
import type { JobPackPowdercoatOverrideState } from '@/lib/jobPacks/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

function parseShowNotes(value: string | null): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

function parseSheet(value: string | null): JobPackSheetKey | null {
  const trimmed = value?.trim() ?? '';
  const match = JOB_PACK_SHEETS.find((item) => item.key === trimmed);
  return match ? match.key : null;
}

async function resolveVersionLabel(supabase: SupabaseClient, row: any): Promise<string> {
  if (!row?.project_id) return 'V-';
  const res = await supabase
    .from('estimates')
    .select('id, created_at, outputs, version')
    .eq('project_id', row.project_id)
    .order('created_at', { ascending: false });
  if (res.error) return 'V-';
  const labels = buildVersionLabelMap(Array.isArray(res.data) ? res.data : []);
  return labels.get(String(row?.id ?? '')) ?? 'V-';
}

export async function GET(req: Request) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const url = new URL(req.url);
  const estimateId = url.searchParams.get('estimateId')?.trim() || '';
  if (!estimateId) return jsonError('estimateId is required', 400);

  const sheet = parseSheet(url.searchParams.get('sheet'));
  if (!sheet) return jsonError('sheet must be a valid job pack sheet', 400);

  const showNotesColumn = parseShowNotes(url.searchParams.get('showNotes'));

  let estimateUuid: string;
  try {
    estimateUuid = uuidFromAppId(estimateId, 'est');
  } catch {
    return jsonError('Invalid estimateId', 400);
  }

  const estimateRes = await supabase.from('estimates').select('*').eq('id', estimateUuid).maybeSingle();
  if (estimateRes.error) return jsonError(estimateRes.error.message ?? 'Failed to load estimate', 500);
  if (!estimateRes.data) return jsonError('Estimate not found', 404);

  const generation = await loadLatestJobPackGenerationForEstimate(estimateUuid);
  if (!generation) return jsonError('Generate a job pack from a sent quote before downloading PDFs.', 409);

  const versionLabel = await resolveVersionLabel(supabase, estimateRes.data);
  const detail = mapEstimateDetail(estimateRes.data, versionLabel, emptyEstimateEditability());

  let overrides: JobPackPowdercoatOverrideState = { version: null, rows: [] };
  try {
    overrides = await loadPowdercoatOverrideState(estimateUuid);
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      return jsonError(error instanceof Error ? error.message : 'Failed to load powdercoating overrides', 500);
    }
  }

  let options = [] as Awaited<ReturnType<typeof listPowdercoatProfileOptions>>;
  try {
    options = await listPowdercoatProfileOptions();
  } catch {
    options = [];
  }

  try {
    const workbook = buildWorkbook(detail, overrides, options);
    const pdf = await generateJobPackPdf({
      workbook,
      sheetKey: sheet,
      showNotesColumn,
    });
    return new NextResponse(new Uint8Array(pdf.bytes), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${pdf.filename}"`,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to generate job pack PDF', 500);
  }
}
